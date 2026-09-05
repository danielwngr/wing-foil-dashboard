// Turns stored [lo, hi] degree sectors back into readable compass names for
// display (the reverse of the compass-point-to-sector conversion the
// submission form does). Falls back to raw degrees if nothing named matches.
const COMPASS_POINTS = [
  ['N', 0], ['NNE', 22.5], ['NE', 45], ['ENE', 67.5],
  ['E', 90], ['ESE', 112.5], ['SE', 135], ['SSE', 157.5],
  ['S', 180], ['SSW', 202.5], ['SW', 225], ['WSW', 247.5],
  ['W', 270], ['WNW', 292.5], ['NW', 315], ['NNW', 337.5],
];

function inSectorRange(deg, lo, hi) {
  return lo <= hi ? deg >= lo && deg <= hi : deg >= lo || deg <= hi;
}

export function sectorsToLabel(sectors) {
  if (!Array.isArray(sectors) || !sectors.length) return '\u2014';
  const names = COMPASS_POINTS.filter(([, deg]) => sectors.some(([lo, hi]) => inSectorRange(deg, lo, hi))).map(([name]) => name);
  if (names.length) return names.join(', ');
  return sectors.map(([lo, hi]) => `${Math.round(lo)}\u00b0\u2013${Math.round(hi)}\u00b0`).join(', ');
}
