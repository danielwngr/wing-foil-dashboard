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
    const r = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const finalUrl = r.url || url;
    const text = await r.text();

    // Try a few coordinate patterns Google Maps embeds, roughly most to
    // least precise: exact pin, then map-center variants.
    const patterns = [
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /@(-?\d+\.\d+),(-?\d+\.\d+),/,
      /!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)/,
      /"latitude":(-?\d+\.\d+).*?"longitude":(-?\d+\.\d+)/s,
    ];

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
