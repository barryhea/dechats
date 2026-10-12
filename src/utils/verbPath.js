import { supabase } from './supabaseClient'
import { SUB_LABEL } from './arConjugation'

// Shared verb learning Path helpers. `unitStatus` is the ONE place a unit's status
// is derived from its user_unit_progress row — the Path home, the unit page and
// any later surface must call it rather than reading sub_stage themselves.

// Learning order of the Path sections: all Present, then Future, then Past.
// `tense` uses the verb_units convention (1 Present, 2 Past, 3 Future).
export const PATH_SECTIONS = [
  { tense: 1, title: 'Present', conjKey: 'present_conjugations' },
  { tense: 3, title: 'Future',  conjKey: 'future_conjugations'  },
  { tense: 2, title: 'Past',    conjKey: 'past_conjugations'    },
]

export function sectionForTense(tense) {
  return PATH_SECTIONS.find(sec => sec.tense === tense) ?? null
}

const MASTERED_SUB_STAGE = 4

export const STATUS_STYLES = {
  'not-started': { color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' },
  'in-progress': { color: '#c2410c', bg: '#fff7ed', border: '#fdba74' },
  'mastered':    { color: '#15803d', bg: '#f0fdf4', border: '#86efac' },
}

// Status of one unit from its user_unit_progress row (or null/undefined if the
// user has no row). A row exists once the user has opened the unit's engine.
//   not-started  no row
//   in-progress  row with sub_stage 0–3; `stageName` is that sub-stage's name
//   mastered     sub_stage 4 (or mastered_at set)
export function unitStatus(progressRow) {
  let kind = 'not-started'
  let stageName = null
  if (progressRow) {
    const sub = progressRow.sub_stage ?? 0
    if (sub >= MASTERED_SUB_STAGE || progressRow.mastered_at) {
      kind = 'mastered'
    } else {
      kind = 'in-progress'
      stageName = SUB_LABEL[sub] ?? null
    }
  }
  const label = kind === 'mastered' ? 'Mastered'
    : kind === 'in-progress' ? `In progress · ${stageName}`
    : 'Not started'
  const action = kind === 'mastered' ? 'Open' : kind === 'in-progress' ? 'Continue' : 'Start'
  return { kind, label, stageName, action, ...STATUS_STYLES[kind] }
}

// The first unit in sort_order that is not mastered, or null when all are.
export function nextUpUnit(units, progressByUnit) {
  const ordered = [...units].sort((a, b) => a.sort_order - b.sort_order)
  return ordered.find(u => unitStatus(progressByUnit[u.id]).kind !== 'mastered') ?? null
}

// ── Data ──────────────────────────────────────────────────────────────────────

// The user's hidden verb ids. Read-only use of user_verb_progress: only the
// hidden flag is read, and nothing in the Path ever writes the old tables.
export async function loadHiddenVerbIds(userId, verbIds = null) {
  let q = supabase.from('user_verb_progress').select('verb_id').eq('user_id', userId).eq('hidden', true)
  if (verbIds) q = q.in('verb_id', verbIds.length ? verbIds : [-1])
  const { data, error } = await q
  if (error) throw new Error(`Could not check which verbs are hidden: ${error.message}`)
  return new Set((data ?? []).map(r => r.verb_id))
}

// The user's user_unit_progress rows keyed by unit_id.
export async function loadUnitProgress(userId) {
  const { data, error } = await supabase
    .from('user_unit_progress')
    .select('unit_id, sub_stage, mastered_at')
    .eq('user_id', userId)
  if (error) throw new Error(`Could not load your Path progress: ${error.message}`)
  return Object.fromEntries((data ?? []).map(r => [r.unit_id, r]))
}

// Everything the Path home needs: units in sort_order, verb counts per unit and
// the user's progress.
export async function loadPathOverview(userId) {
  const [unitsRes, membersRes, progressByUnit] = await Promise.all([
    supabase.from('verb_units').select('id, sort_order, tense, pattern_name').order('sort_order'),
    supabase.from('verb_unit_members').select('unit_id'),
    loadUnitProgress(userId),
  ])
  if (unitsRes.error)   throw new Error(`Could not load the Path units: ${unitsRes.error.message}`)
  if (membersRes.error) throw new Error(`Could not load the Path verbs: ${membersRes.error.message}`)
  const verbCounts = {}
  for (const m of membersRes.data ?? []) verbCounts[m.unit_id] = (verbCounts[m.unit_id] ?? 0) + 1
  return { units: unitsRes.data ?? [], verbCounts, progressByUnit }
}

// One unit with its visible (not hidden) verbs and the user's progress row.
// Hidden verbs come from user_verb_progress.hidden (read-only).
export async function loadPathUnit(userId, unitId) {
  const { data: unit, error: unitErr } = await supabase
    .from('verb_units')
    .select('id, sort_order, tense, pattern_name, rule_text, example_forms, diary_prompt')
    .eq('id', unitId)
    .maybeSingle()
  if (unitErr) throw new Error(`Could not load unit ${unitId}: ${unitErr.message}`)
  if (!unit) return null

  const { data: members, error: memErr } = await supabase
    .from('verb_unit_members')
    .select('verb_id')
    .eq('unit_id', unit.id)
  if (memErr) throw new Error(`Could not load the verbs for ${unit.id}: ${memErr.message}`)
  const ids = (members ?? []).map(m => m.verb_id)
  const idFilter = ids.length ? ids : [-1]

  const [verbsRes, hidden, progressRes] = await Promise.all([
    supabase.from('verbs')
      .select('id, english, spanish_infinitive, present_conjugations, past_conjugations, future_conjugations')
      .in('id', idFilter),
    loadHiddenVerbIds(userId, ids),
    supabase.from('user_unit_progress')
      .select('unit_id, sub_stage, mastered_at').eq('user_id', userId).eq('unit_id', unit.id).maybeSingle(),
  ])
  if (verbsRes.error)    throw new Error(`Could not load the verbs for ${unit.id}: ${verbsRes.error.message}`)
  if (progressRes.error) throw new Error(`Could not load your progress: ${progressRes.error.message}`)

  const verbs = (verbsRes.data ?? [])
    .filter(v => !hidden.has(v.id))
    .sort((a, b) => a.spanish_infinitive.localeCompare(b.spanish_infinitive))
  return { unit, verbs, hiddenCount: hidden.size, progress: progressRes.data ?? null }
}
