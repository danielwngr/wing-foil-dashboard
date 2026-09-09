import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method not allowed');
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server is missing Supabase configuration.' });
  }

  const { email, spot_ids, threshold, lookahead_days } = req.body || {};

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required.' });
  }
  // SMS isn't wired up -- enforced here too, not just left to the UI, so a
  // stray request can't create a phone-only or text-only subscriber.
  const safeMethods = ['email'];
  const safeSpotIds = Array.isArray(spot_ids) ? spot_ids : [];
  const safeThreshold = threshold === 'good_and_marginal' ? 'good_and_marginal' : 'good';
  const safeLookahead = [1, 3, 5, 7].includes(lookahead_days) ? lookahead_days : 3;

  try {
    const lookup = await fetch(
      `${SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email)}&select=id,token`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (!lookup.ok) {
      const body = await lookup.text();
      throw new Error(`lookup failed (${lookup.status}): ${body.slice(0, 200)}`);
    }
    const existing = await lookup.json();

    if (existing.length) {
      // Same email resubscribing (or editing without their management link
      // handy) -- update their existing row in place rather than creating a
      // confusing second, duplicate subscription with a different token.
      const r = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?id=eq.${existing[0].id}`, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          phone: null,
          methods: safeMethods,
          spot_ids: safeSpotIds,
          threshold: safeThreshold,
          lookahead_days: safeLookahead,
          active: true, // resubmitting the form implies renewed interest, even if previously unsubscribed
        }),
      });
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`supabase update failed (${r.status}): ${body.slice(0, 200)}`);
      }
      return res.status(200).json({ ok: true, updated: true });
    }

    // A private, unguessable token included in every notification email --
    // this is how someone edits their preferences or unsubscribes later,
    // without needing an account or password.
    const token = crypto.randomUUID();

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
        phone: null,
        methods: safeMethods,
        spot_ids: safeSpotIds,
        threshold: safeThreshold,
        lookahead_days: safeLookahead,
        token,
        active: true,
      }]),
    });
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`supabase insert failed (${r.status}): ${body.slice(0, 200)}`);
    }
    return res.status(201).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: `Could not save preferences: ${err.message || err}` });
  }
}
