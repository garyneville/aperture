export interface LongRangeLocation {
  name: string;
  lat: number;
  lon: number;
  region: Region;
  elevation: number;
  tags: LocationTag[];
  darkSky: boolean;
}

export type LocationTag = 'upland' | 'coastal' | 'woodland' | 'waterfall' | 'lake' | 'valley' | 'moorland' | 'ruin' | 'viaduct' | 'cliff';

export type Region =
  | 'yorkshire-dales'
  | 'peak-district'
  | 'lake-district'
  | 'north-york-moors'
  | 'northumberland'
  | 'snowdonia'
  | 'brecon-beacons'
  | 'scottish-borders';

/** Correction factor per region: straight-line distance × factor ≈ realistic drive time. */
export const REGION_DRIVE_FACTORS: Record<Region, number> = {
  'yorkshire-dales':   0.85,
  'peak-district':     0.85,
  'lake-district':     0.70,
  'north-york-moors':  0.85,
  'northumberland':    0.75,
  'snowdonia':         0.65,
  'brecon-beacons':    0.70,
  'scottish-borders':  0.75,
};

/** Leeds coordinates for distance calculation. */
const LEEDS_LAT = 53.82703;
const LEEDS_LON = -1.570755;
const EARTH_RADIUS_KM = 6371;
const MAX_DRIVE_HOURS = 4;
const AVG_SPEED_KMH = 80;

/** Haversine straight-line distance in km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Estimated drive time in minutes from Leeds, applying regional correction. */
export function estimatedDriveMins(loc: LongRangeLocation): number {
  const straightKm = haversineKm(LEEDS_LAT, LEEDS_LON, loc.lat, loc.lon);
  const factor = REGION_DRIVE_FACTORS[loc.region];
  const effectiveSpeedKmh = AVG_SPEED_KMH * factor;
  return Math.round((straightKm / effectiveSpeedKmh) * 60);
}

/** Returns true if estimated drive is within the 4-hour limit. */
export function isWithinDriveLimit(loc: LongRangeLocation): boolean {
  return estimatedDriveMins(loc) <= MAX_DRIVE_HOURS * 60;
}

export const LONG_RANGE_LOCATIONS: LongRangeLocation[] = [
  // ── Yorkshire Dales (8) ──────────────────────────────────────────────
  { name: 'Pen-y-ghent',           lat: 54.155, lon: -2.265, region: 'yorkshire-dales', elevation: 694, tags: ['upland'], darkSky: false },
  { name: 'Malham Tarn',           lat: 54.097, lon: -2.165, region: 'yorkshire-dales', elevation: 375, tags: ['lake', 'upland'], darkSky: true },
  { name: 'Ribblehead Viaduct',    lat: 54.201, lon: -2.368, region: 'yorkshire-dales', elevation: 320, tags: ['viaduct', 'valley'], darkSky: false },
  { name: 'Aysgarth Falls',        lat: 54.305, lon: -1.930, region: 'yorkshire-dales', elevation: 190, tags: ['waterfall', 'woodland'], darkSky: false },
  { name: 'Gordale Scar',          lat: 54.073, lon: -2.136, region: 'yorkshire-dales', elevation: 290, tags: ['cliff', 'waterfall'], darkSky: false },
  { name: 'Ingleborough',          lat: 54.171, lon: -2.374, region: 'yorkshire-dales', elevation: 723, tags: ['upland', 'moorland'], darkSky: true },
  { name: 'Hardraw Force',         lat: 54.323, lon: -2.174, region: 'yorkshire-dales', elevation: 260, tags: ['waterfall', 'valley'], darkSky: false },
  { name: 'Buckden Pike',          lat: 54.213, lon: -2.058, region: 'yorkshire-dales', elevation: 702, tags: ['upland', 'valley'], darkSky: false },

  // ── Peak District (7) ────────────────────────────────────────────────
  { name: 'Kinder Scout',          lat: 53.386, lon: -1.873, region: 'peak-district', elevation: 636, tags: ['upland', 'moorland'], darkSky: false },
  { name: 'Mam Tor',               lat: 53.352, lon: -1.804, region: 'peak-district', elevation: 517, tags: ['upland', 'valley'], darkSky: false },
  { name: 'Stanage Edge',          lat: 53.367, lon: -1.628, region: 'peak-district', elevation: 458, tags: ['cliff', 'upland'], darkSky: false },
  { name: 'Dovedale',              lat: 53.063, lon: -1.762, region: 'peak-district', elevation: 200, tags: ['valley', 'waterfall'], darkSky: false },
  { name: 'Ladybower Reservoir',   lat: 53.394, lon: -1.712, region: 'peak-district', elevation: 205, tags: ['lake', 'woodland'], darkSky: false },
  { name: 'Curbar Edge',           lat: 53.280, lon: -1.602, region: 'peak-district', elevation: 340, tags: ['cliff', 'upland'], darkSky: false },
  { name: 'Chrome Hill',           lat: 53.177, lon: -1.858, region: 'peak-district', elevation: 425, tags: ['upland'], darkSky: false },

  // ── Lake District (8) ────────────────────────────────────────────────
  { name: 'Langdale Pikes',        lat: 54.459, lon: -3.098, region: 'lake-district', elevation: 736, tags: ['upland', 'valley'], darkSky: false },
  { name: 'Wastwater',             lat: 54.436, lon: -3.284, region: 'lake-district', elevation: 60, tags: ['lake', 'upland'], darkSky: true },
  { name: 'Ullswater',             lat: 54.577, lon: -2.870, region: 'lake-district', elevation: 145, tags: ['lake', 'valley'], darkSky: false },
  { name: 'Helvellyn',             lat: 54.527, lon: -3.015, region: 'lake-district', elevation: 950, tags: ['upland'], darkSky: false },
  { name: 'Derwentwater',          lat: 54.574, lon: -3.142, region: 'lake-district', elevation: 75, tags: ['lake', 'woodland'], darkSky: false },
  { name: 'Buttermere',            lat: 54.539, lon: -3.271, region: 'lake-district', elevation: 100, tags: ['lake', 'valley'], darkSky: false },
  { name: 'Castlerigg Stone Circle', lat: 54.603, lon: -3.098, region: 'lake-district', elevation: 210, tags: ['upland', 'ruin'], darkSky: true },
  { name: 'Tarn Hows',             lat: 54.381, lon: -3.040, region: 'lake-district', elevation: 230, tags: ['lake', 'woodland'], darkSky: false },

  // ── North York Moors (5) ─────────────────────────────────────────────
  { name: 'Sutton Bank',           lat: 54.241, lon: -1.218, region: 'north-york-moors', elevation: 303, tags: ['cliff', 'upland'], darkSky: true },
  { name: 'Roseberry Topping',     lat: 54.506, lon: -1.107, region: 'north-york-moors', elevation: 320, tags: ['upland'], darkSky: false },
  { name: 'Goathland',             lat: 54.399, lon: -0.722, region: 'north-york-moors', elevation: 170, tags: ['waterfall', 'moorland'], darkSky: true },
  { name: 'Robin Hood\'s Bay',     lat: 54.434, lon: -0.533, region: 'north-york-moors', elevation: 5, tags: ['coastal', 'cliff'], darkSky: false },
  { name: 'Whitby Abbey',          lat: 54.488, lon: -0.607, region: 'north-york-moors', elevation: 60, tags: ['ruin', 'coastal'], darkSky: false },

  // ── Northumberland (5) ───────────────────────────────────────────────
  { name: 'Bamburgh Castle',       lat: 55.609, lon: -1.710, region: 'northumberland', elevation: 10, tags: ['coastal', 'ruin'], darkSky: false },
  { name: 'Dunstanburgh Castle',   lat: 55.491, lon: -1.594, region: 'northumberland', elevation: 25, tags: ['coastal', 'ruin'], darkSky: false },
  { name: 'Hadrian\'s Wall (Sycamore Gap)', lat: 55.003, lon: -2.366, region: 'northumberland', elevation: 270, tags: ['ruin', 'upland'], darkSky: true },
  { name: 'Kielder Forest',        lat: 55.233, lon: -2.588, region: 'northumberland', elevation: 380, tags: ['woodland', 'lake'], darkSky: true },
  { name: 'Holy Island',           lat: 55.681, lon: -1.799, region: 'northumberland', elevation: 5, tags: ['coastal', 'ruin'], darkSky: false },

  // ── Snowdonia (6) ────────────────────────────────────────────────────
  { name: 'Snowdon (Yr Wyddfa)',   lat: 53.069, lon: -4.076, region: 'snowdonia', elevation: 1085, tags: ['upland'], darkSky: false },
  { name: 'Tryfan',                lat: 53.120, lon: -4.002, region: 'snowdonia', elevation: 918, tags: ['upland', 'cliff'], darkSky: false },
  { name: 'Llyn Ogwen',            lat: 53.123, lon: -3.969, region: 'snowdonia', elevation: 310, tags: ['lake', 'upland'], darkSky: false },
  { name: 'Nant Gwynant',          lat: 53.044, lon: -4.010, region: 'snowdonia', elevation: 80, tags: ['lake', 'valley'], darkSky: false },
  { name: 'Llanberis Pass',        lat: 53.080, lon: -4.056, region: 'snowdonia', elevation: 360, tags: ['upland', 'valley'], darkSky: false },
  { name: 'Swallow Falls',         lat: 53.090, lon: -3.825, region: 'snowdonia', elevation: 120, tags: ['waterfall', 'woodland'], darkSky: false },

  // ── Brecon Beacons (5) ───────────────────────────────────────────────
  { name: 'Pen y Fan',             lat: 51.884, lon: -3.436, region: 'brecon-beacons', elevation: 886, tags: ['upland'], darkSky: true },
  { name: 'Sgwd yr Eira',          lat: 51.774, lon: -3.567, region: 'brecon-beacons', elevation: 190, tags: ['waterfall', 'woodland'], darkSky: false },
  { name: 'Llangorse Lake',        lat: 51.929, lon: -3.262, region: 'brecon-beacons', elevation: 150, tags: ['lake'], darkSky: true },
  { name: 'Sugar Loaf',            lat: 51.861, lon: -3.064, region: 'brecon-beacons', elevation: 596, tags: ['upland', 'valley'], darkSky: false },
  { name: 'Fan y Big',             lat: 51.881, lon: -3.393, region: 'brecon-beacons', elevation: 719, tags: ['upland', 'moorland'], darkSky: true },

  // ── Scottish Borders (4) ─────────────────────────────────────────────
  { name: 'Grey Mare\'s Tail',     lat: 55.401, lon: -3.288, region: 'scottish-borders', elevation: 290, tags: ['waterfall', 'upland'], darkSky: false },
  { name: 'St Abb\'s Head',        lat: 55.911, lon: -2.138, region: 'scottish-borders', elevation: 60, tags: ['coastal', 'cliff'], darkSky: false },
  { name: 'Scott\'s View',         lat: 55.579, lon: -2.680, region: 'scottish-borders', elevation: 250, tags: ['valley', 'upland'], darkSky: false },
  { name: 'Galloway Forest',       lat: 55.126, lon: -4.465, region: 'scottish-borders', elevation: 400, tags: ['woodland', 'lake'], darkSky: true },
];
