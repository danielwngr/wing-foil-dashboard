// Resolves a Google Maps share link (including short links like
// maps.app.goo.gl/xxxx) into lat/lon by following redirects server-side --
// browsers can't do this reliably themselves due to CORS. Looks for the
// coordinate patterns Google Maps embeds in its resolved URLs.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method not allowed');
  }

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url.' });
  }

  try {
    const r = await fetch(url, { redirect: 'follow' });
    const finalUrl = r.url || url;
    const text = await r.text();

    // Try the most precise pattern first (exact pin), then a looser
    // fallback (map center, less precise but better than nothing).
    const patterns = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),(-?\d+\.\d+),/];

    let lat, lon;
    for (const re of patterns) {
      const m = finalUrl.match(re) || text.match(re);
      if (m) {
        lat = parseFloat(m[1]);
        lon = parseFloat(m[2]);
        break;
      }
    }

    if (lat === undefined || lon === undefined || Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.status(422).json({ error: "Couldn't find coordinates in that link." });
    }

    return res.status(200).json({ lat, lon });
  } catch (err) {
    return res.status(500).json({ error: "Couldn't resolve that link." });
  }
}
