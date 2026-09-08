import { OFFICIAL_SPOTS } from '../../src/spotData.js';
import { sendEmail } from '../_lib/mailer.js';
import { buildNotificationEmail } from '../_lib/notificationEmail.js';
import {
  isDaylightHour,
  scoreHour,
  weatherCodeToRainFlag,
  weatherCodeToSky,
  chicagoDateStr,
  addDays,
  friendlyDayLabel,
  findBestWindow,
  describeWindow,
} from '../_lib/scoring.js';

// Runs once a day (see vercel.json). For every active subscriber, checks
// whether any of their chosen spots newly qualify (per their threshold)
// within their chosen lookahead window, and emails a day-grouped digest
// with a plain-language description of each qualifying window.

async function fetchSpotHourlyByDate(spot) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lon}` +
    `&hourly=temperature_2m,windspeed_10m,winddirection_10m,windgusts_10m,weathercode` +
    `&windspeed_unit=mph&temperature_unit=fahrenheit&timezone=auto&forecast_days=9`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`forecast fetch failed (${res.status})`);
  const data = await res.json();
  const h = data.hourly;
  const byDate = {};
  h.time.forEach((t, i) => {
    const [datePart, timePart] = t.split('T');
    const hourNum = parseInt(timePart.slice(0, 2), 10);
    if (!isDaylightHour(hourNum)) return;
    const speed = h.windspeed_10m[i];
    const dir = h.winddirection_10m[i];
    if (speed == null || dir == null) return;
    const gust = h.windgusts_10m[i] ?? speed;
    const temp = h.temperature_2m[i] ?? null;
    const rain = weatherCodeToRainFlag(h.weathercode[i] ?? 0) ? 100 : 0;
    const sky = weatherCodeToSky(h.weathercode[i] ?? 0);
    const score = scoreHour(spot, { speed, dir, gust, rain });
    if (!byDate[datePart]) byDate[datePart] = [];
    byDate[datePart].push({ hour: hourNum, dir, speed, gust, temp, sky, score });
  });
  Object.values(byDate).forEach((hours) => hours.sort((a, b) => a.hour - b.hour));
  return byDate; // { 'YYYY-MM-DD': [{ hour, dir, speed, gust, temp, sky, score }] }
}

export default async function handler(req, res) {
  // Vercel Cron sends this automatically when CRON_SECRET is set, matching
  // Vercel's own documented convention -- this just stops anyone else from
  // triggering sends by hitting the URL directly.
  if (process.env.CRON_SECRET) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SITE_URL = process.env.SITE_URL;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server is missing Supabase configuration.' });
  }
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.status(500).json({
      error:
        'Server is missing GMAIL_USER / GMAIL_APP_PASSWORD. Enable 2-Step Verification on the sending Gmail ' +
        'account, generate an App Password under Google Account -> Security -> App passwords, and set both env vars.',
    });
  }
  if (!SITE_URL) {
    return res.status(500).json({ error: 'Server is missing SITE_URL (needed for manage-subscription links).' });
  }

  try {
    const approvedRes = await fetch(`${SUPABASE_URL}/rest/v1/spots?status=eq.approved&select=*`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const approvedSpots = approvedRes.ok ? await approvedRes.json() : [];
    const allSpots = [...OFFICIAL_SPOTS, ...approvedSpots];
    const spotsById = Object.fromEntries(allSpots.map((s) => [s.id, s]));

    const subsRes = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?active=eq.true&select=*`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!subsRes.ok) throw new Error(`subscribers fetch failed (${subsRes.status})`);
    const subscribers = await subsRes.json();

    if (!subscribers.length) {
      return res.status(200).json({ ok: true, subscribers: 0, emailsSent: 0 });
    }

    // Only fetch forecasts for spots someone actually subscribed to, and
    // only once per spot regardless of how many subscribers chose it.
    const neededSpotIds = new Set();
    subscribers.forEach((s) => (s.spot_ids || []).forEach((id) => neededSpotIds.add(id)));

    const spotHourlyByDate = {};
    await Promise.all(
      Array.from(neededSpotIds).map(async (id) => {
        const spot = spotsById[id];
        if (!spot) return;
        try {
          spotHourlyByDate[id] = await fetchSpotHourlyByDate(spot);
        } catch (err) {
          spotHourlyByDate[id] = {};
        }
      })
    );

    const today = chicagoDateStr(new Date());
    let emailsSent = 0;

    for (const sub of subscribers) {
      const spotIds = Array.isArray(sub.spot_ids) ? sub.spot_ids : [];
      const byDate = {}; // dateStr -> [{ name, score, narrative }]

      for (const spotId of spotIds) {
        const spot = spotsById[spotId];
        const hourlyByDate = spotHourlyByDate[spotId];
        if (!spot || !hourlyByDate) continue;

        for (let offset = 0; offset < (sub.lookahead_days || 3); offset++) {
          const dateStr = addDays(today, offset);
          const hours = hourlyByDate[dateStr];
          if (!hours) continue;

          const window = findBestWindow(hours, sub.threshold);
          if (!window) continue;

          // Dedup: try to record (subscriber, spot, date) as already-sent.
          // return=representation + ignore-duplicates means the response
          // body only contains the row if this insert was genuinely new --
          // an empty array means we've already notified about this exact
          // match before, so skip it.
          const dedupRes = await fetch(`${SUPABASE_URL}/rest/v1/notifications_sent`, {
            method: 'POST',
            headers: {
              apikey: SERVICE_KEY,
              Authorization: `Bearer ${SERVICE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation,resolution=ignore-duplicates',
            },
            body: JSON.stringify([{ subscriber_email: sub.email, spot_id: spotId, forecast_date: dateStr }]),
          });
          if (!dedupRes.ok) continue;
          const inserted = await dedupRes.json();
          if (!inserted.length) continue;

          const score = window.some((h) => h.score === 'good') ? 'good' : 'marginal';
          const narrative = describeWindow(window);
          if (!byDate[dateStr]) byDate[dateStr] = [];
          byDate[dateStr].push({ name: spot.name, score, narrative });
        }
      }

      const dayBlocks = Object.keys(byDate)
        .sort()
        .map((dateStr) => ({
          dateStr,
          dayLabel: friendlyDayLabel(dateStr, today),
          isToday: dateStr === today,
          spots: byDate[dateStr],
        }));

      if (dayBlocks.length && Array.isArray(sub.methods) && sub.methods.includes('email')) {
        const manageUrl = `${SITE_URL}/#manage?token=${sub.token}`;
        const { subject, html, text } = buildNotificationEmail({ dayBlocks, manageUrl, siteUrl: SITE_URL });
        try {
          await sendEmail({ to: sub.email, subject, html, text });
          emailsSent++;
        } catch (err) {
          console.error(`Gmail send failed for ${sub.email}: ${err.message || err}`);
        }
      }
      // Text/SMS sending isn't implemented -- 'text' preference, if present
      // on older rows, currently has no effect.
    }

    return res.status(200).json({ ok: true, subscribers: subscribers.length, emailsSent });
  } catch (err) {
    return res.status(500).json({ error: `Notification run failed: ${err.message || err}` });
  }
}
