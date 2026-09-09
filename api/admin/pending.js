export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method not allowed');
  }

  if (req.headers['x-admin-pass'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server is missing Supabase configuration.' });
  }

  try {
    const [pendingRes, allRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/spots?status=eq.pending&select=*&order=created_at.asc`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      }),
      // Unfiltered, minimal-column query purely for diagnostics -- lets us
      // see what the server-side connection actually sees in the table,
      // regardless of the status filter, without exposing full rows.
      fetch(`${SUPABASE_URL}/rest/v1/spots?select=id,name,status,created_at&order=created_at.desc&limit=20`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      }),
    ]);

    if (!pendingRes.ok) {
      const body = await pendingRes.text();
      throw new Error(`supabase read failed (${pendingRes.status}): ${body.slice(0, 200)}`);
    }
    const data = await pendingRes.json();

    let debugAllRows = null;
    if (allRes.ok) {
      debugAllRows = await allRes.json();
    } else {
      debugAllRows = { error: `unfiltered query failed (${allRes.status}): ${(await allRes.text()).slice(0, 200)}` };
    }

    return res.status(200).json({ pending: data, debugAllRows });
  } catch (err) {
    return res.status(500).json({ error: `Could not load pending spots: ${err.message || err}` });
  }
}
