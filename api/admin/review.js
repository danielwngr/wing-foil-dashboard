export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method not allowed');
  }

  if (req.headers['x-admin-pass'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id, action } = req.body || {};
  if (!id || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Invalid request.' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server is missing Supabase configuration.' });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/spots?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`supabase update failed (${r.status}): ${body.slice(0, 200)}`);
    }
    const data = await r.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: `Could not update spot status: ${err.message || err}` });
  }
}
