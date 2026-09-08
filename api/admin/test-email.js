import { sendEmail } from '../_lib/mailer.js';
import { buildNotificationEmail } from '../_lib/notificationEmail.js';
import { describeWindow } from '../_lib/scoring.js';

// Sends a realistic sample notification email to whatever address the admin
// enters, using fabricated hourly data run through the real describeWindow()
// narrative logic -- this genuinely exercises the same code path production
// emails use, it just skips fetching a real forecast and real subscriber.

function fakeHours({ hour, count, speedStart, speedPeak, dir, tempStart, tempEnd, sky }) {
  const hours = [];
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0 : i / (count - 1);
    const peakT = 0.6; // peak roughly 60% through the window
    const rampUp = Math.min(1, t / peakT);
    // Only decays partway back down after the peak, so a genuinely building
    // day stays elevated through to the end of the window rather than
    // symmetrically returning all the way to the start value.
    const rampDown = t <= peakT ? 1 : 1 - 0.3 * ((t - peakT) / (1 - peakT));
    const shape = t <= peakT ? rampUp : rampDown;
    const speed = speedStart + (speedPeak - speedStart) * shape;
    hours.push({
      hour: hour + i,
      dir,
      speed,
      gust: speed + 7,
      temp: tempStart + (tempEnd - tempStart) * t,
      sky,
    });
  }
  return hours;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method not allowed');
  }
  if (req.headers['x-admin-pass'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.status(500).json({ error: 'Server is missing GMAIL_USER / GMAIL_APP_PASSWORD.' });
  }
  const SITE_URL = process.env.SITE_URL;
  if (!SITE_URL) {
    return res.status(500).json({ error: 'Server is missing SITE_URL.' });
  }

  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required.' });
  }

  try {
    const windowGo = fakeHours({ hour: 10, count: 11, speedStart: 12, speedPeak: 19, dir: 315, tempStart: 63, tempEnd: 68, sky: 'sunny' });
    const windowMarginal = fakeHours({ hour: 9, count: 3, speedStart: 9, speedPeak: 11, dir: 0, tempStart: 59, tempEnd: 61, sky: 'cloudy' });
    const windowFuture = fakeHours({ hour: 12, count: 9, speedStart: 14, speedPeak: 16, dir: 270, tempStart: 65, tempEnd: 65, sky: 'sunny' });

    const dayBlocks = [
      {
        dateStr: 'today',
        dayLabel: 'Today (sample)',
        isToday: true,
        spots: [
          { name: 'SE Bde Maka Ska', score: 'good', narrative: describeWindow(windowGo) },
          { name: 'Waconia', score: 'marginal', narrative: describeWindow(windowMarginal) },
        ],
      },
      {
        dateStr: 'future',
        dayLabel: 'Fri, Sep 11 (sample)',
        isToday: false,
        spots: [{ name: 'Lake Pepin \u2013 Roadside Park', score: 'good', narrative: describeWindow(windowFuture) }],
      },
    ];

    const manageUrl = `${SITE_URL}/#manage?token=test`;
    const { subject, html, text } = buildNotificationEmail({ dayBlocks, manageUrl, siteUrl: SITE_URL });

    await sendEmail({ to: email, subject: `[TEST] ${subject}`, html, text });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: `Could not send test email: ${err.message || err}` });
  }
}
