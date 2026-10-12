import NavBar from './NavBar'
import { PRONOUNS, CONJ_PASS_PER_PRONOUN } from '../utils/arConjugation'

// The ONE results-card rendering path for every conjugation sub-stage (Drag &
// Match, Multiple Choice, Pronoun, Full Conjugation) in both conjugation engines
// (VerbArTenseQuiz and VerbUnitQuiz). Each pronoun is shown as cumulative-correct-
// toward-five with a uniform denominator of 5 and dots reflecting that same
// cumulative count. `cumulativeByKey` holds the persisted cumulative correct count
// per pronoun key; `sessionScore` (optional) is the just-completed run's tally,
// shown separately as the session result.
export default function ConjResultsCard({
  tenseLabel, subLabel, stageNumber, cumulativeByKey, sessionScore,
  onContinue, onBack, backLabel = '← Back to Verb Trainer',
}) {
  const rows = PRONOUNS.map(p => ({
    label: p.label,
    cumulative: Math.min(cumulativeByKey[p.key] ?? 0, CONJ_PASS_PER_PRONOUN),
  }))
  return (
    <div style={s.page}><NavBar />
      <main style={{ ...s.main, maxWidth: '560px' }}>
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span style={s.tenseTag}>{tenseLabel}</span>
            <span style={s.subTagSm}>Stage {stageNumber} · {subLabel}</span>
          </div>
          {sessionScore && (
            <>
              <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0.5rem 0 0.1rem', color: '#111' }}>
                {sessionScore.correct} / {sessionScore.total} correct
              </p>
              <p style={{ fontSize: '0.72rem', color: '#aaa', margin: '0 0 0.85rem' }}>This session's result</p>
            </>
          )}
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', margin: `${sessionScore ? 0 : '0.5rem'} 0 0.45rem` }}>
            Progress to graduation · 5 correct per pronoun
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {rows.map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '90px', fontSize: '0.85rem', color: '#555', flexShrink: 0 }}>
                  {row.label}
                </span>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{
                      width: '10px', height: '10px', borderRadius: '50%', boxSizing: 'border-box', flexShrink: 0,
                      backgroundColor: i < row.cumulative ? '#16a34a' : 'transparent',
                      border: `2px solid ${i < row.cumulative ? '#16a34a' : '#d1d5db'}`,
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: '0.75rem', color: '#aaa', flexShrink: 0 }}>
                  {row.cumulative} / 5
                </span>
              </div>
            ))}
          </div>
        </div>
        <button style={{ ...s.primaryBtn, width: '100%' }} onClick={onContinue}>Continue</button>
        <button style={s.blueBtn} onClick={onBack}>{backLabel}</button>
      </main>
    </div>
  )
}

const s = {
  page: {
    position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
    overflow: 'hidden', backgroundColor: '#f8f8f6',
    fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column',
  },
  main: {
    maxWidth: '600px', margin: '0 auto', padding: '0.5rem 1.5rem 2rem',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    width: '100%', boxSizing: 'border-box', overflowY: 'auto', flex: 1,
    WebkitOverflowScrolling: 'touch',
  },
  card: {
    backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '12px',
    padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem',
  },
  tenseTag: {
    fontSize: '0.68rem', fontWeight: 700, color: '#3b82f6',
    backgroundColor: '#eff6ff', padding: '0.2rem 0.5rem',
    borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
  },
  subTagSm:   { fontSize: '0.72rem', color: '#999', fontWeight: 400 },
  primaryBtn: { padding: '0.75rem 1.25rem', fontSize: '1rem', fontWeight: 600, backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' },
  blueBtn:    { padding: '0.75rem 1.25rem', fontSize: '1rem', fontWeight: 600, backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', width: '100%', textAlign: 'center' },
}
