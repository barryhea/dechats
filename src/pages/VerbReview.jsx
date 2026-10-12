import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import NavBar from '../components/NavBar'
import ConjQuestionCard from '../components/ConjQuestionCard'
import { PRONOUNS, buildFullConjQuestion, checkDualAnswer } from '../utils/arConjugation'
import { sectionForTense } from '../utils/verbPath'
import {
  loadReviewSession, saveReviewAnswer, recordStreakActivity, loadDueTomorrowCount, scheduleAnswer,
  formatDay, REVIEW_SESSION_SIZE,
} from '../utils/verbReview'

// Daily Review (/verb-review): the spaced-repetition session of the verb learning
// Path. Serves up to 20 due items from user_review_items (lowest box first, then
// oldest due date; never the same verb + pronoun twice in a row) as typed Full
// Conjugation questions (English → Spanish) through the shared ConjQuestionCard.
// Each answer reschedules its item (Leitner, see verbReview.js); finishing the
// session counts as a day of activity for user_verb_streak. Reads and writes only
// the Path tables (plus the read-only hidden flag).

const TENSE_TAG = {
  1: { bg: '#eff6ff', color: '#2563eb' },
  2: { bg: '#fff7ed', color: '#c2410c' },
  3: { bg: '#f5f3ff', color: '#7c3aed' },
}

function questionFor(item) {
  const pronoun = PRONOUNS.find(p => p.key === item.pronoun)
  const section = sectionForTense(item.unit.tense)
  return { ...buildFullConjQuestion(item.verb, pronoun, section.conjKey), item, tenseTitle: section.title }
}

export default function VerbReview() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [phase,      setPhase]      = useState('loading')   // loading | error | empty | question | feedback | done
  const [errorMsg,   setErrorMsg]   = useState('')
  const [saveError,  setSaveError]  = useState(false)
  const [session,    setSession]    = useState([])
  const [summary,    setSummary]    = useState(null)
  const [idx,        setIdx]        = useState(0)
  const [results,    setResults]    = useState([])          // { correct, movedUp }
  const [endStats,   setEndStats]   = useState(null)        // { dueTomorrow, streak }
  const [typedAnswer,  setTypedAnswer]  = useState('')
  const [typedAnswer2, setTypedAnswer2] = useState('')
  const [typedAnswer3, setTypedAnswer3] = useState('')
  const [matchResult,  setMatchResult]  = useState(null)
  const [f1Ok, setF1Ok] = useState(null)
  const [f2Ok, setF2Ok] = useState(null)
  const [f3Ok, setF3Ok] = useState(null)

  const pendingSaves = useRef([])
  const inputRef  = useRef(null)
  const inputRef2 = useRef(null)
  const inputRef3 = useRef(null)

  const question = session[idx] ?? null

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    loadReviewSession(user.id)
      .then(({ items, summary: sum }) => {
        if (cancelled) return
        setSummary(sum)
        setSession(items.map(questionFor))
        setPhase(items.length ? 'question' : 'empty')
      })
      .catch(e => { if (!cancelled) { setErrorMsg(e.message); setPhase('error') } })
    return () => { cancelled = true }
  }, [user?.id])

  useEffect(() => {
    if (phase === 'question') inputRef.current?.focus({ preventScroll: true })
  }, [question, phase])

  function resetAnswer() {
    setTypedAnswer(''); setTypedAnswer2(''); setTypedAnswer3('')
    setMatchResult(null)
    setF1Ok(null); setF2Ok(null); setF3Ok(null)
  }

  function handleCheck() {
    if (phase !== 'question') return
    const { result, f1Ok: ok1, f2Ok: ok2, f3Ok: ok3, correct } =
      checkDualAnswer(question, typedAnswer, typedAnswer2, typedAnswer3)
    const item = question.item
    const save = saveReviewAnswer(item, correct)
      .catch(e => { console.warn('[review] save failed:', e.message); setSaveError(true); return null })
    pendingSaves.current.push(save)
    const newBox = scheduleAnswer(item, correct).box
    setResults(r => [...r, { correct, movedUp: correct && newBox > item.box }])
    setF1Ok(ok1); setF2Ok(ok2); setF3Ok(ok3)
    setMatchResult(result)
    setPhase('feedback')
    if (question.tripleInput) {
      if (!ok1) { setTypedAnswer(''); setTypedAnswer2('') }
      if (!ok3) setTypedAnswer3('')
    } else {
      if (!ok1) setTypedAnswer('')
      if (!ok2) setTypedAnswer2('')
    }
  }

  async function finish() {
    setPhase('done')
    await Promise.all(pendingSaves.current)
    let streak = null, dueTomorrow = null
    try { streak = await recordStreakActivity(user.id) }
    catch (e) { console.warn('[review] streak save failed:', e.message); setSaveError(true) }
    try { dueTomorrow = await loadDueTomorrowCount(user.id) }
    catch (e) { console.warn('[review] due-tomorrow count failed:', e.message) }
    setEndStats({ dueTomorrow, streak: streak?.current_streak ?? null })
  }

  function handleNext() {
    if (idx + 1 >= session.length) { finish(); return }
    setIdx(idx + 1)
    resetAnswer()
    setPhase('question')
  }

  const toPath = () => navigate('/verbs')
  const dictButton = (
    <button style={s.dictBtn} onClick={() => navigate('/verb-dictionary')}>
      <span style={s.dictBtnIcon}>📖</span>
      <span style={s.dictBtnText}>
        <span style={s.dictBtnLabel}>Verb Dictionary</span>
        <span style={s.dictBtnSub}>All 70 verbs with conjugations</span>
      </span>
      <span style={s.chevron}>›</span>
    </button>
  )

  if (phase === 'loading') return <div style={s.page}><NavBar /><p style={s.loadingMsg}>Loading…</p></div>

  if (phase === 'error' || phase === 'empty') {
    const nothingYet = phase === 'empty' && !summary?.totalItems
    return (
      <div style={s.page}><NavBar />
        <main style={s.main}>
          <h1 style={s.title}>Daily Review</h1>
          <div style={s.card} data-review-empty>
            {phase === 'error' ? <p style={s.errorMsg}>{errorMsg}</p>
              : nothingYet ? <p style={s.bodyText}>Nothing to review yet. Master a unit on the Path and its verbs join Daily Review the next day.</p>
              : (
                <>
                  <p style={s.bigText}>All caught up</p>
                  {summary?.nextDueOn && <p style={s.bodyText}>Next review: <strong>{formatDay(summary.nextDueOn)}</strong></p>}
                </>
              )}
          </div>
          <button style={s.primaryBtn} onClick={toPath}>Back to Verb Path</button>
          {dictButton}
        </main>
      </div>
    )
  }

  if (phase === 'done') {
    const correct = results.filter(r => r.correct).length
    const movedUp = results.filter(r => r.movedUp).length
    return (
      <div style={s.page}><NavBar />
        <main style={s.main}>
          <h1 style={s.title}>Daily Review done</h1>
          <div style={s.card} data-review-done>
            <p style={s.bigText}>{correct} / {results.length} correct</p>
            <div style={s.statGrid}>
              <div style={s.stat}><span style={s.statNum} data-stat="moved-up">{movedUp}</span><span style={s.statLabel}>moved up a box</span></div>
              <div style={s.stat}><span style={s.statNum} data-stat="due-tomorrow">{endStats?.dueTomorrow ?? '…'}</span><span style={s.statLabel}>due tomorrow</span></div>
              {endStats?.streak != null && (
                <div style={s.stat}><span style={s.statNum} data-stat="streak">🔥 {endStats.streak}</span><span style={s.statLabel}>day streak</span></div>
              )}
            </div>
            {saveError && <p style={s.saveError}>Some answers could not be saved. Check your connection.</p>}
          </div>
          <button style={s.primaryBtn} onClick={toPath}>Back to Verb Path</button>
          {dictButton}
        </main>
      </div>
    )
  }

  const tag = TENSE_TAG[question.item.unit.tense]
  const prompt = (
    <div>
      <span data-tense style={{ ...s.tenseTag, backgroundColor: tag.bg, color: tag.color }}>{question.tenseTitle}</span>
      <p style={s.word}>{question.englishPrompt}</p>
      <p style={s.verbLine}>
        {question.verb.spanish_infinitive} <span style={s.verbEng}>({question.verb.english})</span>
      </p>
    </div>
  )

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
          <span style={s.progressLabel}>{idx + 1} / {session.length}</span>
        </div>
        <div style={s.headRow}>
          <span style={s.headTitle}>Daily Review</span>
          <span style={s.headMeta}>Box {question.item.box} · {question.item.unit.id}</span>
        </div>
        {saveError && <p style={s.saveError}>Some answers could not be saved. Check your connection.</p>}
        <ConjQuestionCard
          question={question}
          phase={phase}
          prompt={prompt}
          isLast={idx + 1 >= session.length}
          selectedOpt={null}
          matchResult={matchResult}
          f1Ok={f1Ok} f2Ok={f2Ok} f3Ok={f3Ok}
          typedAnswer={typedAnswer}   setTypedAnswer={setTypedAnswer}
          typedAnswer2={typedAnswer2} setTypedAnswer2={setTypedAnswer2}
          typedAnswer3={typedAnswer3} setTypedAnswer3={setTypedAnswer3}
          inputRef={inputRef} inputRef2={inputRef2} inputRef3={inputRef3}
          onMC={() => {}}
          onCheck={handleCheck}
          onNext={handleNext}
        />
        <p style={s.note}>Up to {REVIEW_SESSION_SIZE} items a day · correct moves an item up a box, wrong sends it back to box 0.</p>
      </main>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', backgroundColor: '#f8f8f6', fontFamily: 'system-ui, sans-serif', overflowX: 'hidden' },
  main: {
    maxWidth: '600px', margin: '0 auto', padding: '0.75rem 1rem 3rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem', boxSizing: 'border-box', width: '100%',
  },
  loadingMsg: { padding: '3rem 2rem', textAlign: 'center', color: '#888' },
  errorMsg:   { margin: 0, color: '#c00' },
  saveError:  { margin: 0, fontSize: '0.8rem', color: '#c00' },
  title:      { margin: '0.5rem 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#111', textAlign: 'left' },
  card: {
    backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '12px',
    padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left',
  },
  bigText:  { margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#111' },
  bodyText: { margin: 0, fontSize: '0.95rem', color: '#444', lineHeight: 1.45 },
  statGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' },
  stat: {
    flex: '1 1 90px', display: 'flex', flexDirection: 'column', gap: '0.15rem',
    padding: '0.65rem 0.75rem', backgroundColor: '#f8f8f6', borderRadius: '8px',
  },
  statNum:   { fontSize: '1.3rem', fontWeight: 700, color: '#111' },
  statLabel: { fontSize: '0.75rem', color: '#777' },
  primaryBtn: {
    width: '100%', padding: '0.9rem 1rem', fontSize: '1.05rem', fontWeight: 700, color: '#fff',
    backgroundColor: '#16a34a', border: 'none', borderRadius: '12px', cursor: 'pointer',
  },
  dictBtn: {
    display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', boxSizing: 'border-box',
    padding: '0.875rem 1rem', background: '#fff', border: '1px solid #e5e5e5', borderRadius: '10px',
    cursor: 'pointer', textAlign: 'left',
  },
  dictBtnIcon:  { fontSize: '1.25rem', flexShrink: 0 },
  dictBtnText:  { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.1rem' },
  dictBtnLabel: { fontSize: '0.9rem', fontWeight: 600, color: '#111' },
  dictBtnSub:   { fontSize: '0.75rem', color: '#aaa' },
  chevron:      { fontSize: '1.2rem', color: '#bbb', flexShrink: 0 },
  progressRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.25rem 0' },
  progressBar: { flex: 1, height: '6px', backgroundColor: '#e5e5e5', borderRadius: '3px', overflow: 'hidden' },
  progressLabel: { margin: 0, fontSize: '0.8rem', color: '#888', flexShrink: 0, minWidth: '32px', textAlign: 'right' },
  headRow:   { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' },
  headTitle: { fontSize: '0.95rem', fontWeight: 700, color: '#111' },
  headMeta:  { fontSize: '0.75rem', color: '#999' },
  tenseTag: {
    display: 'inline-block', fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.45rem',
    borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem',
  },
  word:     { margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111' },
  verbLine: { margin: '0.35rem 0 0', fontSize: '1rem', fontWeight: 600, color: '#555' },
  verbEng:  { fontSize: '0.9rem', fontWeight: 400, fontStyle: 'italic', color: '#999' },
  note:     { margin: '0.25rem 0 0', fontSize: '0.72rem', color: '#aaa', textAlign: 'center' },
}
