export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method not allowed');
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server is missing Supabase configuration.' });
  }

  const { email, phone, methods, spot_ids, threshold, lookahead_days } = req.body || {};

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required.' });
  }
  const safeMethods = Array.isArray(methods) && methods.length ? methods : ['email'];
  const safeSpotIds = Array.isArray(spot_ids) ? spot_ids : [];
  const safeThreshold = threshold === 'good_and_marginal' ? 'good_and_marginal' : 'good';
  const safeLookahead = [1, 3, 5, 7].includes(lookahead_days) ? lookahead_days : 3;

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/subscribers`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify([{
        email,
        phone: phone || null,
        methods: safeMethods,
        spot_ids: safeSpotIds,
        threshold: safeThreshold,
        lookahead_days: safeLookahead,
      }]),
    });
    if (!r.ok) throw new Error('supabase insert failed');
    return res.status(201).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Could not save preferences right now.' });
  }
}
