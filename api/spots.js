export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server is missing Supabase configuration.' });
  }

  if (req.method === 'GET') {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/spots?status=eq.approved&select=*`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      if (!r.ok) throw new Error('supabase read failed');
      const data = await r.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Could not load community spots.' });
    }
  }

  if (req.method === 'POST') {
    const { name, lat, lon, sectors, description } = req.body || {};
    if (
      !name ||
      typeof name !== 'string' ||
      typeof lat !== 'number' ||
      typeof lon !== 'number' ||
      !Array.isArray(sectors) ||
      !sectors.length
    ) {
      return res.status(400).json({ error: 'Missing or invalid fields.' });
    }
    try {
      // status is always forced to 'pending' here, regardless of what the
      // client sends -- this is the only path that writes new spot rows, and
      // it never accepts an 'approved' status from the request body.
      const r = await fetch(`${SUPABASE_URL}/rest/v1/spots`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify([{ name, lat, lon, sectors, description: description || null, status: 'pending' }]),
      });
      if (!r.ok) throw new Error('supabase insert failed');
      const data = await r.json();
      return res.status(201).json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Could not submit spot.' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end('Method not allowed');
}
