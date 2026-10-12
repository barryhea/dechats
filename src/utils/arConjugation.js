// Shared conjugation helpers for every conjugation engine: VerbArTenseQuiz
// (Verbs -AR tense flow), VerbUnitQuiz (verb learning Path units), the AR Mastery
// quiz and the Match Tree. Constants, question builders and answer checking live
// here so the engines import them rather than copying (CLAUDE.md Rule 1). Each
// engine keeps its own state, progress storage and scoring. Pure functions only
// (no React, no Supabase).

export const PRONOUNS = [
  { key: 'yo',       label: 'Yo',            english: 'I'        },
  { key: 'tu',       label: 'Tú',            english: 'You'      },
  { key: 'el',       label: 'Él / Ella',     english: 'He / She' },
  { key: 'nosotros', label: 'Nosotros',      english: 'We'       },
  { key: 'ellos',    label: 'Ellos / Ellas', english: 'They'     },
]

// Accepted typed forms for pronouns that cover two people (either half is correct).
export const PRONOUN_ALTERNATIVES = {
  el:    ['el', 'ella'],
  ellos: ['ellos', 'ellas'],
}

// Sub-stage names, indexed by sub-stage 0–3 (stage number shown = index + 1).
export const SUB_LABEL = ['Drag & Match', 'Multiple Choice', 'Pronoun', 'Full Conjugation']

// The one pass threshold for conjugation sub-stages: each of the five pronouns
// needs this many cumulative correct answers. Monotonic: a wrong answer never
// reduces a count.
export const CONJ_PASS_PER_PRONOUN = 5

// True when every pronoun in a { yo, tu, el, nosotros, ellos } count map has
// reached the pass threshold.
export function allPronounsPassed(counts) {
  return PRONOUNS.every(p => (counts?.[p.key] ?? 0) >= CONJ_PASS_PER_PRONOUN)
}

export function emptyPronounCounts() {
  return { yo: 0, tu: 0, el: 0, nosotros: 0, ellos: 0 }
}

// The three tenses the Mastery quiz mixes, each with a distinct banner colour so the
// user knows which tense to conjugate into when questions are interleaved.
export const MASTERY_TENSES = [
  { key: 't1', conjKey: 'present_conjugations', label: 'Present', bannerBg: '#2563eb' },
  { key: 't2', conjKey: 'past_conjugations',    label: 'Past',    bannerBg: '#ea580c' },
  { key: 't3', conjKey: 'future_conjugations',  label: 'Future',  bannerBg: '#7c3aed' },
]

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// A pronoun sequence of the given length in which no two neighbours are the same
// pronoun. Built from shuffled blocks of all five; where a block would start with
// the previous block's last pronoun, that pronoun is swapped further into the block.
// `avoidFirst` (a pronoun key) is treated as the pronoun just before the sequence,
// so a new session never opens with the previous session's last pronoun.
export function pronounSequence(length, avoidFirst = null) {
  const out = []
  let prev = avoidFirst
  while (out.length < length) {
    const block = shuffle(PRONOUNS)
    if (block[0].key === prev) {
      ;[block[0], block[block.length - 1]] = [block[block.length - 1], block[0]]
    }
    out.push(...block)
    prev = out[out.length - 1].key
  }
  return out.slice(0, length)
}

// Reorder so no two adjacent questions share the same pronoun key (greedy swap).
export function noConsecutivePronoun(arr) {
  const result = [...arr]
  for (let i = 1; i < result.length; i++) {
    if (result[i].pronoun.key === result[i - 1].pronoun.key) {
      for (let j = i + 1; j < result.length; j++) {
        if (result[j].pronoun.key !== result[i - 1].pronoun.key) {
          ;[result[i], result[j]] = [result[j], result[i]]
          break
        }
      }
    }
  }
  return result
}

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => Array(n + 1).fill(0).map((_, j) => j === 0 ? i : 0))
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

export function normalise(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase().trim()
}

// 'exact' | 'close' | 'wrong' — identical thresholds to the tense quiz.
export function fuzzyMatch(typed, correct) {
  const a = normalise(typed), b = normalise(correct)
  if (a === b) return 'exact'
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 'exact'
  return (1 - levenshtein(a, b) / maxLen) >= 0.8 ? 'close' : 'wrong'
}

// ── Per-unit form overrides ──────────────────────────────────────────────────
// A Path unit membership can carry forms_override (verb_unit_members): its own
// five forms for that unit's tense, plus an optional "english" prompt verb — e.g.
// gustar in P9 drills "me gusta / te gusta …" ("I like (it)") instead of the
// stored gusto / gustas. Loaders attach it with withFormsOverride; everything that
// reads forms goes through conjForms, so a verb without an override (and every
// old screen) behaves exactly as before.

// The verb as used by one unit: carries the override for that unit's tense column.
export function withFormsOverride(verb, override, conjKey) {
  return override ? { ...verb, formsOverride: { conjKey, forms: override } } : verb
}

// The five forms to use for `conjKey`: the unit's override when it is for this
// tense, otherwise the verb's stored conjugations.
export function conjForms(verb, conjKey) {
  const o = verb?.formsOverride
  return (o && o.conjKey === conjKey ? o.forms : verb?.[conjKey]) ?? {}
}

// The verb's English meaning without alternatives or notes ("have (possession)"
// → "have", "let / leave" → "let"), for building English prompts. A unit
// override's "english" (e.g. "like (it)") takes precedence.
export function shortEnglish(verb) {
  if (verb.formsOverride?.forms?.english) return verb.formsOverride.forms.english
  return verb.english.split('/')[0].replace(/\s*\(.*?\)\s*/g, '').trim()
}

// Stage 2 "Multiple Choice": show the conjugated form, pick the subject pronoun.
export function buildMCQuestion(verb, pronoun, conjKey) {
  const form        = conjForms(verb, conjKey)[pronoun.key] ?? ''
  const distractors = shuffle(PRONOUNS.filter(p => p.key !== pronoun.key)).slice(0, 3)
  return {
    type: 'conj-mc',
    verb, pronoun,
    form,
    prompt:  `${form}  ·  ${verb.spanish_infinitive}`,
    correct: pronoun.label,
    options: shuffle([pronoun.label, ...distractors.map(p => p.label)]),
  }
}

// Stage 3 "Pronoun": show the conjugated form, type the subject pronoun. For
// el/ella and ellos/ellas both halves are typed (multiInput).
export function buildPronounQuestion(verb, pronoun, conjKey) {
  const form = conjForms(verb, conjKey)[pronoun.key] ?? ''
  return {
    type: 'conj-typed-pron',
    verb, pronoun,
    form,
    prompt:  `${form}  ·  ${verb.spanish_infinitive}`,
    correct: pronoun.key,
    correctCandidates: PRONOUN_ALTERNATIVES[pronoun.key] ?? [pronoun.key],
    multiInput:        !!PRONOUN_ALTERNATIVES[pronoun.key],
    placeholder: 'Type the subject pronoun…',
  }
}

// Stage 4 "Full Conjugation": English prompt → typed pronoun(s) + conjugation.
// `promptSuffix` (e.g. the tense label) is appended after a " · " when given.
export function buildFullConjQuestion(verb, pronoun, conjKey, promptSuffix) {
  const base = `${pronoun.english} ${shortEnglish(verb)}`
  return {
    type: 'conj-typed-dual',
    verb, pronoun,
    englishPrompt: base,
    prompt: promptSuffix ? `${base}  ·  ${promptSuffix}` : base,
    correctPronoun:           pronoun.key,
    correctPronounCandidates: PRONOUN_ALTERNATIVES[pronoun.key] ?? [pronoun.key],
    tripleInput:              !!PRONOUN_ALTERNATIVES[pronoun.key],
    correctConjugation:       conjForms(verb, conjKey)[pronoun.key] ?? '',
  }
}

// Mastery-quiz flavour of the Stage 4 question: carries its tense metadata.
export function buildDualQuestion(verb, pronoun, tenseMeta) {
  return {
    ...buildFullConjQuestion(verb, pronoun, tenseMeta.conjKey),
    tenseKey: tenseMeta.key,
    tenseMeta,
  }
}

// Best of several candidates: 'exact' beats 'close' beats 'wrong'.
function bestMatch(typed, candidates) {
  return candidates
    .map(c => fuzzyMatch(typed, c))
    .reduce((best, r) => r === 'exact' ? 'exact' : best === 'exact' ? 'exact' : r === 'close' ? 'close' : best, 'wrong')
}

// Order-independent check of two typed pronouns against a two-candidate pair
// (el/ella, ellos/ellas). Returns { ok, exact }.
function matchPronounPair(a1, a2, cands) {
  const r00 = fuzzyMatch(a1, cands[0]), r01 = fuzzyMatch(a1, cands[1])
  const r10 = fuzzyMatch(a2, cands[0]), r11 = fuzzyMatch(a2, cands[1])
  const aOk = r00 !== 'wrong' && r11 !== 'wrong'
  const bOk = r01 !== 'wrong' && r10 !== 'wrong'
  const exact = (aOk && r00 === 'exact' && r11 === 'exact') || (bOk && r01 === 'exact' && r10 === 'exact')
  return { ok: aOk || bOk, exact }
}

// Check a Stage 3 "Pronoun" answer → 'exact' | 'close' | 'wrong'.
export function checkPronounAnswer(question, a1, a2) {
  const cands = question.correctCandidates ?? [question.correct]
  if (question.multiInput) {
    const { ok, exact } = matchPronounPair(a1, a2, cands)
    return !ok ? 'wrong' : exact ? 'exact' : 'close'
  }
  return bestMatch(a1, cands)
}

// Whether "Next" may proceed after a wrong Stage 3 answer — the user must type
// the correct pronoun(s) first.
export function pronounConfirmOk(question, a1, a2) {
  const cands = question.correctCandidates ?? [question.correct]
  if (question.multiInput) return matchPronounPair(a1, a2, cands).ok
  return cands.some(c => fuzzyMatch(a1, c) !== 'wrong')
}

// Check a Stage 4 answer. Returns { result, f1Ok, f2Ok, f3Ok, correct }.
// Identical logic to VerbArTenseQuiz's conj-typed-dual handler, incl. the
// order-independent el/ella & ellos/ellas gendered acceptance.
export function checkDualAnswer(question, a1, a2, a3) {
  let result, f1Ok, f2Ok, f3Ok
  if (question.tripleInput) {
    const cands = question.correctPronounCandidates
    const r00 = fuzzyMatch(a1, cands[0]), r01 = fuzzyMatch(a1, cands[1])
    const r10 = fuzzyMatch(a2, cands[0]), r11 = fuzzyMatch(a2, cands[1])
    const aOk = r00 !== 'wrong' && r11 !== 'wrong'
    const bOk = r01 !== 'wrong' && r10 !== 'wrong'
    const pronOk = aOk || bOk
    const conjResult = fuzzyMatch(a3, question.correctConjugation)
    const conjOk = conjResult !== 'wrong'
    if (!pronOk || !conjOk) {
      result = 'wrong'
    } else {
      const allExact = conjResult === 'exact' && (
        (aOk && r00 === 'exact' && r11 === 'exact') ||
        (bOk && r01 === 'exact' && r10 === 'exact')
      )
      result = allExact ? 'exact' : 'close'
    }
    f1Ok = pronOk; f2Ok = pronOk; f3Ok = conjOk
  } else {
    const pronCands  = question.correctPronounCandidates ?? [question.correctPronoun]
    const pronResult = pronCands
      .map(c => fuzzyMatch(a1, c))
      .reduce((best, r) => r === 'exact' ? 'exact' : best === 'exact' ? 'exact' : r === 'close' ? 'close' : best, 'wrong')
    const conjResult = fuzzyMatch(a2, question.correctConjugation)
    const pronOk = pronResult !== 'wrong'
    const conjOk = conjResult !== 'wrong'
    result = pronOk && conjOk
      ? (pronResult === 'exact' && conjResult === 'exact' ? 'exact' : 'close')
      : 'wrong'
    f1Ok = pronOk; f2Ok = conjOk; f3Ok = null
  }
  return { result, f1Ok, f2Ok, f3Ok, correct: result !== 'wrong' }
}

// Whether the "Next" button may proceed after a wrong answer — the user must fix
// the wrong field(s) first. Mirrors VerbArTenseQuiz's confirmOk (dual branch).
export function dualConfirmOk(question, a1, a2, a3, f1Ok, f2Ok, f3Ok) {
  if (question.tripleInput) {
    const cands = question.correctPronounCandidates
    const pronPairOk = f1Ok === true || (() => {
      const r00 = fuzzyMatch(a1, cands[0]), r01 = fuzzyMatch(a1, cands[1])
      const r10 = fuzzyMatch(a2, cands[0]), r11 = fuzzyMatch(a2, cands[1])
      return (r00 !== 'wrong' && r11 !== 'wrong') || (r01 !== 'wrong' && r10 !== 'wrong')
    })()
    const conjOkNow = f3Ok === true || fuzzyMatch(a3, question.correctConjugation) !== 'wrong'
    return pronPairOk && conjOkNow
  }
  const pronCands = question.correctPronounCandidates ?? [question.correctPronoun]
  const f1OkNow = f1Ok === true || pronCands.some(c => fuzzyMatch(a1, c) !== 'wrong')
  const f2OkNow = f2Ok === true || fuzzyMatch(a2, question.correctConjugation) !== 'wrong'
  return f1OkNow && f2OkNow
}
