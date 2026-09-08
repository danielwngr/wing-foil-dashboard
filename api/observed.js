// Fetches recent observed wind readings from a NOAA/NWS ground station via
// the free, keyless api.weather.gov service. Used to draw an "observed"
// comparison line on today's chart, for hours that have already happened.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method not allowed');
  }

  const { station } = req.query;
  if (!station || typeof station !== 'string' || !/^[A-Z0-9]{3,5}$/.test(station)) {
    return res.status(400).json({ error: 'Missing or invalid station id.' });
  }

  try {
    const r = await fetch(`https://api.weather.gov/stations/${station}/observations?limit=48`, {
      headers: {
        'User-Agent': '(wing-foil-dashboard, contact@example.com)',
        Accept: 'application/geo+json',
      },
    });
    if (!r.ok) throw new Error(`nws request failed (${r.status})`);
    const data = await r.json();

    const readings = (data.features || [])
      .map((f) => {
        const p = f.properties || {};
        const speedMs = p.windSpeed && p.windSpeed.value;
        const gustMs = p.windGust && p.windGust.value;
        const dirDeg = p.windDirection && p.windDirection.value;
        if (speedMs == null) return null;
        return {
          time: p.timestamp,
          speedMph: Math.round(speedMs * 2.23694 * 10) / 10,
          gustMph: gustMs != null ? Math.round(gustMs * 2.23694 * 10) / 10 : null,
          dir: dirDeg != null ? Math.round(dirDeg) : null,
        };
      })
      .filter(Boolean);

    return res.status(200).json({ readings });
  } catch (err) {
    return res.status(500).json({ error: 'Could not load station observations.' });
  }
}
