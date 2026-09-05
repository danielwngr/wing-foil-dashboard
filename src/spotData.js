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
];
