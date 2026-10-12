import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import NavBar from '../components/NavBar'
import FilteredDictionaryModal from './FilteredDictionaryModal'
import { sectionForTense, unitStatus, loadPathUnit } from '../utils/verbPath'

// Verb learning Path unit page (/verb-path/:unitId), mobile-first. Shows the
// unit's pattern card (rule_text, example_forms), its status (from the shared
// unitStatus helper), its verbs excluding hidden ones with the unit tense's yo and
// él/ella forms, a Start/Continue button into the engine (/verb-unit/:unitId) and
// a "View verbs" button that opens the filtered Verb Dictionary. Refetched every
// time the page is navigated to (CLAUDE.md Rule 3), so returning from a session
// shows the new status.

export default function VerbPathUnit() {
  const { unitId } = useParams()
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()

  const [data,     setData]     = useState(null)   // { unit, verbs, hiddenCount, progress } | 'missing'
  const [error,    setError]    = useState('')
  const [showDict, setShowDict] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    loadPathUnit(user.id, unitId)
      .then(d => { if (!cancelled) { setError(''); setData(d ?? 'missing') } })
      .catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [user?.id, unitId, location.key])

  const back = (
    <button style={s.backBtn} onClick={() => navigate('/verbs')}>← Verb Path</button>
  )

  if (error || data === 'missing') {
    return (
      <div style={s.page}><NavBar />
        <main style={s.main}>
          {back}
          <p style={s.errorMsg}>{error || `There is no unit called "${unitId}".`}</p>
        </main>
      </div>
    )
  }
  if (!data) return <div style={s.page}><NavBar /><p style={s.loadingMsg}>Loading…</p></div>

  const { unit, verbs, hiddenCount, progress } = data
  const section = sectionForTense(unit.tense)
  const st      = unitStatus(progress)
  const examples = (unit.example_forms ?? '').split(',').map(x => x.trim()).filter(Boolean)
  const canStart = verbs.length > 0

  return (
    <div style={s.page}>
      <NavBar />
      <main style={s.main}>
        {back}

        <header style={s.header}>
          <div style={s.tagRow}>
            <span style={s.tenseTag}>{section?.title ?? ''}</span>
            <span data-status={st.kind} style={{ ...s.statusPill, color: st.color, backgroundColor: st.bg, borderColor: st.border }}>
              {st.label}
            </span>
          </div>
          <h1 style={s.title}>
            <span style={s.code}>{unit.id}</span> {unit.pattern_name}
          </h1>
        </header>

        <button
          style={{ ...s.startBtn, ...(canStart ? {} : s.startBtnDisabled) }}
          onClick={() => canStart && navigate(`/verb-unit/${unit.id}`)}
          disabled={!canStart}
        >
          {canStart ? `${st.action} ${unit.id}` : 'All verbs in this unit are hidden'}
        </button>

        <section style={s.card}>
          <h2 style={s.cardLabel}>The pattern</h2>
          <p style={s.rule}>{unit.rule_text}</p>
          {examples.length > 0 && (
            <div style={s.examples}>
              {examples.map(ex => <span key={ex} style={s.exampleChip}>{ex}</span>)}
            </div>
          )}
        </section>

        <section style={s.card}>
          <div style={s.verbsHead}>
            <h2 style={s.cardLabel}>Verbs ({verbs.length})</h2>
            <button style={s.viewBtn} onClick={() => setShowDict(true)} disabled={!verbs.length}>View verbs</button>
          </div>
          {hiddenCount > 0 && (
            <p style={s.hiddenNote}>{hiddenCount} hidden {hiddenCount === 1 ? 'verb' : 'verbs'} not shown or practised.</p>
          )}
          <ul style={s.verbList}>
            {verbs.map(v => {
              const forms = v[section?.conjKey] ?? {}
              return (
                <li key={v.id} data-verb={v.spanish_infinitive} style={s.verbRow}>
                  <div style={s.verbName}>
                    {v.spanish_infinitive} <span style={s.verbEng}>({v.english})</span>
                  </div>
                  <div style={s.forms}>
                    <span style={s.form}><span style={s.formPron}>yo</span> {forms.yo ?? '—'}</span>
                    <span style={s.form}><span style={s.formPron}>él/ella</span> {forms.el ?? '—'}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      </main>

      {showDict && (
        <FilteredDictionaryModal
          verbs={verbs}
          title={`${unit.id} · ${unit.pattern_name}`}
          onClose={() => setShowDict(false)}
        />
      )}
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', backgroundColor: '#f8f8f6', fontFamily: 'system-ui, sans-serif', overflowX: 'hidden' },
  main: {
    maxWidth: '600px', margin: '0 auto', padding: '0.75rem 1rem 3rem',
    display: 'flex', flexDirection: 'column', gap: '1rem', boxSizing: 'border-box', width: '100%',
  },
  loadingMsg: { padding: '3rem 2rem', textAlign: 'center', color: '#888' },
  errorMsg:   { color: '#c00', margin: 0 },
  backBtn: { padding: '0.35rem 0', fontSize: '0.875rem', color: '#555', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start' },
  header: { display: 'flex', flexDirection: 'column', gap: '0.45rem', textAlign: 'left' },
  tagRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  tenseTag: {
    fontSize: '0.68rem', fontWeight: 700, color: '#3b82f6', backgroundColor: '#eff6ff',
    padding: '0.2rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  statusPill: { fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: '999px', border: '1px solid' },
  title: { margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#111', lineHeight: 1.25, overflowWrap: 'anywhere' },
  code:  { color: '#888', fontWeight: 700 },
  startBtn: {
    width: '100%', padding: '0.9rem 1rem', fontSize: '1.05rem', fontWeight: 700, color: '#fff',
    backgroundColor: '#16a34a', border: 'none', borderRadius: '12px', cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(22,163,74,0.25)',
  },
  startBtnDisabled: { backgroundColor: '#d1d5db', boxShadow: 'none', cursor: 'not-allowed' },
  card: {
    backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '12px',
    padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', textAlign: 'left',
  },
  cardLabel: { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' },
  rule:      { margin: 0, fontSize: '1rem', color: '#222', lineHeight: 1.45 },
  examples:  { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  exampleChip: {
    fontSize: '0.9rem', fontWeight: 600, color: '#1d4ed8', backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.2rem 0.5rem',
  },
  verbsHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' },
  viewBtn: {
    padding: '0.4rem 0.8rem', fontSize: '0.85rem', fontWeight: 600, color: '#2563eb',
    backgroundColor: '#fff', border: '1px solid #bfdbfe', borderRadius: '8px', cursor: 'pointer', flexShrink: 0,
  },
  hiddenNote: { margin: 0, fontSize: '0.78rem', color: '#999' },
  verbList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' },
  verbRow:  { display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.55rem 0', borderTop: '1px solid #f0f0f0' },
  verbName: { fontSize: '0.95rem', fontWeight: 600, color: '#111', overflowWrap: 'anywhere' },
  verbEng:  { fontSize: '0.85rem', fontWeight: 400, fontStyle: 'italic', color: '#999' },
  forms:    { display: 'flex', flexWrap: 'wrap', gap: '0.35rem 1rem', fontSize: '0.9rem', color: '#333' },
  form:     { whiteSpace: 'nowrap' },
  formPron: { fontSize: '0.75rem', color: '#999', marginRight: '0.15rem' },
}
