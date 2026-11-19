const BORAIL_CLOCK = globalThis.BORailTime;
const BORAIL_SERVICE = globalThis.BORailService;
if (!BORAIL_CLOCK || !BORAIL_SERVICE) throw new Error('BORail time and service helpers must load before timetable.js');

// Replace this placeholder link with your actual GitHub raw repository URL asset link path!
const ACCESSIBLE_ICON_URL = "assets/images/ui/accessibility.png";

// Setup list matching your specified dataset mapping rules
const ACCESSIBLE_STATIONS = new Set([
  'Newkirk', 'Newkirk - Oak Street', 'Hoganville', 'Bayview Park', 'Chelsea Bay', 'Berwick Hall',
  'Bradford Square', 'Bradford Bay', 'Cambridge Central', 'Atkinson Junction', 'Kenilworth', 'La Vista',
  'Brookfield Lawn', 'Boylston', 'Foxston', 'New Cottage', 'Whitebranch', 'Burlington - University of NCU',
  'Willow Springs', 'Rockcastle', 'Cannon View', 'Ivory Knolls', 'Vanderburg', 'Ralston-Finch East',
  'Atkins Bridge', 'Wychwood - Oakville City Airport', 'Veridia Nexus', 'Oakville Exchange', 'Oakville City Center',
  'Oakville Plaza', 'Oakville City Airport', 'Leighton Castle', 'Fort Meadow', 'Yoakum', 'Fernwood', 'Talmedge Hill', 'Mount River',
  'Perry Road', 'Wood-by-Hike', 'New Salemview', 'Millford Heights', 'Roxbury Landing', 'East Heights',
  'Alpherst', 'Scottsbury', 'Ameryville', 'Scottsdale', 'Brandywine', 'Santa Mora', 'Greens Corner',
  'Doverville', 'Groveton', 'Madisonboro', 'Hutchinson Point', 'South Harrington', 'Harrington City',
  'Carrollton', 'Hadleigh'
]);

const ICONS = {
  clock: `<svg class="clock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v6l4 2"/>
  </svg>`,
  pinGreen: `<svg viewBox="0 0 24 24" fill="none">
    <path d="M12 22s-7-4.5-7-11a7 7 0 1 1 14 0c0 6.5-7 11-7 11z" stroke="#3ddc84" stroke-width="2"/>
    <circle cx="12" cy="11" r="2.5" fill="#3ddc84"/>
  </svg>`,
  pinOrange: `<svg viewBox="0 0 24 24" fill="none">
    <path d="M12 22s-7-4.5-7-11a7 7 0 1 1 14 0c0 6.5-7 11-7 11z" stroke="#ff9500" stroke-width="2"/>
    <circle cx="12" cy="11" r="2.5" fill="#ff9500"/>
  </svg>`,
  pinGray: `<svg viewBox="0 0 24 24" fill="none">
    <path d="M12 22s-7-4.5-7-11a7 7 0 1 1 14 0c0 6.5-7 11-7 11z" stroke="#a0a3ad" stroke-width="2"/>
    <circle cx="12" cy="11" r="2.5" fill="#a0a3ad"/>
  </svg>`,
  pinDim: `<svg viewBox="0 0 24 24" fill="none" opacity="0.4">
    <path d="M12 22s-7-4.5-7-11a7 7 0 1 1 14 0c0 6.5-7 11-7 11z" stroke="#a0a3ad" stroke-width="2"/>
    <circle cx="12" cy="11" r="2.5" fill="#a0a3ad"/>
  </svg>`
};

function seededRandom(seed) {
  let h = 2166136261 >>> 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function formatTime24(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = Math.floor(totalMinutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTime24Full(totalSeconds) {
  let secs = totalSeconds;
  if (secs < 0) secs += 24 * 3600;
  secs = secs % (24 * 3600);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const TRAIN_TYPES = {
  'MTC-T 3298': { cars: 3, leadCarRange: [100, 219] },
  'MTC-T 2254': { cars: 4, leadCarRange: [200, 329] },
  'MTC-T 2253': { cars: 4, leadCarRange: [335, 504] },
  'MTC-T 110':  { cars: 2, leadCarRange: [510, 569] },
  'MTC-T 454':  { cars: 3, leadCarRange: [600, 669] },
  'MTC-T 455-2': { model: 'MTC-T 455', cars: 2, leadCarRange: [700, 769] }
};

function getTrainConsist(trainSeed, serviceId, isExpress) {
  const rng = seededRandom(trainSeed + '-consist');
  const roll = rng();

  let model = 'MTC-T 2254';
  let cars = 4;
  let range = TRAIN_TYPES['MTC-T 2254'].leadCarRange;

  if (serviceId === 'B') {
    model = 'MTC-T 3298';
    cars = 3;
    range = TRAIN_TYPES['MTC-T 3298'].leadCarRange;
  } else if (serviceId === 'D' || serviceId === 'G') {
    model = 'MTC-T 110';
    cars = 2;
    range = TRAIN_TYPES['MTC-T 110'].leadCarRange;
  } else if (serviceId === 'E') {
    model = 'MTC-T 455';
    cars = 2;
    range = TRAIN_TYPES['MTC-T 455-2'].leadCarRange;
  } else if (serviceId === 'C') {
    if (roll < 0.75) {
      model = 'MTC-T 454';
      cars = 3;
      range = TRAIN_TYPES['MTC-T 454'].leadCarRange;
    } else {
      model = 'MTC-T 455';
      cars = 2;
      range = TRAIN_TYPES['MTC-T 455-2'].leadCarRange;
    }
  } else if (serviceId === 'A' || serviceId === 'F') {
    if (roll < 0.60) {
      model = 'MTC-T 2253';
      cars = 4;
      range = TRAIN_TYPES['MTC-T 2253'].leadCarRange;
    } else {
      model = 'MTC-T 2254';
      cars = 4;
      range = TRAIN_TYPES['MTC-T 2254'].leadCarRange;
    }
  } else if (serviceId === 'S') {
    model = 'MTC-T 2254';
    cars = 4;
    range = TRAIN_TYPES['MTC-T 2254'].leadCarRange;
  }

  const [minCar, maxCar] = range;
  const leadCar = minCar + Math.floor(rng() * (maxCar - minCar + 1));
  return { model, cars, leadCar };
}

const STATIONS = [
  'Newkirk','Newkirk - Oak Street','Hoganville','Bayview Park','Chelsea Bay','Berwick Hall',
  'Westpoint','Bradford Square','Bradford Bay','Cambridge Central','Atkinson Junction','Garner',
  'Kenilworth','La Vista','Brookfield Lawn','Boylston','Foxston','New Cottage','Whitebranch',
  'Burlington - University of NCU','Port Williamson','Willow Springs','Rockcastle','Cannon View',
  'Ivory Knolls','Djimar','Vanderburg','Ralston-Finch East','Atkins Bridge','Radcliff Fields',
  'Oakville City Airport','Veridia Nexus','Oakville Exchange','Oakville City Center','Oakville Plaza',
  'Leighton Castle','Fort Meadow','Yoakum','Joplin','Fernwood','Talmedge Hill','Mount River','Perry Road','Mount Hindsboro','Wood-by-Hike',
  'New Salemview','Millford Heights','Roxbury Landing','East Heights','Alpherst','New Halifax',
  'Tyford Farms','Scottsbury','Ameryville','Scottsdale','Grant Park','Cherrywood','Brandywine',
  'Santa Mora','Greens Corner','Doverville','Orchard Ridge','Groveton','Madisonboro','Hutchinson Point',
  'Vanwood','South Harrington','Harrington City','Carrollton','Hadleigh'
].map((name) => ({ id: name, name }));

const STATION_SET = new Set(STATIONS.map(s => s.id));

const DEFAULT_SEGMENT_TIME = 1.5;
const segFor = (route) => Array(route.length - 1).fill(DEFAULT_SEGMENT_TIME);

const SERVICE_META = {
  A: { color: '#34c759', localIcon: 'assets/images/line-icons/a-local.png', expressIcon: 'assets/images/line-icons/a-express.png' },
  F: { color: '#ff3b30', localIcon: 'assets/images/line-icons/f-local.png', expressIcon: 'assets/images/line-icons/f-express.png' },
  B: { color: '#007aff', localIcon: 'assets/images/line-icons/b-local.png', expressIcon: 'assets/images/line-icons/b-express.png' },
  C: { color: '#ff2d55', localIcon: 'assets/images/line-icons/c-local.png', expressIcon: null },
  D: { color: '#ff9500', localIcon: 'assets/images/line-icons/d-local.png', expressIcon: null },
  E: { color: '#a2845e', localIcon: 'assets/images/line-icons/e-local.png', expressIcon: null },
  G: { color: '#ffcc00', localIcon: 'assets/images/line-icons/g-local.png', expressIcon: null },
  S: { color: '#c7c7cc', localIcon: 'assets/images/line-icons/s-local.png', expressIcon: 'assets/images/line-icons/s-express.png' }
};

const ROUTES = [
  { serviceId:'F', isExpress:false, tag:'LCL', dir:'NB', origin:'Kenilworth', destination:'Newkirk',
    stops:['Kenilworth','Garner','Atkinson Junction','Cambridge Central','Berwick Hall','Chelsea Bay','Bayview Park','Hoganville','Newkirk - Oak Street','Newkirk'] },
  { serviceId:'F', isExpress:false, tag:'LCL', dir:'NB', origin:'Boylston', destination:'Newkirk',
    stops:['Boylston','Brookfield Lawn','La Vista','Atkinson Junction','Cambridge Central','Berwick Hall','Chelsea Bay','Bayview Park','Hoganville','Newkirk - Oak Street','Newkirk'] },
  { serviceId:'F', isExpress:false, tag:'LCL', dir:'SB', origin:'Newkirk', destination:'Kenilworth',
    stops:['Newkirk','Newkirk - Oak Street','Hoganville','Bayview Park','Chelsea Bay','Berwick Hall','Cambridge Central','Atkinson Junction','Garner','Kenilworth'] },
  { serviceId:'F', isExpress:false, tag:'LCL', dir:'SB', origin:'Newkirk', destination:'Boylston',
    stops:['Newkirk','Newkirk - Oak Street','Hoganville','Bayview Park','Chelsea Bay','Berwick Hall','Cambridge Central','Atkinson Junction','La Vista','Brookfield Lawn','Boylston'] },

  { serviceId:'F', isExpress:true, tag:'EXP', dir:'NB', origin:'Whitebranch', destination:'Newkirk',
    stops:['Whitebranch','New Cottage','Foxston','Brookfield Lawn','La Vista','Atkinson Junction','Berwick Hall','Hoganville','Newkirk - Oak Street','Newkirk'] },
  { serviceId:'F', isExpress:true, tag:'EXP', dir:'SB', origin:'Newkirk', destination:'Whitebranch',
    stops:['Newkirk','Newkirk - Oak Street','Hoganville','Berwick Hall','Atkinson Junction','La Vista','Brookfield Lawn','Foxston','New Cottage','Whitebranch'] },

  { serviceId:'G', isExpress:false, tag:'LCL', dir:'EB', origin:'Bradford Bay', destination:'Berwick Hall',
    stops:['Bradford Bay','Bradford Square','Westpoint','Berwick Hall'], segmentTimes:[1.5,1.5,2.0] },
  { serviceId:'G', isExpress:false, tag:'LCL', dir:'WB', origin:'Berwick Hall', destination:'Bradford Bay',
    stops:['Berwick Hall','Westpoint','Bradford Square','Bradford Bay'], segmentTimes:[1.5,1.5,1.5] },

  { serviceId:'S', isExpress:false, tag:'LCL', dir:'NB', origin:'Ralston-Finch East', destination:'Burlington - University of NCU',
    stops:['Ralston-Finch East','Vanderburg','Djimar','Ivory Knolls','Cannon View','Rockcastle','Willow Springs','Burlington - University of NCU'] },
  { serviceId:'S', isExpress:false, tag:'LCL', dir:'SB', origin:'Burlington - University of NCU', destination:'Ralston-Finch East',
    stops:['Burlington - University of NCU','Willow Springs','Rockcastle','Cannon View','Ivory Knolls','Djimar','Vanderburg','Ralston-Finch East'] },
  { serviceId:'S', isExpress:true, tag:'EXP', dir:'NB', origin:'Ralston-Finch East', destination:'Newkirk', peak: 'AM',
    stops:['Ralston-Finch East','Cannon View','Rockcastle','Willow Springs','Burlington - University of NCU','Newkirk - Oak Street','Newkirk'] },
  { serviceId:'S', isExpress:true, tag:'EXP', dir:'SB', origin:'Newkirk', destination:'Ralston-Finch East', peak: 'PM',
    stops:['Newkirk','Newkirk - Oak Street','Burlington - University of NCU','Willow Springs','Rockcastle','Cannon View','Ralston-Finch East'] },

  { serviceId:'A', isExpress:false, tag:'LCL', dir:'NB', origin:'Mount River', destination:'Newkirk',
    stops:['Mount River','Talmedge Hill','Oakville Plaza','Oakville Exchange','Oakville City Airport','Radcliff Fields','Atkins Bridge','Cannon View','Burlington - University of NCU','Newkirk'] },
  { serviceId:'A', isExpress:false, tag:'LCL', dir:'SB', origin:'Newkirk', destination:'Mount River',
    stops:['Newkirk','Burlington - University of NCU','Cannon View','Atkins Bridge','Radcliff Fields','Oakville City Airport','Oakville Exchange','Oakville Plaza','Talmedge Hill','Mount River'] },
  { serviceId:'A', isExpress:true, tag:'EXP', dir:'NB', origin:'Mount River', destination:'Port Williamson',
    stops:['Mount River','Talmedge Hill','Oakville Plaza','Oakville Exchange','Oakville City Airport','Atkins Bridge','Cannon View','Willow Springs','Port Williamson'] },
  { serviceId:'A', isExpress:true, tag:'EXP', dir:'SB', origin:'Port Williamson', destination:'Mount River',
    stops:['Port Williamson','Cannon View','Atkins Bridge','Oakville City Airport','Oakville Exchange','Oakville Plaza','Talmedge Hill','Mount River'] },

  { serviceId:'D', isExpress:false, tag:'LCL', dir:'NB', origin:'Oakville City Airport', destination:'Veridia Nexus',
    stops:['Oakville City Airport','Veridia Nexus'], segmentTimes:[1.5] },
  { serviceId:'D', isExpress:false, tag:'LCL', dir:'SB', origin:'Veridia Nexus', destination:'Oakville City Airport',
    stops:['Veridia Nexus','Oakville City Airport'], segmentTimes:[1.5] },

  { serviceId:'C', isExpress:false, tag:'LCL', dir:'SB', origin:'East Heights', destination:'Oakville City Airport',
    stops:['East Heights','Roxbury Landing','Millford Heights','New Salemview','Wood-by-Hike','Mount Hindsboro','Perry Road','Oakville City Airport'] },
  { serviceId:'C', isExpress:false, tag:'LCL', dir:'SB', origin:'East Heights', destination:'Fernwood',
    stops:['East Heights','Roxbury Landing','Millford Heights','New Salemview','Wood-by-Hike','Mount Hindsboro','Perry Road','Oakville Exchange','Oakville City Center','Oakville Plaza','Leighton Castle','Fort Meadow','Yoakum','Joplin','Fernwood'] },
  { serviceId:'C', isExpress:false, tag:'LCL', dir:'NB', origin:'Oakville City Airport', destination:'East Heights',
    stops:['Oakville City Airport','Perry Road','Mount Hindsboro','Wood-by-Hike','New Salemview','Millford Heights','Roxbury Landing','East Heights'] },
  { serviceId:'C', isExpress:false, tag:'LCL', dir:'NB', origin:'Fernwood', destination:'East Heights',
    stops:['Fernwood','Joplin','Yoakum','Fort Meadow','Leighton Castle','Oakville Plaza','Oakville City Center','Oakville Exchange','Perry Road','Mount Hindsboro','Wood-by-Hike','New Salemview','Millford Heights','Roxbury Landing','East Heights'] },

  { serviceId:'E', isExpress:false, tag:'LCL', dir:'SB', origin:'Santa Mora', destination:'East Heights',
    stops:['Santa Mora','Brandywine','Cherrywood','Grant Park','Scottsdale','Ameryville','Scottsbury','Tyford Farms','New Halifax','Alpherst','Roxbury Landing','East Heights'] },
  { serviceId:'E', isExpress:false, tag:'LCL', dir:'NB', origin:'East Heights', destination:'Santa Mora',
    stops:['East Heights','Alpherst','New Halifax','Scottsbury','Ameryville','Scottsdale','Grant Park','Cherrywood','Brandywine','Santa Mora'] },

  { serviceId:'B', isExpress:false, tag:'LCL', dir:'NB', origin:'Leighton Castle', destination:'Harrington City',
    stops:['Leighton Castle','Oakville Plaza','Oakville City Center','Oakville Exchange','Perry Road','Mount Hindsboro','Greens Corner','Doverville','Orchard Ridge','Groveton','Madisonboro','Hutchinson Point','Vanwood','South Harrington','Harrington City'] },
  { serviceId:'B', isExpress:false, tag:'LCL', dir:'SB', origin:'Harrington City', destination:'Leighton Castle',
    stops:['Harrington City','South Harrington','Vanwood','Hutchinson Point','Madisonboro','Groveton','Orchard Ridge','Doverville','Greens Corner','Mount Hindsboro','Perry Road','Oakville Exchange','Oakville City Center','Oakville Plaza', 'Leighton Castle'] },
  { serviceId:'B', isExpress:true, tag:'EXP', dir:'NB', origin:'Leighton Castle', destination:'Hadleigh',
    stops:['Leighton Castle','Oakville Plaza','Oakville City Center','Oakville Exchange','Greens Corner','Madisonboro','Harrington City','Carrollton','Hadleigh'] },
  { serviceId:'B', isExpress:true, tag:'EXP', dir:'SB', origin:'Hadleigh', destination:'Leighton Castle',
    stops:['Hadleigh','Carrollton','Harrington City','Madisonboro','Greens Corner','Oakville Exchange','Oakville City Center','Oakville Plaza','Leighton Castle'] }
];

const WINTER_ROUTES = BORAIL_SERVICE.WINTER_ROUTES.map(route => ({
  ...route,
  stops: [...route.stops],
  segmentTimes: route.segmentTimes ? [...route.segmentTimes] : undefined
}));

function routesForDate(date = BORAIL_CLOCK.now(), options) {
  return BORAIL_SERVICE.context(date, options).winterEmergency ? WINTER_ROUTES : ROUTES;
}

function passengerRoutesForDate(date = BORAIL_CLOCK.now()) {
  const routes = routesForDate(date);
  const operations = globalThis.BORailOperations;
  const state = globalThis.BORailOperationsClient?.state(date);
  if (!operations || !state || (!state.stations.size && !state.shutdowns.length)) return routes;
  const effective = route => getEffectiveRoutePattern(route, timeMode(date));
  return routes.flatMap(route => {
    if (state.shutdowns.some(change => operations.affectsService(change, operations.serviceKey(route)))) return [];
    const pattern = operations.closurePattern(route, effective(route), state, routes, effective);
    return pattern ? [{ ...route, ...pattern }] : [];
  });
}

const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
function timeModeForMinutes(nowMin) {
  return BORAIL_SERVICE.timeModeForMinutes(nowMin);
}

function timeMode(now = BORAIL_CLOCK.now()) {
  return BORAIL_SERVICE.context(now).mode;
}

function planningOptions(date, now = BORAIL_CLOCK.now()) {
  return { allowWinter: localDateKey(date) <= localDateKey(now) };
}

function isServiceAllowed(route, mode) {
  if (mode === 'closed') return false;
  if (mode === 'winterEmergency') return !route.isExpress;
  if (route.serviceId === 'S' && route.isExpress) {
    if (mode === 'rushAM' && route.peak === 'AM') return true;
    if (mode === 'rushPM' && route.peak === 'PM') return true;
    return false;
  }

  const isGenericRush = (mode === 'rushAM' || mode === 'rushPM');
  if (!isGenericRush && route.isExpress) return false;

  return true;
}

function getEffectiveRoutePattern(route, mode) {
  const stops = [...route.stops];
  const segmentTimes = route.segmentTimes ? [...route.segmentTimes] : segFor(stops);
  const isRush = mode === 'rushAM' || mode === 'rushPM';

  if (route.serviceId === 'A' && !route.isExpress && !isRush && mode !== 'winterEmergency') {
    const radcliffIndex = stops.indexOf('Radcliff Fields');
    if (radcliffIndex > 0 && radcliffIndex < stops.length - 1) {
      const combinedTravelTime = segmentTimes[radcliffIndex - 1] + segmentTimes[radcliffIndex];
      stops.splice(radcliffIndex, 1);
      segmentTimes.splice(radcliffIndex - 1, 2, combinedTravelTime);
    }
  }

  return { stops, segmentTimes };
}

const LINE_SERVICE = {
  A: { all: [
    { start: '06:00', end: '09:29', every: 7 },
    { start: '09:30', end: '16:59', every: 15 },
    { start: '17:00', end: '19:29', every: 7 },
    { start: '19:30', end: '22:59', every: 20 },
  ]},
  F: { all: [
    { start: '06:00', end: '09:29', every: 7 },
    { start: '09:30', end: '16:59', every: 15 },
    { start: '17:00', end: '19:29', every: 7 },
    { start: '19:30', end: '22:59', every: 20 },
  ]},
  B: { all: [
    { start: '06:00', end: '09:29', every: 5 },
    { start: '09:30', end: '16:59', every: 15 },
    { start: '17:00', end: '19:29', every: 5 },
    { start: '19:30', end: '22:59', every: 25 },
  ]},
  C: { all: [
    { start: '06:00', end: '09:29', every: 7 },
    { start: '09:30', end: '16:59', every: 15 },
    { start: '17:00', end: '19:29', every: 7 },
    { start: '19:30', end: '22:59', every: 20 },
  ]},
  E: { all: [
    { start: '06:00', end: '09:29', every: 5 },
    { start: '09:30', end: '16:59', every: 15 },
    { start: '17:00', end: '19:29', every: 5 },
    { start: '19:30', end: '22:59', every: 25 },
  ]},
  S: { all: [
    { start: '06:00', end: '09:29', every: 7 },
    { start: '09:30', end: '16:59', every: 15 },
    { start: '17:00', end: '19:29', every: 7 },
    { start: '19:30', end: '22:59', every: 20 },
  ]},
  D: { all: [ { start: '06:00', end: '22:59', every: 12 } ] },
  G: { all: [ { start: '06:00', end: '22:59', every: 12 } ] }
};

const expandDepartures = periods => {
  const out = [];
  periods.forEach(p => {
    let cur = toMin(p.start), end = toMin(p.end);
    while (cur <= end) { out.push(cur); cur += p.every; }
  });
  return out;
};

function getTrainDelayInfo(trainSeed, mode = 'local', stopCount = 2) {
  return BORAIL_SERVICE.delayInfo(trainSeed, mode, stopCount);
}

function calculateStopTimes(trainSeed, stops, departureMinutes, customSegmentTimes = null, mode = 'local', customDwellSeconds = null) {
  return BORAIL_SERVICE.calculateStopTimes(trainSeed, stops, departureMinutes, {
    segmentTimes: customSegmentTimes,
    customDwellSeconds,
    defaultSegmentMinutes: DEFAULT_SEGMENT_TIME,
    mode
  });
}

function getTrainPosition(stopTimes, nowSeconds) {
  const stops = stopTimes.stops;
  if (nowSeconds < stops[0].actualArrivalSec) {
    return { status: 'not-started', nextStop: stops[0].name };
  }
  if (nowSeconds >= stops[stops.length - 1].actualDepartureSec) {
    return { status: 'completed' };
  }
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (nowSeconds >= stop.actualArrivalSec && nowSeconds < stop.actualDepartureSec) {
      return { status: 'at-station', currentStop: stop.name, currentIndex: i, isDelayed: stop.isDelayed };
    }
    if (i < stops.length - 1) {
      const nextStop = stops[i + 1];
      if (nowSeconds >= stop.actualDepartureSec && nowSeconds < nextStop.actualArrivalSec) {
        return { status: 'en-route', fromStop: stop.name, toStop: nextStop.name, fromIndex: i, toIndex: i + 1 };
      }
    }
  }
  return { status: 'unknown' };
}

const SINGLE_TRAIN_SHUTTLES = new Set(['G','D']);
const FIXED_SHUTTLE_LEAD_CARS = {
  G: { 'Berwick Hall': 545, 'Bradford Bay': 544 },
  D: { 'Veridia Nexus': 540, 'Oakville City Airport': 541 }
};

function isSingleTrainShuttleRoute(route) {
  return Boolean(route.singleTrainShuttle || SINGLE_TRAIN_SHUTTLES.has(route.serviceId));
}

function shuttleKeyForRoute(route) {
  return route.shuttleKey || (SINGLE_TRAIN_SHUTTLES.has(route.serviceId) ? route.serviceId : null);
}

function servicePeriodsFor(serviceId, date, mode = timeMode(date)) {
  if (mode === 'winterEmergency') return BORAIL_SERVICE.WINTER_LINE_SERVICE[serviceId] || [];
  return LINE_SERVICE[serviceId]?.all || [];
}

const SHUTTLE_EVENTS_CACHE = new Map();
function localDateKey(date) {
  return BORAIL_CLOCK.dateKey(date);
}

function getShuttleEventsForToday(shuttleKey, date = BORAIL_CLOCK.now(), options) {
  const dayKey = localDateKey(date);
  const context = BORAIL_SERVICE.context(date, options);
  const scheduleKind = context.winterEmergency ? 'winterEmergency' : 'regular';
  const key = `${shuttleKey}-${dayKey}-${scheduleKind}`;
  if (SHUTTLE_EVENTS_CACHE.has(key)) return SHUTTLE_EVENTS_CACHE.get(key);

  const routes = routesForDate(date, options).filter(route => shuttleKeyForRoute(route) === shuttleKey);
  if (routes.length < 2) {
    SHUTTLE_EVENTS_CACHE.set(key, []);
    return [];
  }

  const events = [];
  if (SHUTTLE_EVENTS_CACHE.size >= 24) SHUTTLE_EVENTS_CACHE.clear();
  BORAIL_SERVICE.singleShuttleRuns(routes, shuttleKey, date, options).forEach(run => {
    const curRoute = run.route;
    const t0 = run.departureMin;
    const seg = curRoute.segmentTimes ? curRoute.segmentTimes : segFor(curRoute.stops);
    const customDwellSeconds = run.customDwellSeconds;

    for (let i = 0; i < curRoute.stops.length; i++) {
      events.push({
        station: curRoute.stops[i],
        time: run.timing.stops[i].scheduledArrivalSec / 60,
        destination: curRoute.destination,
        serviceId: curRoute.serviceId,
        isExpress: false,
        tag: curRoute.tag,
        color: SERVICE_META[curRoute.serviceId].color,
        stops: curRoute.stops,
        segmentTimes: seg,
        departureMin: t0,
        origin: curRoute.origin,
        dir: curRoute.dir,
        isSingleShuttle: true,
        shuttleKey,
        customDwellSeconds
      });
    }
  });

  SHUTTLE_EVENTS_CACHE.set(key, events);
  return events;
}

function getRouteDepartureMinutes(routeDef, date = BORAIL_CLOCK.now(), options, context = BORAIL_SERVICE.context(date, options)) {
  const mode = context.winterEmergency ? 'winterEmergency' : 'local';
  const periods = servicePeriodsFor(routeDef.serviceId, date, mode);
  const dep = expandDepartures(periods);

  const branchSeed = `${routeDef.serviceId}-${routeDef.tag}-${routeDef.origin}-${routeDef.destination}`;
  const rng = seededRandom(branchSeed);
  const baseOffset = Math.floor(rng() * 3);
  const deps = dep.map(t => t + baseOffset);

  return deps.map(t0 => {
    let slottedDepartureTime = t0;

    if (mode !== 'winterEmergency' && !isSingleTrainShuttleRoute(routeDef)) {
      if (routeDef.serviceId === 'F' && !routeDef.isExpress) {
        if (routeDef.origin === 'Boylston') slottedDepartureTime += 3;
      } else if (routeDef.serviceId === 'C') {
        if (routeDef.destination === 'Oakville City Airport' || routeDef.origin === 'Oakville City Airport') slottedDepartureTime += 4;
      } else if (routeDef.serviceId === 'A') {
        if (routeDef.isExpress) slottedDepartureTime += 3;
      } else if (routeDef.serviceId === 'B') {
        if (routeDef.isExpress) slottedDepartureTime += 2;
      } else if (routeDef.serviceId === 'S') {
        if (routeDef.isExpress) slottedDepartureTime += 3;
      }
    }
    return slottedDepartureTime;
  }).filter(BORAIL_SERVICE.isOriginDepartureAllowed);
}

function tripsForRoute(routeDef, mode = 'local', date = BORAIL_CLOCK.now()) {
  const deps = getRouteDepartureMinutes(routeDef, date);
  const effectiveRoute = getEffectiveRoutePattern(routeDef, mode);
  const seg = effectiveRoute.segmentTimes;
  const stops = effectiveRoute.stops;

  const out = [];
  for (const slottedDepartureTime of deps) {
    let cur = slottedDepartureTime;
    for (let i = 0; i < stops.length; i++) {
      out.push({
        station: stops[i],
        time: cur,
        destination: routeDef.destination,
        serviceId: routeDef.serviceId,
        isExpress: routeDef.isExpress,
        tag: routeDef.tag,
        color: SERVICE_META[routeDef.serviceId].color,
        stops,
        segmentTimes: seg,
        departureMin: slottedDepartureTime,
        origin: routeDef.origin
      });
      if (i < seg.length) cur += seg[i];
    }
  }
  return out;
}

function getTrainDirection(serviceId, destination) {
  if (destination === 'East Heights') {
    if (serviceId === 'C') return 'Northbound';
    if (serviceId === 'E') return 'Southbound';
  }
  if (destination === 'Wychwood - Oakville City Airport' || destination === 'Oakville City Airport') {
    if (serviceId === 'C') return 'Westbound';
    if (serviceId === 'D') return 'Eastbound';
  }
  if (serviceId === 'B') {
    if (destination === 'Leighton Castle') return 'Eastbound';
    if (destination === 'Mount Hindsboro') return 'Southbound';
    if (destination === 'Harrington City' || destination === 'Hadleigh') return 'Northbound';
  }

  switch(destination) {
    case 'Newkirk':
    case 'Burlington - University of NCU':
    case 'Port Williamson':
    case 'Santa Mora':
    case 'Harrington City':
    case 'Hadleigh':
      return 'Northbound';
    case 'Kenilworth':
    case 'Boylston':
    case 'Whitebranch':
    case 'Ralston-Finch East':
    case 'Mount River':
      return 'Southbound';
    case 'Berwick Hall':
    case 'Leighton Castle':
    case 'Fernwood':
      return 'Eastbound';
    case 'Bradford Bay':
    case 'Veridia Nexus':
      return 'Westbound';
    default:
      return 'Northbound';
  }
}

function arrivalsForStation(stationId, now = BORAIL_CLOCK.now()) {
  const nowSeconds = BORAIL_CLOCK.clockSeconds(now);
  const horizon = 6 * 60;
  const out = [];

  buildScheduledRuns(now, true).forEach(run => {
    const stationIndex = run.stops.findIndex(stop => stop.name === stationId);
    if (stationIndex < 0 || stationIndex === run.stops.length - 1) return;
    const first = run.stops[0];
    const last = run.stops[run.stops.length - 1];
    const trainActive = nowSeconds >= first.actualArrivalSec && nowSeconds < last.actualDepartureSec;
    const delayVisible = trainActive && run.hasDelay && run.delayStartSec !== null && nowSeconds >= run.delayStartSec;
    const visibleStops = delayVisible
      ? run.stops
      : run.stops.map(stop => ({
          ...stop,
          actualArrivalSec: stop.scheduledArrivalSec,
          actualDepartureSec: stop.scheduledDepartureSec,
          isDelayed: false,
          delaySeconds: 0
        }));
    const stationStop = visibleStops[stationIndex];
    const minsAway = (stationStop.actualArrivalSec - nowSeconds) / 60;
    if (minsAway < -1 || minsAway > horizon) return;
    out.push({
      station: stationId,
      time: stationStop.actualArrivalSec / 60,
      timeMin: stationStop.actualArrivalSec / 60,
      minsAway,
      destination: run.destination,
      serviceId: run.serviceId,
      isExpress: run.isExpress,
      tag: run.tag,
      color: SERVICE_META[run.serviceId].color,
      stops: visibleStops.map(stop => stop.name),
      segmentTimes: run.segmentTimes,
      customDwellSeconds: run.customDwellSeconds,
      departureMin: run.departureMin,
      origin: run.origin,
      dir: run.dir,
      isSingleShuttle: run.isSingleShuttle,
      mode: run.mode,
      precomputedStopTimes: { ...run, stops: visibleStops, hasDelay: delayVisible },
      delayVisible
    });
  });

  out.sort((a, b) => a.timeMin - b.timeMin);
  return out;
}

const INACTIVE_STATION_FALLBACKS = {
  'Foxston': 'Boylston',
  'New Cottage': 'Boylston',
  'Whitebranch': 'Boylston',
  'Port Williamson': 'Willow Springs',
  'Radcliff Fields': 'Oakville City Airport',
  'Carrollton': 'Harrington City',
  'Hadleigh': 'Harrington City'
};

function buildScheduledRuns(planningDate, includeExpress = true, options = {}) {
  const runs = [];
  const dayContext = BORAIL_SERVICE.context(planningDate, options);
  const activeRoutes = dayContext.winterEmergency ? WINTER_ROUTES : ROUTES;
  const { runIds, statusMinute } = options;
  const operations = globalThis.BORailOperations;
  const snapshot = options.operations ?? globalThis.BORailOperationsClient?.snapshot;
  const hasChanges = operations && snapshot?.changes?.length;
  const dayStart = hasChanges ? operations.serviceDayStart(planningDate) : 0;
  const nextByService = new Map();
  const neededServices = runIds && new Set([...runIds].map(id => id.split('-', 2).join('-')));
  const routeNeeded = route => !neededServices || neededServices.has(`${route.serviceId}-${route.tag}`);
  function needsTiming(serviceId, isExpress, departureMin, maxDuration) {
    if (!Number.isFinite(statusMinute)) return true;
    if (departureMin > statusMinute) {
      const key = `${serviceId}-${isExpress ? 'express' : 'local'}`;
      if (departureMin < (nextByService.get(key)?.departureMin ?? Infinity)) {
        nextByService.set(key, { serviceId, isExpress, departureMin });
      }
      return false;
    }
    return departureMin + maxDuration >= statusMinute;
  }

  function addRun(run, timing, route, pattern, maxDuration) {
    const departure = dayStart + timing.stops[0].actualDepartureSec * 1000;
    if (hasChanges) {
      const state = operations.atTime(snapshot, departure);
      const key = operations.serviceKey(run);
      // The original departure is the dispatch slot. Once it has departed,
      // later closures do not alter this run, even after a page reload.
      if (state.shutdowns.some(change => operations.affectsService(change, key))) return;
      const changed = operations.closurePattern(route, pattern, state, activeRoutes,
        candidate => getEffectiveRoutePattern(candidate, run.mode));
      if (!changed) return;
      if (changed !== pattern) {
        run.originalDestination = run.destination;
        run.origin = changed.stops[0];
        run.destination = changed.stops.at(-1);
        run.legs = changed.legs;
        run.segmentTimes = changed.segmentTimes;
        run.customDwellSeconds = changed.customDwellSeconds || null;
        timing = calculateStopTimes(run.trainSeed, changed.stops, run.departureMin, run.segmentTimes,
          run.mode, run.customDwellSeconds);
        run.rerouted = changed.rerouted;
      }
      const recovery = operations.recoverySeconds(run.id, departure, snapshot);
      if (recovery) {
        timing.delayStartSec = timing.stops[0].actualDepartureSec;
        timing.delayStartStop = 1;
        timing.hasDelay = true;
        timing.delaySeconds += recovery;
        timing.stops.slice(1).forEach(stop => {
          stop.actualArrivalSec += recovery;
          stop.actualDepartureSec += recovery;
          stop.isDelayed = true;
          stop.delaySeconds += recovery;
        });
      }
    }
    const baseline = { ...run, ...timing };
    let result = baseline;
    if (hasChanges) {
      for (const change of snapshot.changes) {
        if (change.kind !== 'train' || change.target !== run.id) continue;
        if (change.stops?.some(name => operations.atTime(snapshot, Math.max(departure, change.startsAt)).stations.has(name))) continue;
        if (!result && !change.restore) continue;
        try {
          result ||= baseline;
          result.originalDestination ||= result.destination;
          result = operations.applyTrainEdit(result, change, dayStart);
        } catch (error) {
          // A subsequently published closure can invalidate an old detour.
          console.warn('BORail train edit could not be applied:', change.id, error.message);
        }
      }
      if (!result && options.includeCanceled && snapshot.changes.some(change =>
        change.kind === 'train' && change.target === run.id && change.cancel)) {
        result = { ...baseline, canceled: true };
      }
      if (!result) return;
      maxDuration = Math.max(maxDuration, result.stops.at(-1).actualDepartureSec / 60 - result.departureMin);
    }
    if (needsTiming(run.serviceId, run.isExpress, run.departureMin, maxDuration)) runs.push(result);
  }

  activeRoutes.forEach(route => {
    if (isSingleTrainShuttleRoute(route) || !routeNeeded(route)) return;
    if (!includeExpress && route.isExpress) return;
    const patterns = new Map();
    // The maximum possible delay is 15 minutes; include terminal dwell and
    // timing offsets when skipping runs that must already have finished.
    const maxDuration = (route.segmentTimes || segFor(route.stops)).reduce((sum, min) => sum + min, 0) + 17;

    getRouteDepartureMinutes(route, planningDate, options, dayContext).forEach(departureMin => {
      const mode = dayContext.winterEmergency ? 'winterEmergency' : timeModeForMinutes(departureMin);
      if (!isServiceAllowed(route, mode)) return;
      if (!hasChanges && !needsTiming(route.serviceId, route.isExpress, departureMin, maxDuration)) return;
      const trainSeed = `${route.serviceId}-${route.tag}-${departureMin}-${route.origin}-${route.destination}`;
      const id = `${trainSeed}-${dayContext.dateKey}`;
      if (runIds && !runIds.has(id)) return;
      if (!patterns.has(mode)) patterns.set(mode, getEffectiveRoutePattern(route, mode));
      const effectiveRoute = patterns.get(mode);
      const stopTimes = calculateStopTimes(trainSeed, effectiveRoute.stops, departureMin, effectiveRoute.segmentTimes, mode, route.customDwellSeconds);
      addRun({
        id,
        serviceId: route.serviceId,
        isExpress: route.isExpress,
        tag: route.tag,
        origin: route.origin,
        destination: route.destination,
        departureMin,
        mode,
        dir: route.dir,
        segmentTimes: effectiveRoute.segmentTimes,
        customDwellSeconds: route.customDwellSeconds || null,
        isSingleShuttle: false,
        trainSeed
      }, stopTimes, route, effectiveRoute, maxDuration);
    });
  });

  const neededShuttles = new Set(activeRoutes.filter(routeNeeded).map(shuttleKeyForRoute).filter(Boolean));
  neededShuttles.forEach(shuttleKey => {
    const originEvents = getShuttleEventsForToday(shuttleKey, planningDate, options)
      .filter(event => event.station === event.origin);
    originEvents.forEach(event => {
      const mode = dayContext.winterEmergency ? 'winterEmergency' : timeModeForMinutes(event.departureMin);
      const trainSeed = `${event.serviceId}-${event.tag}-${event.departureMin}-${event.origin}-${event.destination}`;
      const id = `${trainSeed}-${dayContext.dateKey}`;
      if (runIds && !runIds.has(id)) return;
      const maxDuration = event.segmentTimes.reduce((sum, min) => sum + min, 0)
        + (event.customDwellSeconds || []).reduce((sum, seconds) => sum + seconds / 60, 0) + 17;
      if (!hasChanges && !needsTiming(event.serviceId, false, event.departureMin, maxDuration)) return;
      const stopTimes = calculateStopTimes(trainSeed, event.stops, event.departureMin, event.segmentTimes, mode, event.customDwellSeconds);
      const route = activeRoutes.find(candidate => candidate.origin === event.origin &&
        candidate.destination === event.destination && shuttleKeyForRoute(candidate) === shuttleKey);
      addRun({
        id,
        serviceId: event.serviceId,
        isExpress: false,
        tag: event.tag,
        origin: event.origin,
        destination: event.destination,
        departureMin: event.departureMin,
        mode,
        dir: event.dir,
        segmentTimes: event.segmentTimes,
        customDwellSeconds: event.customDwellSeconds || null,
        isSingleShuttle: true,
        shuttleKey,
        trainSeed
      }, stopTimes, route, event, maxDuration);
    });
  });

  return [...runs, ...nextByService.values()];
}

function runsWithCurrentlyVisibleDelays(runs, planningDate, now = BORAIL_CLOCK.now()) {
  const sameServiceDate = BORAIL_CLOCK.dateKey(planningDate) === BORAIL_CLOCK.dateKey(now);
  const nowSeconds = BORAIL_CLOCK.clockSeconds(now);
  return runs.map(run => {
    const firstStop = run.stops[0];
    const lastStop = run.stops[run.stops.length - 1];
    const isActive = sameServiceDate
      && nowSeconds >= firstStop.actualArrivalSec
      && nowSeconds < lastStop.actualDepartureSec;
    const delayVisible = isActive
      && run.hasDelay
      && run.delayStartSec !== null
      && nowSeconds >= run.delayStartSec;
    if (delayVisible) return run;
    return {
      ...run,
      hasDelay: false,
      delaySeconds: 0,
      stops: run.stops.map(stop => ({
        ...stop,
        actualArrivalSec: stop.scheduledArrivalSec,
        actualDepartureSec: stop.scheduledDepartureSec,
        isDelayed: false,
        delaySeconds: 0
      }))
    };
  });
}

function stationHasActiveService(stationName, mode, includeExpress = true, date = BORAIL_CLOCK.now(), options) {
  return routesForDate(date, options).some(route => {
    if (!includeExpress && route.isExpress) return false;
    if (!isServiceAllowed(route, mode)) return false;
    return getEffectiveRoutePattern(route, mode).stops.includes(stationName);
  });
}

function resolvePlanningStation(stationName, mode, date = BORAIL_CLOCK.now(), options) {
  if (stationHasActiveService(stationName, mode, true, date, options)) {
    return { requested: stationName, effective: stationName, fallback: false };
  }
  const fallbackStation = INACTIVE_STATION_FALLBACKS[stationName];
  if (fallbackStation && stationHasActiveService(fallbackStation, mode, true, date, options)) {
    return { requested: stationName, effective: fallbackStation, fallback: true };
  }
  return { requested: stationName, effective: stationName, fallback: false, unavailable: true };
}

function planBORailTrip(originName, destinationName, planningDate, now = BORAIL_CLOCK.now()) {
  const startTimeSec = BORAIL_CLOCK.clockSeconds(planningDate);
  const options = planningOptions(planningDate, now);
  const context = BORAIL_SERVICE.context(planningDate, options);
  const mode = context.mode;
  const origin = resolvePlanningStation(originName, mode, planningDate, options);
  const destination = resolvePlanningStation(destinationName, mode, planningDate, options);
  const operations = globalThis.BORailOperations;
  const snapshot = globalThis.BORailOperationsClient?.snapshot;
  const closed = operations?.atTime(snapshot, planningDate.getTime()).stations;
  const closure = closed?.get(originName) || closed?.get(destinationName);
  if (closure) return { journeys: [], mode, origin, destination, planningDate, closure };
  const shutdown = operations?.atTime(snapshot, planningDate.getTime()).shutdowns.find(change => change.kind === 'system');
  if (shutdown) return { journeys: [], mode, origin, destination, planningDate, shutdown };

  if (origin.effective === destination.effective) {
    return { journeys: [], mode, origin, destination, sameEffectiveStation: true, planningDate };
  }

  const dayStart = operations?.serviceDayStart(planningDate);
  const stationOpen = (name, seconds) => !operations?.atTime(snapshot, dayStart + seconds * 1000).stations.has(name);
  const allRuns = runsWithCurrentlyVisibleDelays(buildScheduledRuns(planningDate, true, options), planningDate, now);
  // A temporary terminus or added express stop can serve a station absent
  // from the base passenger pattern.
  for (const station of [origin, destination]) {
    if (snapshot?.changes.length && allRuns.some(run => run.stops.some(stop => stop.name === station.requested))) {
      Object.assign(station, { effective: station.requested, fallback: false, unavailable: false });
    }
  }
  const localRuns = allRuns.filter(run => !run.isExpress);
  const departureOffsets = [0, 5, 10, 15, 20, 30].map(minutes => minutes * 60);
  const collectJourneys = runs => {
    const collected = [];
    const signatures = new Set();
    departureOffsets.forEach(offsetSec => {
      const variants = BORailTripPlanner.planJourneys({
        runs,
        origin: origin.effective,
        destination: destination.effective,
        startTimeSec: startTimeSec + offsetSec,
        minTransferSec: 120,
        maxTransfers: 5,
        maxResults: 12,
        searchHorizonSec: 8 * 3600,
        stationOpen
      });
      variants.forEach(journey => {
        if (signatures.has(journey.signature)) return;
        signatures.add(journey.signature);
        journey.requestedDepartureSec = startTimeSec;
        journey.durationSec = journey.arrivalSec - startTimeSec;
        collected.push(journey);
      });
    });
    return collected.sort((a, b) => a.arrivalSec - b.arrivalSec || a.transfers - b.transfers || a.departureSec - b.departureSec);
  };
  const allJourneys = collectJourneys(allRuns);
  const localJourneys = collectJourneys(localRuns);
  const journeys = BORailTripPlanner.selectRecommendedJourneys(localJourneys, allJourneys, {
    expressMinimumGainSec: 120,
    limit: 3
  });

  journeys.forEach(journey => {
    journey.originFallback = origin.fallback ? origin : null;
    journey.destinationFallback = destination.fallback ? destination : null;
    journey.mode = mode;
  });

  return { journeys, mode, origin, destination, planningDate, winterEmergency: context.winterEmergency, allRuns, localJourneys, allJourneys };
}

function tripEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function formatTripClock(totalSeconds) {
  const normalized = ((Math.round(totalSeconds) % 86400) + 86400) % 86400;
  const hour24 = Math.floor(normalized / 3600);
  const minute = Math.floor((normalized % 3600) / 60);
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function formatTripDuration(totalSeconds) {
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours} hr ${minutes ? `${minutes} min` : ''}`.trim() : `${minutes} min`;
}

function plannerModeLabel(mode) {
  if (mode === 'rushAM') return 'AM Rush';
  if (mode === 'rushPM') return 'PM Rush';
  if (mode === 'winterEmergency') return 'Winter Emergency';
  if (mode === 'closed') return 'No Service';
  return 'Local Only';
}


globalThis.BORailSchedule = Object.freeze({
  buildScheduledRuns, runsWithCurrentlyVisibleDelays, planningOptions, planBORailTrip, STATIONS, formatTripClock,
  routesForDate, getEffectiveRoutePattern
});

