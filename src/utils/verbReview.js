import { supabase } from './supabaseClient'
import { PRONOUNS, withFormsOverride } from './arConjugation'
import { unitStatus, loadHiddenVerbIds, sectionForTense } from './verbPath'

// Daily Review — the spaced-repetition (Leitner) layer of the verb learning Path.
// Items live in user_review_items, one per (user, unit, verb, pronoun); the daily
// streak lives in user_verb_streak. Every date here is the DEVICE'S LOCAL date as
// 'YYYY-MM-DD' (never UTC), so "today" matches the learner's own calendar.

// ── Local dates ───────────────────────────────────────────────────────────────

const pad = n => String(n).padStart(2, '0')

export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(dateStr, n) {
  const d = parseLocal(dateStr)
  d.setDate(d.getDate() + n)
  return localDateStr(d)
}

export function today()    { return localDateStr() }
export function tomorrow() { return addDays(today(), 1) }

// e.g. "Tue 14 Oct"
export function formatDay(dateStr) {
  return parseLocal(dateStr).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

// ── Leitner scheduling ────────────────────────────────────────────────────────

export const MAX_BOX = 5
// Days until the next review for an item now in box 0–5.
export const BOX_INTERVAL_DAYS = [1, 2, 4, 8, 16, 32]
export const REVIEW_SESSION_SIZE = 20

// The update for one answered item. Correct: box + 1 (max 5), due in the new
// box's interval, last_correct_on = today. Wrong: box 0, due tomorrow.
// last_seen_at and updated_at are always set.
export function scheduleAnswer(item, correct, todayStr = today(), now = new Date()) {
  const box = correct ? Math.min((item.box ?? 0) + 1, MAX_BOX) : 0
  const update = {
    box,
    due_on: addDays(todayStr, correct ? BOX_INTERVAL_DAYS[box] : 1),
    last_seen_at: now.toISOString(),
    updated_at: now.toISOString(),
  }
  if (correct) update.last_correct_on = todayStr
  return update
}

// ── Streak ────────────────────────────────────────────────────────────────────

// The streak row after activity on `todayStr`: unchanged if already active today,
// +1 if last active yesterday, otherwise restart at 1. longest_streak keeps the max.
export function nextStreak(row, todayStr = today()) {
  const current = row?.current_streak ?? 0
  const longest = row?.longest_streak ?? 0
  const last    = row?.last_active_on ?? null
  if (last === todayStr) return { current_streak: current, longest_streak: longest, last_active_on: last, changed: false }
  const next = last === addDays(todayStr, -1) ? current + 1 : 1
  return { current_streak: next, longest_streak: Math.max(longest, next), last_active_on: todayStr, changed: true }
}

// The streak to show: a streak is still alive if the user was active today or
// yesterday; after a missed day it shows as 0 until the next activity.
export function displayStreak(row, todayStr = today()) {
  if (!row?.last_active_on) return 0
  return row.last_active_on >= addDays(todayStr, -1) ? (row.current_streak ?? 0) : 0
}

export async function loadStreak(userId) {
  const { data, error } = await supabase
    .from('user_verb_streak')
    .select('current_streak, longest_streak, last_active_on')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`Could not load your streak: ${error.message}`)
  return data ?? null
}

// Record a day of activity (a finished Daily Review, or any answered unit question).
export async function recordStreakActivity(userId) {
  const todayStr = today()
  const row  = await loadStreak(userId)
  const next = nextStreak(row, todayStr)
  if (!next.changed) return row
  const fields = { current_streak: next.current_streak, longest_streak: next.longest_streak, last_active_on: next.last_active_on }
  const { error } = await supabase
    .from('user_verb_streak')
    .upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw new Error(`Could not save your streak: ${error.message}`)
  return fields
}

// ── Seeding ───────────────────────────────────────────────────────────────────

// One item per verb × pronoun, box 0, due tomorrow. Existing items are left as
// they are (ignore duplicates on the unique key), so this is safe to repeat.
export async function seedUnitReviewItems(userId, unitId, verbIds) {
  if (!verbIds.length) return 0
  const due = tomorrow()
  const rows = verbIds.flatMap(verb_id => PRONOUNS.map(p => ({
    user_id: userId, unit_id: unitId, verb_id, pronoun: p.key, box: 0, due_on: due,
  })))
  const { error } = await supabase
    .from('user_review_items')
    .upsert(rows, { onConflict: 'user_id,unit_id,verb_id,pronoun', ignoreDuplicates: true })
  if (error) throw new Error(`Could not create review items for ${unitId}: ${error.message}`)
  return rows.length
}

// All of the user's review items (paged past the API's row cap).
async function loadAllItems(userId) {
  const PAGE = 1000
  const out = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('user_review_items')
      .select('id, unit_id, verb_id, pronoun, box, due_on')
      .eq('user_id', userId)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Could not load your review items: ${error.message}`)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
}

// Seed items for every mastered unit that has none yet (units mastered before
// Daily Review existed, or whose seeding write failed). Returns units seeded.
async function backfillMasteredUnits(userId, progressByUnit, items, hiddenIds) {
  const withItems = new Set(items.map(i => i.unit_id))
  const missing = Object.keys(progressByUnit)
    .filter(id => unitStatus(progressByUnit[id]).kind === 'mastered' && !withItems.has(id))
  if (!missing.length) return []
  const { data: members, error } = await supabase
    .from('verb_unit_members')
    .select('unit_id, verb_id')
    .in('unit_id', missing)
  if (error) throw new Error(`Could not load verbs to backfill review items: ${error.message}`)
  for (const unitId of missing) {
    const ids = (members ?? []).filter(m => m.unit_id === unitId && !hiddenIds.has(m.verb_id)).map(m => m.verb_id)
    await seedUnitReviewItems(userId, unitId, ids)
  }
  return missing
}

// Review state for the Path home: backfills mastered units, then summarises the
// user's non-hidden items. `dueByUnit` counts items due today or earlier.
export async function loadReviewSummary(userId, progressByUnit) {
  const hiddenIds = await loadHiddenVerbIds(userId)
  let items = await loadAllItems(userId)
  const seeded = await backfillMasteredUnits(userId, progressByUnit, items, hiddenIds)
  if (seeded.length) items = await loadAllItems(userId)
  return summarise(items.filter(i => !hiddenIds.has(i.verb_id)))
}

function summarise(items, todayStr = today()) {
  const due = items.filter(i => i.due_on <= todayStr)
  const dueByUnit = {}
  for (const i of due) dueByUnit[i.unit_id] = (dueByUnit[i.unit_id] ?? 0) + 1
  const upcoming = items.filter(i => i.due_on > todayStr).map(i => i.due_on).sort()
  return {
    totalItems: items.length,
    dueCount: due.length,
    dueByUnit,
    nextDueOn: upcoming[0] ?? null,
    dueTomorrow: items.filter(i => i.due_on === addDays(todayStr, 1)).length,
  }
}

// ── Session ───────────────────────────────────────────────────────────────────

// Reorder so the same verb + pronoun never appears twice in a row (it can recur
// across units, e.g. hablar·yo in P1, F1 and T1). Builds the list greedily in the
// given priority order, taking the first item that differs from the previous one
// AND still leaves the rest arrangeable without a repeat. Only if no arrangement
// exists at all (e.g. every remaining item is the same verb + pronoun) is a
// repeat allowed.
export function noConsecutiveVerbPronoun(items) {
  const key = i => `${i.verb_id}|${i.pronoun}`
  // Can `counts` (n items) be ordered with no neighbours equal, given the item
  // placed just before them has key `prev`?
  const arrangeable = (counts, n, prev) => {
    for (const [k, c] of counts) {
      const limit = k === prev ? Math.floor(n / 2) : Math.ceil(n / 2)
      if (c > limit) return false
    }
    return true
  }
  const remaining = [...items]
  const out = []
  while (remaining.length) {
    const prev = out.length ? key(out[out.length - 1]) : null
    const counts = new Map()
    for (const it of remaining) counts.set(key(it), (counts.get(key(it)) ?? 0) + 1)
    let pick = remaining.findIndex(it => {
      const k = key(it)
      if (k === prev) return false
      const after = new Map(counts); after.set(k, after.get(k) - 1)
      return arrangeable(after, remaining.length - 1, k)
    })
    if (pick < 0) pick = remaining.findIndex(it => key(it) !== prev)
    if (pick < 0) pick = 0
    out.push(remaining.splice(pick, 1)[0])
  }
  return out
}

// Up to REVIEW_SESSION_SIZE due items (not hidden), lowest box first then oldest
// due_on; ties shuffled so units and tenses mix. Each item carries its verb and
// its unit's tense.
export async function loadReviewSession(userId) {
  const todayStr  = today()
  const hiddenIds = await loadHiddenVerbIds(userId)
  const all   = (await loadAllItems(userId)).filter(i => !hiddenIds.has(i.verb_id))
  const due   = all.filter(i => i.due_on <= todayStr)
  const tieBreak = new Map(due.map(i => [i.id, Math.random()]))
  const picked = [...due]
    .sort((a, b) => (a.box - b.box) || a.due_on.localeCompare(b.due_on) || (tieBreak.get(a.id) - tieBreak.get(b.id)))
    .slice(0, REVIEW_SESSION_SIZE)
  if (!picked.length) return { items: [], summary: summarise(all, todayStr) }

  const verbIds = [...new Set(picked.map(i => i.verb_id))]
  const unitIds = [...new Set(picked.map(i => i.unit_id))]
  const [verbsRes, unitsRes, overridesRes] = await Promise.all([
    supabase.from('verbs')
      .select('id, english, spanish_infinitive, present_conjugations, past_conjugations, future_conjugations')
      .in('id', verbIds),
    supabase.from('verb_units').select('id, tense, pattern_name').in('id', unitIds),
    supabase.from('verb_unit_members')
      .select('unit_id, verb_id, forms_override')
      .in('unit_id', unitIds)
      .not('forms_override', 'is', null),
  ])
  if (verbsRes.error) throw new Error(`Could not load verbs for review: ${verbsRes.error.message}`)
  if (unitsRes.error) throw new Error(`Could not load units for review: ${unitsRes.error.message}`)
  if (overridesRes.error) throw new Error(`Could not load unit forms for review: ${overridesRes.error.message}`)
  const overrideOf = Object.fromEntries((overridesRes.data ?? []).map(o => [`${o.unit_id}|${o.verb_id}`, o.forms_override]))
  const verbById = Object.fromEntries((verbsRes.data ?? []).map(v => [v.id, v]))
  const unitById = Object.fromEntries((unitsRes.data ?? []).map(u => [u.id, u]))
  const items = noConsecutiveVerbPronoun(picked)
    .filter(i => verbById[i.verb_id] && unitById[i.unit_id])
    .map(i => {
      const unit = unitById[i.unit_id]
      // Each item gets its own copy of the verb carrying that unit's override (if any).
      const verb = withFormsOverride(verbById[i.verb_id], overrideOf[`${i.unit_id}|${i.verb_id}`], sectionForTense(unit.tense).conjKey)
      return { ...i, verb, unit }
    })
  return { items, summary: summarise(all, todayStr) }
}

// Save one answered item; returns the update applied.
export async function saveReviewAnswer(item, correct) {
  const update = scheduleAnswer(item, correct)
  const { error } = await supabase.from('user_review_items').update(update).eq('id', item.id)
  if (error) throw new Error(`Could not save your answer: ${error.message}`)
  return update
}

export async function loadDueTomorrowCount(userId) {
  const hiddenIds = await loadHiddenVerbIds(userId)
  const all = (await loadAllItems(userId)).filter(i => !hiddenIds.has(i.verb_id))
  return summarise(all).dueTomorrow
}
