// Curated launch spots, always shown. Community-submitted spots (fetched from
// /api/spots once approved) are merged in alongside these at the App level.
export const OFFICIAL_SPOTS = [
  {
    id: 'se-bdemakaska',
    name: 'SE Bde Maka Ska',
    lat: 44.934344,
    lon: -93.308645,
    sectors: [[245, 360], [0, 25]],
    description: 'Works N, NW, or W',
  },
  {
    id: 'n-bdemakaska',
    name: 'North Bde Maka Ska',
    lat: 44.9490395,
    lon: -93.3139819,
    sectors: [[110, 250]],
    description: 'Works SW, S, or SE',
  },
  {
    id: 'waconia',
    name: 'Waconia',
    lat: 44.872499,
    lon: -93.759354,
    sectors: [[300, 360], [0, 30]],
    description: 'Beginner-friendly \u2014 best with west component',
  },
  {
    id: 'wisconsin-point',
    name: 'Point Wisconsin',
    lat: 46.7051173,
    lon: -92.0099167,
    sectors: [[20, 70]],
    description: 'Bay side \u2014 works with NE wind',
  },
  {
    id: 'father-hennepin',
    name: 'Father Hennepin',
    lat: 46.14472,
    lon: -93.48806,
    sectors: [[290, 340]],
    description: 'Advanced only \u2014 little shallow water, best on strong NW',
  },
  {
    id: 'pepin-roadside-park',
    name: 'Lake Pepin \u2013 Roadside Park',
    lat: 44.4696,
    lon: -92.2908,
    sectors: [[112.5, 202.5]],
    description:
      'Likely the wayside near Hok-Si-La Park, just north of Lake City on Hwy 61 (first lake view coming from the north). Favors a southerly wind component. Note: due-south wind on Pepin turns extremely gusty with downdrafts off the bluffs, even though direction alone reads as workable \u2014 use caution.',
  },
  {
    id: 'pepin-the-point-lake-city',
    name: 'Lake Pepin \u2013 The Point (Lake City)',
    lat: 44.449564,
    lon: -92.263131,
    sectors: [[67.5, 112.5], [157.5, 202.5], [292.5, 337.5]],
    description:
      'Small parking lot at the end of the point jutting out from the Lake City marina, about 15 ft above the water. Outside the point: real swell. Inside (leeward): glassy, calmer water, good for long jibes. No facilities right at the point; downtown Lake City is a few blocks away. As with the rest of Pepin, be cautious of due-south wind \u2014 gusty with bluff downdrafts.',
  },
  {
    id: 'pepin-marina-wi',
    name: 'Lake Pepin \u2013 Pepin Marina (WI)',
    lat: 44.4381705,
    lon: -92.1460796,
    sectors: [[247.5, 337.5]],
    description:
      'Cross the river at Red Wing, then head south along the Wisconsin shore. Solid rigging area and launch right at the marina. As with the rest of Pepin, watch for river current pulling you downstream if anything goes wrong.',
  },
];
