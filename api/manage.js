export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server is missing Supabase configuration.' });
  }

  if (req.method === 'GET') {
    const { token } = req.query || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Missing token.' });
    }
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?token=eq.${encodeURIComponent(token)}&select=*`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`lookup failed (${r.status}): ${body.slice(0, 200)}`);
      }
      const rows = await r.json();
      if (!rows.length) return res.status(404).json({ error: 'Subscription not found. The link may be out of date.' });
      return res.status(200).json(rows[0]);
    } catch (err) {
      return res.status(500).json({ error: `Could not load subscription: ${err.message || err}` });
    }
  }

  if (req.method === 'POST') {
    const { token, action, ...updates } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Missing token.' });
    }

    try {
      if (action === 'unsubscribe') {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?token=eq.${encodeURIComponent(token)}`, {
          method: 'PATCH',
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ active: false }),
        });
        if (!r.ok) {
          const body = await r.text();
          throw new Error(`unsubscribe failed (${r.status}): ${body.slice(0, 200)}`);
        }
        const data = await r.json();
        if (!data.length) return res.status(404).json({ error: 'Subscription not found.' });
        return res.status(200).json({ ok: true });
      }

      // Only these fields are editable, and only these values are valid --
      // never trust the request body directly into the database.
      const allowed = { active: true }; // saving preferences implicitly resubscribes
      if (Array.isArray(updates.spot_ids)) allowed.spot_ids = updates.spot_ids;
      // SMS isn't wired up -- enforced here too, not left to the UI.
      allowed.methods = ['email'];
      if (updates.threshold === 'good' || updates.threshold === 'good_and_marginal') allowed.threshold = updates.threshold;
      if ([1, 3, 5, 7].includes(updates.lookahead_days)) allowed.lookahead_days = updates.lookahead_days;
      // Phone/SMS support was removed -- no longer accepting phone updates.

      const r = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?token=eq.${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(allowed),
      });
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`update failed (${r.status}): ${body.slice(0, 200)}`);
      }
      const data = await r.json();
      if (!data.length) return res.status(404).json({ error: 'Subscription not found.' });
      return res.status(200).json(data[0]);
    } catch (err) {
      return res.status(500).json({ error: `Could not update subscription: ${err.message || err}` });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end('Method not allowed');
}
