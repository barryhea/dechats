import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import NavBar from '../components/NavBar'
import { PATH_SECTIONS, unitStatus, nextUpUnit, loadPathOverview } from '../utils/verbPath'
import { loadReviewSummary, loadStreak, displayStreak, formatDay } from '../utils/verbReview'

// Verb Trainer home (/verbs): the verb learning Path. Lists all 18 units from
// verb_units in sort_order, grouped Present → Future → Past. Every unit is open.
// Status comes only from the shared unitStatus helper; "Next up" is the first
// unmastered unit in sort_order. A Daily Review card shows items due today (or
// "All caught up" with the next due date), unit rows carry an "N due" badge, and
// the current streak is shown. Loading the Path also backfills review items for
// any mastered unit that has none. Data is refetched every time this screen is
// navigated to (CLAUDE.md Rule 3).

export default function VerbTrainer() {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const [data,   setData]   = useState(null)   // { units, verbCounts, progressByUnit }
  const [error,  setError]  = useState('')
  const [review, setReview] = useState(null)   // review summary | { error }
  const [streak, setStreak] = useState(null)   // user_verb_streak row | null

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    loadPathOverview(user.id)
      .then(d => {
        if (cancelled) return
        setError(''); setData(d)
        // Review + streak load after the Path so a failure there never hides the units.
        loadReviewSummary(user.id, d.progressByUnit)
          .then(r => { if (!cancelled) setReview(r) })
          .catch(e => { if (!cancelled) setReview({ error: e.message }) })
        loadStreak(user.id)
          .then(r => { if (!cancelled) setStreak(r) })
          .catch(e => console.warn('[path] streak load failed:', e.message))
      })
      .catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [user?.id, location.key])

  const openUnit = id => navigate(`/verb-path/${id}`)

  if (error) {
    return (
      <div style={s.page}><NavBar />
        <main style={s.main}><p style={s.errorMsg}>{error}</p></main>
      </div>
    )
  }
  if (!data) return <div style={s.page}><NavBar /><p style={s.loadingMsg}>Loading…</p></div>

  const { units, verbCounts, progressByUnit } = data
  const nextUp   = nextUpUnit(units, progressByUnit)
  const mastered = units.filter(u => unitStatus(progressByUnit[u.id]).kind === 'mastered').length
  const streakDays = displayStreak(streak)
  const dueByUnit  = review?.dueByUnit ?? {}

  let reviewLine
  if (!review) reviewLine = 'Checking what is due…'
  else if (review.error) reviewLine = 'Could not load reviews right now.'
  else if (review.dueCount > 0) reviewLine = `${review.dueCount} ${review.dueCount === 1 ? 'item' : 'items'} due today`
  else if (review.nextDueOn) reviewLine = `All caught up · next review ${formatDay(review.nextDueOn)}`
  else if (review.totalItems > 0) reviewLine = 'All caught up'
  else reviewLine = 'Master a unit to start reviewing it'
  const reviewDue = (review?.dueCount ?? 0) > 0

  return (
    <div style={s.page}>
      <NavBar />
      <main style={s.main}>
        <header style={s.header}>
          <h1 style={s.title}>Verb Path</h1>
          <p style={s.subtitle}>{units.length} units, one pattern at a time · {mastered} of {units.length} mastered</p>
          <p style={s.streak} data-streak={streakDays}>
            🔥 {streakDays}-day streak{streak?.longest_streak ? ` · best ${streak.longest_streak}` : ''}
          </p>
        </header>

        {nextUp ? (
          <button style={s.continueBtn} onClick={() => openUnit(nextUp.id)}>
            <span style={s.continueLabel}>Continue: {nextUp.id} · {nextUp.pattern_name}</span>
            <span style={s.continueChevron}>›</span>
          </button>
        ) : (
          <div style={s.allDone}>Every unit is mastered. ¡Enhorabuena!</div>
        )}

        <button
          data-review-card
          style={{ ...s.reviewCard, ...(reviewDue ? s.reviewCardDue : {}) }}
          onClick={() => navigate('/verb-review')}
        >
          <span style={s.reviewIcon}>🔁</span>
          <span style={s.reviewText}>
            <span style={s.reviewTitle}>Daily Review</span>
            <span data-review-line style={{ ...s.reviewSub, ...(reviewDue ? s.reviewSubDue : {}) }}>{reviewLine}</span>
          </span>
          <span style={s.chevron}>›</span>
        </button>

        {PATH_SECTIONS.map(section => {
          const sectionUnits = units.filter(u => u.tense === section.tense)
          if (!sectionUnits.length) return null
          const doneHere = sectionUnits.filter(u => unitStatus(progressByUnit[u.id]).kind === 'mastered').length
          return (
            <section key={section.tense} style={s.section}>
              <div style={s.sectionHead}>
                <h2 style={s.sectionTitle}>{section.title}</h2>
                <span style={s.sectionMeta}>{doneHere} / {sectionUnits.length} mastered</span>
              </div>
              <div style={s.list}>
                {sectionUnits.map(u => {
                  const st     = unitStatus(progressByUnit[u.id])
                  const isNext = nextUp?.id === u.id
                  return (
                    <button
                      key={u.id}
                      data-unit={u.id}
                      style={{ ...s.row, ...(isNext ? s.rowNext : st.kind === 'mastered' ? s.rowMastered : {}) }}
                      onClick={() => openUnit(u.id)}
                    >
                      <span style={{ ...s.code, color: st.color, backgroundColor: st.bg, borderColor: st.border }}>{u.id}</span>
                      <span style={s.rowBody}>
                        <span style={s.rowTop}>
                          <span style={s.pattern}>{u.pattern_name}</span>
                          {isNext && <span style={s.nextTag}>Next up</span>}
                          {dueByUnit[u.id] > 0 && <span data-due={dueByUnit[u.id]} style={s.dueTag}>{dueByUnit[u.id]} due</span>}
                        </span>
                        <span style={s.rowMeta}>
                          {verbCounts[u.id] ?? 0} {(verbCounts[u.id] ?? 0) === 1 ? 'verb' : 'verbs'}
                          <span style={s.metaSep}>·</span>
                          <span data-status={st.kind} style={{ ...s.status, color: st.color }}>
                            <span style={{ ...s.statusDot, backgroundColor: st.color }} />
                            {st.label}
                          </span>
                        </span>
                      </span>
                      <span style={s.chevron}>›</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}

        <button style={s.dictBtn} onClick={() => navigate('/verb-dictionary')}>
          <span style={s.dictBtnIcon}>📖</span>
          <span style={s.dictBtnText}>
            <span style={s.dictBtnLabel}>Verb Dictionary</span>
            <span style={s.dictBtnSub}>All 70 verbs with conjugations</span>
          </span>
          <span style={s.chevron}>›</span>
        </button>
      </main>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', backgroundColor: '#f8f8f6', fontFamily: 'system-ui, sans-serif', overflowX: 'hidden' },
  main: {
    maxWidth: '600px', margin: '0 auto', padding: '1rem 1rem 3rem',
    display: 'flex', flexDirection: 'column', gap: '1.25rem', boxSizing: 'border-box', width: '100%',
  },
  loadingMsg: { padding: '3rem 2rem', textAlign: 'center', color: '#888' },
  errorMsg:   { color: '#c00', margin: '1rem 0' },
  header:   { display: 'flex', flexDirection: 'column', gap: '0.2rem', textAlign: 'left' },
  title:    { margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111' },
  subtitle: { margin: 0, fontSize: '0.85rem', color: '#777' },
  streak:   { margin: '0.15rem 0 0', fontSize: '0.85rem', fontWeight: 600, color: '#c2410c' },
  reviewCard: {
    display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', boxSizing: 'border-box',
    padding: '0.9rem 1rem', backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '12px',
    cursor: 'pointer', textAlign: 'left',
  },
  reviewCardDue: { border: '2px solid #7c3aed', backgroundColor: '#f5f3ff', boxShadow: '0 1px 6px rgba(124,58,237,0.18)' },
  reviewIcon:    { fontSize: '1.4rem', flexShrink: 0 },
  reviewText:    { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  reviewTitle:   { fontSize: '1rem', fontWeight: 700, color: '#111' },
  reviewSub:     { fontSize: '0.85rem', color: '#777', overflowWrap: 'anywhere' },
  reviewSubDue:  { color: '#6d28d9', fontWeight: 600 },
  dueTag: {
    fontSize: '0.65rem', fontWeight: 700, color: '#6d28d9', backgroundColor: '#ede9fe',
    padding: '0.12rem 0.45rem', borderRadius: '999px', flexShrink: 0,
  },
  continueBtn: {
    display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', boxSizing: 'border-box',
    padding: '1rem 1.1rem', border: 'none', borderRadius: '12px', cursor: 'pointer',
    backgroundColor: '#16a34a', color: '#fff', textAlign: 'left',
    boxShadow: '0 2px 8px rgba(22,163,74,0.25)',
  },
  continueLabel:   { flex: 1, minWidth: 0, fontSize: '1.05rem', fontWeight: 700, overflowWrap: 'anywhere' },
  continueChevron: { fontSize: '1.4rem', fontWeight: 700, flexShrink: 0 },
  allDone: {
    padding: '1rem', borderRadius: '12px', backgroundColor: '#f0fdf4', border: '1px solid #86efac',
    color: '#15803d', fontWeight: 600, textAlign: 'center',
  },
  section:      { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  sectionHead:  { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' },
  sectionTitle: { margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' },
  sectionMeta:  { fontSize: '0.75rem', color: '#999', flexShrink: 0 },
  list: { display: 'flex', flexDirection: 'column', gap: '0.45rem' },
  row: {
    display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', boxSizing: 'border-box',
    padding: '0.7rem 0.85rem', backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '10px',
    cursor: 'pointer', textAlign: 'left', minWidth: 0,
  },
  rowNext:     { border: '2px solid #2563eb', backgroundColor: '#eff6ff', boxShadow: '0 1px 6px rgba(37,99,235,0.18)' },
  rowMastered: { backgroundColor: '#fbfefb' },
  code: {
    flexShrink: 0, minWidth: '2.4rem', textAlign: 'center', padding: '0.3rem 0.4rem', borderRadius: '6px',
    border: '1px solid', fontSize: '0.8rem', fontWeight: 700, boxSizing: 'border-box',
  },
  rowBody: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  rowTop:  { display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', minWidth: 0 },
  pattern: { fontSize: '0.95rem', fontWeight: 600, color: '#111', overflowWrap: 'anywhere' },
  nextTag: {
    fontSize: '0.65rem', fontWeight: 700, color: '#fff', backgroundColor: '#2563eb',
    padding: '0.12rem 0.45rem', borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
  },
  rowMeta:   { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem', fontSize: '0.78rem', color: '#888' },
  metaSep:   { color: '#ccc' },
  status:    { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 },
  statusDot: { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 },
  chevron:   { fontSize: '1.2rem', color: '#bbb', flexShrink: 0 },
  dictBtn: {
    display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', boxSizing: 'border-box',
    padding: '0.875rem 1rem', background: '#fff', border: '1px solid #e5e5e5', borderRadius: '10px',
    cursor: 'pointer', textAlign: 'left', marginTop: '0.5rem',
  },
  dictBtnIcon:  { fontSize: '1.25rem', flexShrink: 0 },
  dictBtnText:  { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.1rem' },
  dictBtnLabel: { fontSize: '0.9rem', fontWeight: 600, color: '#111' },
  dictBtnSub:   { fontSize: '0.75rem', color: '#aaa' },
}
