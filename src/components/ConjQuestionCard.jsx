import {
  pronounConfirmOk, dualConfirmOk,
} from '../utils/arConjugation'

// The ONE question/feedback card for every conjugation question type, shared by
// both conjugation engines (VerbArTenseQuiz and VerbUnitQuiz): Multiple Choice
// (conj-mc), Pronoun typed (conj-typed-pron) and Full Conjugation typed
// (conj-typed-dual), with per-field green/locked vs red/editable feedback and the
// "fix it before Next" gate. Presentational only: the engine owns all state,
// scoring and progress, and passes the answer handlers in.
//
// `prompt` (optional node) replaces the default question.prompt heading, so an
// engine can render its own prompt line.
export default function ConjQuestionCard({
  question, phase, prompt, isLast,
  selectedOpt, matchResult, f1Ok, f2Ok, f3Ok,
  typedAnswer, setTypedAnswer, typedAnswer2, setTypedAnswer2, typedAnswer3, setTypedAnswer3,
  inputRef, inputRef2, inputRef3,
  onMC, onCheck, onNext,
}) {
  // Stage 4 per-field feedback state (recomputed each render)
  const isDualFb  = phase === 'feedback' && question?.type === 'conj-typed-dual'
  const f1Wrong   = isDualFb && f1Ok === false
  const f1Correct = isDualFb && f1Ok === true
  const f2Wrong   = isDualFb && f2Ok === false
  const f2Correct = isDualFb && f2Ok === true
  const f3Wrong   = isDualFb && f3Ok === false
  const f3Correct = isDualFb && f3Ok === true
  const dualInputStyle = (wrong, correct) => ({
    ...s.typedInput,
    ...(wrong   ? { borderColor: '#dc2626', borderWidth: 2 } : {}),
    ...(correct ? { borderColor: '#16a34a', borderWidth: 2, backgroundColor: '#16a34a', color: '#fff' } : {}),
  })

  const confirmOk = (() => {
    if (phase !== 'feedback' || !matchResult) return true
    if (matchResult !== 'wrong') return true
    if (question?.type === 'conj-typed-dual') {
      return dualConfirmOk(question, typedAnswer, typedAnswer2, typedAnswer3, f1Ok, f2Ok, f3Ok)
    }
    return pronounConfirmOk(question, typedAnswer, typedAnswer2)
  })()

  return (
    <div style={s.card}>
      {prompt ?? <p style={s.word}>{question.prompt}</p>}

      {/* Stage 2: MC — show conjugated form, pick subject pronoun */}
      {question.type === 'conj-mc' && (
        <div style={s.optionGrid}>
          {question.options.map(opt => {
            let bg = '#fff'
            if (phase === 'feedback') {
              if (opt === question.correct) bg = '#dcfce7'
              else if (opt === selectedOpt) bg = '#fee2e2'
            }
            return (
              <button
                key={opt}
                style={{ ...s.optionBtn, backgroundColor: bg }}
                onClick={() => phase === 'question' && onMC(opt)}
                disabled={phase === 'feedback'}
              >
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {/* Stage 3: typed pronoun — show form, type subject pronoun */}
      {question.type === 'conj-typed-pron' && (
        <div style={s.typedArea}>
          <input
            ref={inputRef}
            style={{ ...s.typedInput, ...(phase === 'feedback' && matchResult === 'wrong' ? { borderColor: '#3b82f6', borderWidth: 2 } : {}) }}
            type="text"
            value={typedAnswer}
            onChange={e => setTypedAnswer(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (phase === 'question') {
                  if (question.multiInput) inputRef2.current?.focus({ preventScroll: true })
                  else onCheck()
                } else if (phase === 'feedback' && matchResult === 'wrong' && confirmOk) onNext()
              }
            }}
            disabled={phase === 'feedback' && matchResult !== 'wrong'}
            placeholder={phase === 'feedback' && matchResult === 'wrong'
              ? (question.multiInput ? `${question.correctCandidates[0]}…` : 'Type the correct pronoun to continue…')
              : question.placeholder}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" data-form-type="other"
          />
          {question.multiInput && (
            <input
              ref={inputRef2}
              style={{ ...s.typedInput, ...(phase === 'feedback' && matchResult === 'wrong' ? { borderColor: '#3b82f6', borderWidth: 2 } : {}) }}
              type="text"
              value={typedAnswer2}
              onChange={e => setTypedAnswer2(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (phase === 'question') onCheck()
                  else if (phase === 'feedback' && matchResult === 'wrong' && confirmOk) onNext()
                }
              }}
              disabled={phase === 'feedback' && matchResult !== 'wrong'}
              placeholder={phase === 'feedback' && matchResult === 'wrong'
                ? `${question.correctCandidates[1]}…`
                : question.placeholder}
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" data-form-type="other"
            />
          )}
          {phase === 'question' && (
            <button
              style={{ ...s.typedBtn, backgroundColor: (typedAnswer.trim() || typedAnswer2.trim()) ? '#16a34a' : '#f59e0b', color: '#fff' }}
              onClick={onCheck}
            >
              {(typedAnswer.trim() || typedAnswer2.trim()) ? 'Check' : 'Pass'}
            </button>
          )}
        </div>
      )}

      {/* Stage 4: dual typed — per-field green/lock correct, red/editable wrong */}
      {question.type === 'conj-typed-dual' && (
        <div style={s.typedArea}>
          {/* Input 1: pronoun (or first of two pronouns for el/ella, ellos/ellas) */}
          <input
            ref={inputRef}
            style={dualInputStyle(f1Wrong, f1Correct)}
            type="text"
            value={typedAnswer}
            onChange={e => setTypedAnswer(e.target.value)}
            onFocus={() => { if (f1Wrong) setTypedAnswer('') }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (phase === 'question') inputRef2.current?.focus({ preventScroll: true })
                else if (phase === 'feedback' && matchResult === 'wrong' && confirmOk) onNext()
              }
            }}
            disabled={isDualFb && (matchResult !== 'wrong' || f1Correct)}
            placeholder={f1Wrong
              ? (question.tripleInput ? `${question.correctPronounCandidates[0]}…` : `Pronoun — ${question.correctPronoun}`)
              : (question.tripleInput ? 'First subject pronoun…' : 'Subject pronoun (e.g. yo)')}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" data-form-type="other"
          />
          {/* Input 2: second pronoun (tripleInput) or conjugation (non-tripleInput) */}
          <input
            ref={inputRef2}
            style={dualInputStyle(f2Wrong, f2Correct)}
            type="text"
            value={typedAnswer2}
            onChange={e => setTypedAnswer2(e.target.value)}
            onFocus={() => { if (f2Wrong) setTypedAnswer2('') }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (phase === 'question') {
                  if (question.tripleInput) inputRef3.current?.focus({ preventScroll: true })
                  else onCheck()
                } else if (phase === 'feedback' && matchResult === 'wrong' && confirmOk) onNext()
              }
            }}
            disabled={isDualFb && (matchResult !== 'wrong' || f2Correct)}
            placeholder={f2Wrong
              ? (question.tripleInput ? `${question.correctPronounCandidates[1]}…` : `Conjugation — ${question.correctConjugation}`)
              : (question.tripleInput ? 'Second subject pronoun…' : 'Conjugated verb (e.g. hablo)')}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" data-form-type="other"
          />
          {/* Input 3: conjugation (tripleInput only) */}
          {question.tripleInput && (
            <input
              ref={inputRef3}
              style={dualInputStyle(f3Wrong, f3Correct)}
              type="text"
              value={typedAnswer3}
              onChange={e => setTypedAnswer3(e.target.value)}
              onFocus={() => { if (f3Wrong) setTypedAnswer3('') }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (phase === 'question') onCheck()
                  else if (phase === 'feedback' && matchResult === 'wrong' && confirmOk) onNext()
                }
              }}
              disabled={isDualFb && (matchResult !== 'wrong' || f3Correct)}
              placeholder={f3Wrong
                ? `Conjugation — ${question.correctConjugation}`
                : 'Conjugated verb (e.g. habla)'}
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" data-form-type="other"
            />
          )}
          {phase === 'question' && (
            <button
              style={{ ...s.typedBtn, backgroundColor: (typedAnswer.trim() || typedAnswer2.trim() || typedAnswer3.trim()) ? '#16a34a' : '#f59e0b', color: '#fff' }}
              onClick={onCheck}
            >
              {(typedAnswer.trim() || typedAnswer2.trim() || typedAnswer3.trim()) ? 'Check' : 'Pass'}
            </button>
          )}
        </div>
      )}

      {phase === 'feedback' && (() => {
        const isMC      = question.type === 'conj-mc'
        const isDual    = question.type === 'conj-typed-dual'
        const isCorrect = isMC ? selectedOpt === question.correct : matchResult !== 'wrong'
        const bannerBg  = isMC
          ? (isCorrect ? '#dcfce7' : '#fee2e2')
          : (matchResult === 'exact' ? '#dcfce7' : matchResult === 'close' ? '#fef3c7' : '#fee2e2')
        const bannerColor = isMC
          ? (isCorrect ? '#16a34a' : '#dc2626')
          : (matchResult === 'exact' ? '#16a34a' : matchResult === 'close' ? '#d97706' : '#dc2626')

        let label
        if (isMC) {
          label = isCorrect ? 'Correct!' : `Incorrect — ${question.correct}`
        } else if (isDual) {
          const pronounLabel = question.tripleInput
            ? question.correctPronounCandidates.join(' / ')
            : question.correctPronoun
          if (matchResult === 'exact') label = 'Correct!'
          else if (matchResult === 'close') label = `Close — ${pronounLabel}  ·  ${question.correctConjugation}`
          else label = `Incorrect — ${pronounLabel}  ·  ${question.correctConjugation}`
        } else {
          const ans = question.multiInput
            ? question.correctCandidates.join(' · ')
            : (question.correct ?? question.correctCandidates?.[0] ?? '')
          if (matchResult === 'exact') label = 'Correct!'
          else if (matchResult === 'close') label = `Close — ${ans}`
          else label = `Incorrect — ${ans}`
        }

        return (
          <div style={{ ...s.feedbackBanner, backgroundColor: bannerBg }}>
            <span style={{ fontWeight: 600, color: bannerColor, fontSize: '0.95rem' }}>{label}</span>
            <button
              style={{ ...s.nextBtn, ...(confirmOk ? {} : { opacity: 0.35, cursor: 'not-allowed' }) }}
              onClick={confirmOk ? onNext : undefined}
              disabled={!confirmOk}
            >
              {isLast ? 'Finish' : 'Next →'}
            </button>
          </div>
        )
      })()}
    </div>  )
}

const s = {
  card: {
    backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '12px',
    padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem',
  },
  word: { margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111' },
  optionGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  optionBtn: {
    padding: '0.85rem 1rem', fontSize: '1rem', color: '#111',
    border: '1px solid #e5e5e5', borderRadius: '8px', cursor: 'pointer',
    textAlign: 'left', transition: 'background-color 0.15s',
  },
  typedArea: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  typedInput: { flex: 1, padding: '0.75rem 1rem', fontSize: '1rem', borderWidth: 1, borderStyle: 'solid', borderColor: '#ccc', borderRadius: '8px', outline: 'none' },
  typedBtn: { padding: '0.75rem 1.25rem', fontSize: '1rem', fontWeight: 600, border: 'none', borderRadius: '8px', cursor: 'pointer', width: '100%' },
  feedbackBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', borderRadius: '8px' },
  nextBtn: { padding: '0.5rem 1.25rem', fontSize: '0.9rem', fontWeight: 600, border: 'none', borderRadius: '6px', backgroundColor: '#111', color: '#fff', cursor: 'pointer' },
}
