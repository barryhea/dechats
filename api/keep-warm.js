// Vercel Cron target — keeps the shared Supabase project (tixqwvtgqolvxjrtrntd)
// from auto-pausing after a period of inactivity.
//
// Runs on the schedule in vercel.json. Issues one lightweight authenticated
// read against dechats.verbs, which is publicly readable under RLS
// ("Verbs are publicly readable"), so the anon key is sufficient.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({
      ok: false,
      error: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY',
    })
  }

  const startedAt = Date.now()

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/verbs?select=id&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          // dechats is not the default (public) schema, so PostgREST needs
          // to be told which schema to read from.
          'Accept-Profile': 'dechats',
        },
      }
    )

    const body = await response.text()

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: `Supabase responded ${response.status}`,
        detail: body.slice(0, 200),
      })
    }

    return res.status(200).json({
      ok: true,
      pinged: 'dechats.verbs',
      durationMs: Date.now() - startedAt,
      at: new Date().toISOString(),
    })
  } catch (err) {
    return res.status(502).json({ ok: false, error: String(err) })
  }
}
