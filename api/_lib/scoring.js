// Shared scoring + narrative-generation logic for server-side notification
// code (the daily cron and the manual admin test-send).
//
// The scoring rules below are intentionally a minimal, self-contained
// duplicate of the same rules in src/Dashboard.jsx (12-28mph sustained =
// good, 9-11 or 29+ or under-9-with-gust-over-20 = marginal, wrong direction
// or heavy rain always overrides to none, daylight hours only). It's
// duplicated rather than imported because this runs in a separate serverless
// context, and re-using Dashboard.jsx directly would mean pulling in
// React/browser-only code. If the scoring thresholds ever change on the
// dashboard, they need to change here too.

export const DAYLIGHT_START = 6;
export const DAYLIGHT_END = 20;
export const isDaylightHour = (h) => h >= DAYLIGHT_START && h <= DAYLIGHT_END;

export function inSector(dir, sectors) {
  return sectors.some(([a, b]) => (a <= b ? dir >= a && dir <= b : dir >= a || dir <= b));
}

export function scoreHour(spot, hour) {
  if (!inSector(hour.dir, spot.sectors)) return 'none';
  if (hour.rain > 60) return 'none';
  const speed = hour.speed;
  if (speed >= 12 && speed <= 28) return 'good';
  if (speed >= 9 && speed <= 11) return 'marginal';
  if (speed >= 29) return 'marginal';
  if (hour.gust > 20) return 'marginal';
  return 'none';
}

export function weatherCodeToRainFlag(code) {
  return [65, 67, 82, 95, 96, 99].includes(code);
}

export function weatherCodeToSky(code) {
  if (weatherCodeToRainFlag(code)) return 'rain';
  if ([0, 1].includes(code)) return 'sunny';
  return 'cloudy';
}

// 'YYYY-MM-DD' for a given date, in Central time -- accurate for all our
// current MN/WI spots. If spots outside that timezone are ever added, this
// would need to become per-spot instead of a single hardcoded zone.
export function chicagoDateStr(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return chicagoDateStr(d);
}

export function friendlyDayLabel(dateStr, todayStr) {
  if (dateStr === todayStr) return 'Today';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export function compassLabel(deg) {
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return COMPASS_POINTS[idx];
}

function circularMeanDeg(degs) {
  const x = degs.reduce((s, d) => s + Math.cos((d * Math.PI) / 180), 0);
  const y = degs.reduce((s, d) => s + Math.sin((d * Math.PI) / 180), 0);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

function friendlyHour(h) {
  if (h === 12) return 'noon';
  const period = h < 12 ? 'am' : 'pm';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${period}`;
}

// Finds the longest contiguous run of hours meeting `threshold` ('good' or
// 'good_and_marginal') -- the same "best window" concept the dashboard
// itself shows next to each day. Requires at least 2 hours to count as a
// real window, matching the dashboard's own "at least 2 good hours" bar for
// a day to be worth highlighting.
export function findBestWindow(hours, threshold) {
  const qualifies = (h) => (threshold === 'good_and_marginal' ? h.score === 'good' || h.score === 'marginal' : h.score === 'good');
  let best = null;
  let start = null;
  for (let i = 0; i <= hours.length; i++) {
    const ok = i < hours.length && qualifies(hours[i]);
    if (ok && start === null) start = i;
    if (!ok && start !== null) {
      const len = i - start;
      if (!best || len > best.len) best = { start, end: i - 1, len };
      start = null;
    }
  }
  if (!best || best.len < 2) return null;
  return hours.slice(best.start, best.end + 1);
}

// Builds a natural-language description of a best window: whether wind is
// building, steady, or tapering, the speed/gust/temp ranges, predominant
// direction, and sky -- this is what actually shows up in the email.
export function describeWindow(windowHours) {
  const speeds = windowHours.map((h) => h.speed);
  const gusts = windowHours.map((h) => h.gust);
  const temps = windowHours.map((h) => h.temp);
  const dirs = windowHours.map((h) => h.dir);

  const speedMin = Math.round(Math.min(...speeds));
  const speedMax = Math.round(Math.max(...speeds));
  const gustMin = Math.round(Math.min(...gusts));
  const gustMax = Math.round(Math.max(...gusts));
  const tempMin = Math.round(Math.min(...temps));
  const tempMax = Math.round(Math.max(...temps));
  const dir = compassLabel(circularMeanDeg(dirs));

  const skyCounts = {};
  windowHours.forEach((h) => {
    skyCounts[h.sky] = (skyCounts[h.sky] || 0) + 1;
  });
  const sky = Object.entries(skyCounts).sort((a, b) => b[1] - a[1])[0][0];
  const skyWord = { sunny: 'sunny', cloudy: 'cloudy', rain: 'rain in the mix' }[sky] || 'mixed skies';

  let trendPhrase;
  const isFlat = speedMax - speedMin < 4;
  if (windowHours.length <= 2 || isFlat) {
    trendPhrase = `Steady around ${speedMin} to ${speedMax} mph out of the ${dir}`;
  } else {
    const peakIdx = speeds.indexOf(Math.max(...speeds));
    const peakHour = windowHours[peakIdx].hour;
    const thirdLen = Math.max(1, Math.ceil(speeds.length / 3));
    const firstAvg = speeds.slice(0, thirdLen).reduce((a, b) => a + b, 0) / thirdLen;
    const lastAvg = speeds.slice(-thirdLen).reduce((a, b) => a + b, 0) / thirdLen;

    if (lastAvg > firstAvg + 2 && peakIdx >= windowHours.length / 2) {
      trendPhrase = `Building through the day, sustained wind climbs from ${speedMin} to ${speedMax} mph out of the ${dir}, peaking around ${friendlyHour(peakHour)}`;
    } else if (firstAvg > lastAvg + 2 && peakIdx <= windowHours.length / 2) {
      trendPhrase = `Starts strong around ${speedMax} mph out of the ${dir}, easing to ${speedMin} by the end of the window`;
    } else {
      trendPhrase = `Ranges ${speedMin} to ${speedMax} mph out of the ${dir}, peaking around ${friendlyHour(peakHour)}`;
    }
  }

  const tempPhrase = tempMin === tempMax ? `${tempMin}\u00b0F` : `${tempMin} to ${tempMax}\u00b0F`;
  return `${trendPhrase}, gusting ${gustMin} to ${gustMax}. ${tempPhrase}, ${skyWord}.`;
}
