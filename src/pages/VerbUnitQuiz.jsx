import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import NavBar from '../components/NavBar'
import ConjResultsCard from '../components/ConjResultsCard'
import ConjQuestionCard from '../components/ConjQuestionCard'
import { ConjDragRound } from './VerbDragMatch'
import {
  PRONOUNS, SUB_LABEL, CONJ_PASS_PER_PRONOUN,
  allPronounsPassed, emptyPronounCounts, shuffle, pronounSequence,
  buildMCQuestion, buildPronounQuestion, buildFullConjQuestion,
  checkPronounAnswer, checkDualAnswer,
} from '../utils/arConjugation'

// Conjugation engine for the verb learning Path (route /verb-unit/:unitId).
// Runs any of the 18 units in dechats.verb_units: one conjugation pattern in one
// tense, over that unit's verbs from dechats.verb_unit_members.
//
// Four sub-stages, as in the Verbs -AR flow: 0 Drag & Match, 1 Multiple Choice,
// 2 Pronoun (typed), 3 Full Conjugation (typed). Sub-stages 1–3 pass when each of
// the five pronouns has CONJ_PASS_PER_PRONOUN cumulative correct answers; counts
// are monotonic (a wrong answer never lowers them). Drag & Match passes on a
// five-round block in which every pronoun is matched correctly each round.
//
// Progress lives only in the Path tables:
//   user_unit_progress          sub_stage (0–4) and mastered_at, one row per unit
//   user_unit_pronoun_progress  per-pronoun correct counts for sub-stages 1–3
// The only old table read is user_verb_progress, and only its `hidden` flag, to
// leave hidden verbs out. Nothing is written to the old verb progress tables.

const TENSES = {
  1: { conjKey: 'present_conjugations', label: 'Present Tense' },
  2: { conjKey: 'past_conjugations',    label: 'Past Tense'    },
  3: { conjKey: 'future_conjugations',  label: 'Future Tense'  },
}

const MC_SESSION_LENGTH    = 15  // Multiple Choice questions per session
const TYPED_SESSION_LENGTH = 10  // Pronoun / Full Conjugation questions per session
const DRAG_BLOCK_ROUNDS    = 5   // Drag & Match rounds per block

const DONE_SUB_STAGE = 4

// One session for sub-stage 1–3. The pronoun sequence never repeats a pronoun in
// consecutive questions — including across the session boundary, via
// `lastPronoun` — so the same verb + pronoun can never appear twice in a row even
// when the unit has a single verb. Verbs are dealt from reshuffled copies of the
// unit's list, so small units reuse verbs and large ones spread out.
function buildSession(subStage, verbs, tense, lastPronoun) {
  const length = subStage === 1 ? MC_SESSION_LENGTH : TYPED_SESSION_LENGTH
  let deck = []
  return pronounSequence(length, lastPronoun).map(pronoun => {
    if (!deck.length) deck = shuffle(verbs)
    const verb = deck.pop()
    if (subStage === 1) return buildMCQuestion(verb, pronoun, tense.conjKey)
    if (subStage === 2) return buildPronounQuestion(verb, pronoun, tense.conjKey)
    return buildFullConjQuestion(verb, pronoun, tense.conjKey)
  })
}

// The last pronoun asked in a unit, kept for the browser session so a reload does
// not open the next session with the same question. Convenience only.
const lastPronounKey = unitId => `verb-unit-last-pronoun-${unitId}`
function readLastPronoun(unitId) {
  try { return sessionStorage.getItem(lastPronounKey(unitId)) } catch { return null }
}
function writeLastPronoun(unitId, pronoun) {
  try { sessionStorage.setItem(lastPronounKey(unitId), pronoun) } catch { /* storage unavailable */ }
}

// Drag & Match: a different verb from last round whenever the unit has more than one.
function pickDragVerb(verbs, previous) {
  const pool = verbs.length > 1 ? verbs.filter(v => v.id !== previous?.id) : verbs
  return shuffle(pool)[0]
}

export default function VerbUnitQuiz() {
  const navigate   = useNavigate()
  const { unitId } = useParams()
  const { user }   = useAuth()

  const [phase,     setPhase]     = useState('loading')
  const [errorMsg,  setErrorMsg]  = useState('')
  const [saveError, setSaveError] = useState(false)
  const [unit,      setUnit]      = useState(null)
  const [verbs,     setVerbs]     = useState([])      // visible (not hidden) unit verbs
  const [subStage,  setSubStage]  = useState(0)       // 0–3 while working, 4 = done
  const [counts,    setCounts]    = useState(emptyPronounCounts)  // current sub-stage (1–3)

  // Drag & Match
  const [roundVerb,          setRoundVerb]          = useState(null)
  const [dragRound,          setDragRound]          = useState(0)
  const [dragBlockResults,   setDragBlockResults]   = useState([])
  const [blockPronounCounts, setBlockPronounCounts] = useState(emptyPronounCounts)

  // Question session (sub-stages 1–3)
  const [session,      setSession]      = useState([])
  const [currentIdx,   setCurrentIdx]   = useState(0)
  const [results,      setResults]      = useState([])
  const [selectedOpt,  setSelectedOpt]  = useState(null)
  const [typedAnswer,  setTypedAnswer]  = useState('')
  const [typedAnswer2, setTypedAnswer2] = useState('')
  const [typedAnswer3, setTypedAnswer3] = useState('')
  const [matchResult,  setMatchResult]  = useState(null)
  const [f1Ok, setF1Ok] = useState(null)
  const [f2Ok, setF2Ok] = useState(null)
  const [f3Ok, setF3Ok] = useState(null)

  // Sub-stage as stored in the DB; guards advancement so it only ever moves forward once.
  const storedStageRef = useRef(0)
  const inputRef  = useRef(null)
  const inputRef2 = useRef(null)
  const inputRef3 = useRef(null)

  const question = session[currentIdx] ?? null
  const tense    = unit ? TENSES[unit.tense] : null

  useEffect(() => {
    if (user?.id) loadUnit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, unitId])

  useEffect(() => {
    const isTyped = question?.type === 'conj-typed-pron' || question?.type === 'conj-typed-dual'
    if (isTyped && phase === 'question') inputRef.current?.focus({ preventScroll: true })
  }, [question, phase])

  // ── Data ──────────────────────────────────────────────────────────────────

  function fail(msg) {
    setErrorMsg(msg)
    setPhase('error')
  }

  async function loadUnit() {
    setPhase('loading')
    setSaveError(false)

    const { data: unitRow, error: unitErr } = await supabase
      .from('verb_units')
      .select('id, tense, pattern_name, rule_text, example_forms')
      .eq('id', unitId)
      .maybeSingle()
    if (unitErr) return fail(`Could not load unit ${unitId}.`)
    if (!unitRow) return fail(`There is no unit called "${unitId}".`)
    setUnit(unitRow)

    const { data: members, error: memErr } = await supabase
      .from('verb_unit_members')
      .select('verb_id')
      .eq('unit_id', unitRow.id)
    if (memErr) return fail(`Could not load the verbs for ${unitRow.id}.`)
    const ids = (members ?? []).map(m => m.verb_id)

    const { data: verbData, error: verbErr } = await supabase
      .from('verbs')
      .select('id, english, spanish_infinitive, present_conjugations, past_conjugations, future_conjugations')
      .in('id', ids.length ? ids : [-1])
    if (verbErr) return fail(`Could not load the verbs for ${unitRow.id}.`)

    // Hidden flag only — read-only, no other old-progress column is touched.
    const { data: hiddenRows, error: hidErr } = await supabase
      .from('user_verb_progress')
      .select('verb_id')
      .eq('user_id', user.id)
      .eq('hidden', true)
      .in('verb_id', ids.length ? ids : [-1])
    if (hidErr) return fail('Could not check which verbs are hidden.')
    const hidden  = new Set((hiddenRows ?? []).map(r => r.verb_id))
    const visible = (verbData ?? [])
      .filter(v => !hidden.has(v.id))
      .sort((a, b) => a.spanish_infinitive.localeCompare(b.spanish_infinitive))
    setVerbs(visible)
    if (!visible.length) { setPhase('empty'); return }

    const { data: prog, error: progErr } = await supabase
      .from('user_unit_progress')
      .select('sub_stage')
      .eq('user_id', user.id)
      .eq('unit_id', unitRow.id)
      .maybeSingle()
    if (progErr) return fail('Could not load your progress for this unit.')

    let stage = prog?.sub_stage ?? 0
    if (!prog) {
      const { error } = await supabase
        .from('user_unit_progress')
        .upsert({ user_id: user.id, unit_id: unitRow.id, sub_stage: 0 }, { onConflict: 'user_id,unit_id', ignoreDuplicates: true })
      if (error) { console.warn('[unit] progress row create failed:', error.message); setSaveError(true) }
    }
    storedStageRef.current = stage

    // Load this sub-stage's counts. If they already pass (e.g. the advance write
    // failed last time), advance now rather than drilling a passed stage.
    let stageCounts = emptyPronounCounts()
    while (stage >= 1 && stage < DONE_SUB_STAGE) {
      stageCounts = await loadCounts(unitRow.id, stage)
      if (!allPronounsPassed(stageCounts)) break
      stage = await advanceFrom(unitRow.id, stage)
      stageCounts = emptyPronounCounts()
    }

    setSubStage(stage)
    setCounts(stageCounts)
    if (stage >= DONE_SUB_STAGE) { setPhase('mastered'); return }
    if (stage === 0) startDrag(visible)
    else startSession(stage, visible, TENSES[unitRow.tense])
  }

  async function loadCounts(uId, stage) {
    const out = emptyPronounCounts()
    const { data, error } = await supabase
      .from('user_unit_pronoun_progress')
      .select('pronoun, correct_count')
      .eq('user_id', user.id)
      .eq('unit_id', uId)
      .eq('sub_stage', stage)
    if (error) { console.warn('[unit] count load failed:', error.message); setSaveError(true); return out }
    for (const r of data ?? []) if (r.pronoun in out) out[r.pronoun] = r.correct_count ?? 0
    return out
  }

  // Persist one pronoun's cumulative count. Only called on a correct answer, with
  // the incremented value, so stored counts never go down.
  async function saveCount(stage, pronoun, correctCount) {
    const { error } = await supabase
      .from('user_unit_pronoun_progress')
      .upsert(
        { user_id: user.id, unit_id: unit.id, sub_stage: stage, pronoun, correct_count: correctCount, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,unit_id,sub_stage,pronoun' }
      )
    if (error) { console.warn('[unit] count save failed:', error.message); setSaveError(true) }
  }

  // Move the unit from `from` to the next sub-stage, once. Reaching 4 also stamps
  // mastered_at. Returns the stage the unit is now at.
  async function advanceFrom(uId, from) {
    if (storedStageRef.current !== from) return storedStageRef.current
    const to  = from + 1
    const now = new Date().toISOString()
    storedStageRef.current = to
    const row = { user_id: user.id, unit_id: uId, sub_stage: to, updated_at: now }
    if (to === DONE_SUB_STAGE) row.mastered_at = now
    const { error } = await supabase
      .from('user_unit_progress')
      .upsert(row, { onConflict: 'user_id,unit_id' })
    if (error) { console.warn('[unit] sub-stage advance failed:', error.message); setSaveError(true) }
    return to
  }

  // ── Drag & Match ──────────────────────────────────────────────────────────

  function startDrag(visible) {
    setRoundVerb(prev => pickDragVerb(visible, prev))
    setPhase('drag')
  }

  async function handleDragComplete(_allCorrect, perPronounResults) {
    const newBlock = { ...blockPronounCounts }
    PRONOUNS.forEach((p, i) => { if (perPronounResults?.[i]) newBlock[p.key] += 1 })
    setBlockPronounCounts(newBlock)
    const newResults = [...dragBlockResults, perPronounResults?.every(Boolean) ?? false]
    const round = dragRound + 1
    setDragRound(round)

    if (newResults.length >= DRAG_BLOCK_ROUNDS) {
      if (allPronounsPassed(newBlock)) await advanceFrom(unit.id, 0)
      setDragBlockResults([])
      setPhase('drag-summary')
    } else {
      setDragBlockResults(newResults)
      startDrag(verbs)
    }
  }

  // ── Question session ──────────────────────────────────────────────────────

  function resetAnswer() {
    setSelectedOpt(null)
    setTypedAnswer(''); setTypedAnswer2(''); setTypedAnswer3('')
    setMatchResult(null)
    setF1Ok(null); setF2Ok(null); setF3Ok(null)
  }

  function startSession(stage, visible, t) {
    setSession(buildSession(stage, visible, t, readLastPronoun(unitId)))
    setCurrentIdx(0)
    setResults([])
    resetAnswer()
    setPhase('question')
  }

  function recordCorrect() {
    const key  = question.pronoun.key
    const next = { ...counts, [key]: (counts[key] ?? 0) + 1 }
    setCounts(next)
    saveCount(subStage, key, next[key])
    if (allPronounsPassed(next)) advanceFrom(unit.id, subStage)
  }

  function handleMC(option) {
    if (phase !== 'question') return
    const correct = option === question.correct
    if (correct) recordCorrect()
    setSelectedOpt(option)
    setResults(r => [...r, { verb: question.verb, pronoun: question.pronoun, correct }])
    setPhase('feedback')
  }

  function handleTyped() {
    if (phase !== 'question') return
    if (question.type === 'conj-typed-pron') {
      const result  = checkPronounAnswer(question, typedAnswer, typedAnswer2)
      const correct = result !== 'wrong'
      if (correct) recordCorrect()
      setMatchResult(result)
      setResults(r => [...r, { verb: question.verb, pronoun: question.pronoun, correct, matchResult: result }])
      setPhase('feedback')
      if (!correct) { setTypedAnswer(''); if (question.multiInput) setTypedAnswer2('') }
      return
    }

    const { result, f1Ok: ok1, f2Ok: ok2, f3Ok: ok3, correct } =
      checkDualAnswer(question, typedAnswer, typedAnswer2, typedAnswer3)
    if (correct) recordCorrect()
    setF1Ok(ok1); setF2Ok(ok2); setF3Ok(ok3)
    setMatchResult(result)
    setResults(r => [...r, { verb: question.verb, pronoun: question.pronoun, correct, matchResult: result }])
    setPhase('feedback')
    // Keep correct fields (shown green and locked); clear only the wrong ones.
    if (question.tripleInput) {
      if (!ok1) { setTypedAnswer(''); setTypedAnswer2('') }
      if (!ok3) setTypedAnswer3('')
    } else {
      if (!ok1) setTypedAnswer('')
      if (!ok2) setTypedAnswer2('')
    }
  }

  function handleNext() {
    writeLastPronoun(unitId, question.pronoun.key)
    const nextIdx = currentIdx + 1
    if (nextIdx >= session.length) { setPhase('session-summary'); return }
    setCurrentIdx(nextIdx)
    resetAnswer()
    setPhase('question')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Exits return to this unit's Path page; an unknown unit goes to the Path home.
  const back = () => navigate(unit ? `/verb-path/${unit.id}` : '/verbs')
  const backLabel = unit ? `← Back to ${unit.id}` : '← Back to Verb Path'

  if (phase === 'loading') return <div style={s.page}><NavBar /><p style={s.loadingMsg}>Loading…</p></div>

  if (phase === 'error' || phase === 'empty' || phase === 'mastered') {
    const message = phase === 'error' ? errorMsg
      : phase === 'empty' ? `Every verb in ${unit.id} · ${unit.pattern_name} is hidden, so there is nothing to practise. Unhide a verb to use this unit.`
      : `${unit.id} · ${unit.pattern_name} is mastered. ¡Muy bien!`
    return (
      <div style={s.page}><NavBar />
        <main style={s.main}>
          <button style={s.backBtn} onClick={back}>{backLabel}</button>
          <div style={s.card}>
            <p style={{ margin: 0, color: phase === 'error' ? '#c00' : '#555' }}>{message}</p>
          </div>
        </main>
      </div>
    )
  }

  const subLabel = SUB_LABEL[subStage] ?? ''

  const header = (
    <div style={s.unitHeader}>
      <div style={s.phaseRow}>
        <span style={s.tenseTag}>{tense.label}</span>
        <span style={s.unitName}>{unit.id} · {unit.pattern_name}</span>
        <span style={s.subTag}>Stage {subStage + 1} · {subLabel}</span>
      </div>
      <p style={s.ruleText}>{unit.rule_text}</p>
      {saveError && <p style={s.saveError}>Some progress could not be saved. Check your connection and reload.</p>}
    </div>
  )

  if (phase === 'drag') {
    return (
      <div style={s.scrollPage}><NavBar />
        <main style={s.scrollMain}>
          <div style={s.progressRow}>
            <div style={s.progressBar}>
              <div style={{ display: 'flex', height: '100%' }}>
                {Array.from({ length: DRAG_BLOCK_ROUNDS }).map((_, i) => {
                  const r  = dragBlockResults[i]
                  const bg = r === undefined ? '#e5e5e5' : r ? '#16a34a' : '#dc2626'
                  return <div key={i} style={{ flex: 1, backgroundColor: bg }} />
                })}
              </div>
            </div>
            <span style={s.progressLabel}>{dragBlockResults.length + 1} / {DRAG_BLOCK_ROUNDS}</span>
          </div>
          {header}
          {roundVerb && (
            <ConjDragRound
              key={`${roundVerb.id}-${dragRound}`}
              verb={roundVerb}
              conjKey={tense.conjKey}
              onComplete={handleDragComplete}
              englishInline
            />
          )}
        </main>
      </div>
    )
  }

  if (phase === 'drag-summary') {
    return (
      <ConjResultsCard
        tenseLabel={tense.label}
        subLabel={SUB_LABEL[0]}
        stageNumber={1}
        cumulativeByKey={blockPronounCounts}
        sessionScore={null}
        onContinue={() => { setBlockPronounCounts(emptyPronounCounts()); loadUnit() }}
        onBack={back}
        backLabel={backLabel}
      />
    )
  }

  if (phase === 'session-summary') {
    return (
      <ConjResultsCard
        tenseLabel={tense.label}
        subLabel={subLabel}
        stageNumber={subStage + 1}
        cumulativeByKey={counts}
        sessionScore={{ correct: results.filter(r => r.correct).length, total: results.length }}
        onContinue={loadUnit}
        onBack={back}
        backLabel={backLabel}
      />
    )
  }

  if (!question) return null

  // Prompt line with the verb's English meaning inline in italics beside the infinitive.
  const verbLine = (
    <>{question.verb.spanish_infinitive} <span style={s.verbEng}>({question.verb.english})</span></>
  )
  const prompt = question.type === 'conj-typed-dual'
    ? (
      <div>
        <p style={s.word}>{question.englishPrompt}</p>
        <p style={s.verbLine}>{verbLine}</p>
      </div>
    )
    : <p style={s.word}>{question.form}  ·  {verbLine}</p>

  return (
    <div style={s.page}><NavBar />
      <main style={s.main}>
        <div style={s.progressRow}>
          <div style={s.progressBar}>
            <div style={{ display: 'flex', height: '100%' }}>
              {session.map((_, i) => {
                const r  = results[i]
                const bg = r ? (r.correct ? '#16a34a' : '#dc2626') : '#e5e5e5'
                return <div key={i} style={{ flex: 1, backgroundColor: bg }} />
              })}
            </div>
          </div>
          <span style={s.progressLabel}>{currentIdx + 1} / {session.length}</span>
        </div>
        {header}
        <ConjQuestionCard
          question={question}
          phase={phase}
          prompt={prompt}
          isLast={currentIdx + 1 >= session.length}
          selectedOpt={selectedOpt}
          matchResult={matchResult}
          f1Ok={f1Ok} f2Ok={f2Ok} f3Ok={f3Ok}
          typedAnswer={typedAnswer}   setTypedAnswer={setTypedAnswer}
          typedAnswer2={typedAnswer2} setTypedAnswer2={setTypedAnswer2}
          typedAnswer3={typedAnswer3} setTypedAnswer3={setTypedAnswer3}
          inputRef={inputRef} inputRef2={inputRef2} inputRef3={inputRef3}
          onMC={handleMC}
          onCheck={handleTyped}
          onNext={handleNext}
        />
        <p style={s.passNote}>Pass: {CONJ_PASS_PER_PRONOUN} correct for every pronoun.</p>
      </main>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: {
    position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
    overflow: 'hidden', backgroundColor: '#f8f8f6',
    fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column',
  },
  scrollPage: { minHeight: '100vh', backgroundColor: '#f8f8f6', fontFamily: 'system-ui, sans-serif' },
  scrollMain: {
    maxWidth: '600px', margin: '0 auto', padding: '0.5rem 1.5rem 3rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', boxSizing: 'border-box',
  },
  main: {
    maxWidth: '600px', margin: '0 auto', padding: '0.5rem 1.5rem 2rem',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    width: '100%', boxSizing: 'border-box', overflowY: 'auto', flex: 1,
    WebkitOverflowScrolling: 'touch',
  },
  loadingMsg: { padding: '3rem 2rem', textAlign: 'center', color: '#888' },
  backBtn: { padding: '0.35rem 0', fontSize: '0.875rem', color: '#555', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start' },
  card: {
    backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '12px',
    padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem',
  },
  unitHeader: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  phaseRow: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.25rem 0' },
  tenseTag: {
    fontSize: '0.68rem', fontWeight: 700, color: '#3b82f6',
    backgroundColor: '#eff6ff', padding: '0.2rem 0.5rem',
    borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
  },
  unitName:  { fontSize: '0.85rem', fontWeight: 600, color: '#333' },
  subTag:    { fontSize: '0.78rem', color: '#888', fontWeight: 500 },
  ruleText:  { margin: 0, fontSize: '0.8rem', color: '#777', lineHeight: 1.4 },
  saveError: { margin: 0, fontSize: '0.8rem', color: '#c00' },
  progressRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.25rem 0' },
  progressBar: { flex: 1, height: '6px', backgroundColor: '#e5e5e5', borderRadius: '3px', overflow: 'hidden' },
  progressLabel: { margin: 0, fontSize: '0.8rem', color: '#888', flexShrink: 0, minWidth: '32px', textAlign: 'right' },
  word:     { margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111' },
  verbLine: { margin: '0.35rem 0 0', fontSize: '1rem', fontWeight: 600, color: '#555' },
  verbEng:  { fontSize: '0.9rem', fontWeight: 400, fontStyle: 'italic', color: '#999' },
  passNote: { margin: '0.25rem 0 0', fontSize: '0.72rem', color: '#aaa', textAlign: 'center' },
}
