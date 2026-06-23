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

const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
function timeModeForMinutes(nowMin) {
  const normalized = ((nowMin % 1440) + 1440) % 1440;
  const rushAM = (normalized >= toMin('06:00') && normalized < toMin('09:30'));
  const rushPM = (normalized >= toMin('17:00') && normalized < toMin('19:30'));
  const overnight = (normalized >= toMin('22:30') || normalized < toMin('03:59'));

  if (overnight) return 'overnight';
  if (rushAM) return 'rushAM';
  if (rushPM) return 'rushPM';
  return 'local';
}

function timeMode(now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return timeModeForMinutes(nowMin);
}

function isServiceAllowed(route, mode) {
  if (route.serviceId === 'S' && route.isExpress) {
    if (mode === 'rushAM' && route.peak === 'AM') return true;
    if (mode === 'rushPM' && route.peak === 'PM') return true;
    return false;
  }

  const isGenericRush = (mode === 'rushAM' || mode === 'rushPM');
  if (!isGenericRush && route.isExpress) return false;

  if (mode === 'overnight') {
    if (route.serviceId === 'G') return false;
    if (route.serviceId === 'S') return false;
    if (route.serviceId === 'D') return false;
    if (route.serviceId === 'F' && route.isExpress) return false;
    if (route.serviceId === 'A' && route.isExpress) return false;
    if (route.serviceId === 'B' && route.isExpress) return false;
  }
  return true;
}

function getEffectiveRoutePattern(route, mode) {
  const stops = [...route.stops];
  const segmentTimes = route.segmentTimes ? [...route.segmentTimes] : segFor(stops);
  const isRush = mode === 'rushAM' || mode === 'rushPM';

  if (route.serviceId === 'A' && !route.isExpress && !isRush) {
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
    { start: '04:00', end: '05:59', every: 20 },
    { start: '06:00', end: '09:29', every: 7 },
    { start: '09:30', end: '16:59', every: 15 },
    { start: '17:00', end: '19:29', every: 7 },
    { start: '19:30', end: '22:29', every: 20 },
  ]},
  F: { all: [
    { start: '04:00', end: '05:59', every: 20 },
    { start: '06:00', end: '09:29', every: 7 },
    { start: '09:30', end: '16:59', every: 15 },
    { start: '17:00', end: '19:29', every: 7 },
    { start: '19:30', end: '22:29', every: 20 },
  ]},
  B: { all: [
    { start: '04:00', end: '05:59', every: 25 },
    { start: '06:00', end: '09:29', every: 5 },
    { start: '09:30', end: '16:59', every: 15 },
    { start: '17:00', end: '19:29', every: 5 },
    { start: '19:30', end: '22:29', every: 25 },
  ]},
  C: { all: [
    { start: '04:00', end: '05:59', every: 20 },
    { start: '06:00', end: '09:29', every: 7 },
    { start: '09:30', end: '16:59', every: 15 },
    { start: '17:00', end: '19:29', every: 7 },
    { start: '19:30', end: '22:29', every: 20 },
  ]},
  E: { all: [
    { start: '04:00', end: '05:59', every: 25 },
    { start: '06:00', end: '09:29', every: 5 },
    { start: '09:30', end: '16:59', every: 15 },
    { start: '17:00', end: '19:29', every: 5 },
    { start: '19:30', end: '22:29', every: 25 },
  ]},
  S: { all: [
    { start: '04:00', end: '05:59', every: 20 },
    { start: '06:00', end: '09:29', every: 7 },
    { start: '09:30', end: '16:59', every: 15 },
    { start: '17:00', end: '19:29', every: 7 },
    { start: '19:30', end: '22:29', every: 20 },
  ]},
  D: { all: [ { start: '05:30', end: '22:30', every: 12 } ] },
  G: { all: [ { start: '05:30', end: '22:30', every: 12 } ] }
};

const expandDepartures = periods => {
  const out = [];
  periods.forEach(p => {
    let cur = toMin(p.start), end = toMin(p.end);
    while (cur <= end) { out.push(cur); cur += p.every; }
  });
  return out;
};

const BASE_DELAY_RATE = 0.10;
const RUSH_HOUR_DELAY_MULTIPLIER = 1.09;

function getTrainDelayInfo(trainSeed, mode = 'local') {
  const rng = seededRandom(trainSeed + '-delay');
  const roll = rng();
  const isRushHour = mode === 'rushAM' || mode === 'rushPM';
  const delayRate = BASE_DELAY_RATE * (isRushHour ? RUSH_HOUR_DELAY_MULTIPLIER : 1);
  const oneMinuteDelayThreshold = 1 - (BASE_DELAY_RATE * 0.20);

  if (roll < 1 - delayRate) {
    return { isDelayed: false, delaySeconds: 0, delayStartStop: -1 };
  } else if (roll < oneMinuteDelayThreshold) {
    const startStop = Math.floor(rng() * 2) + 2;
    return { isDelayed: true, delaySeconds: 60, delayStartStop: startStop };
  } else {
    const delayMins = Math.floor(rng() * 2) + 2;
    const startStop = Math.floor(rng() * 2) + 2;
    return { isDelayed: true, delaySeconds: delayMins * 60, delayStartStop: startStop };
  }
}

function calculateStopTimes(trainSeed, stops, departureMinutes, customSegmentTimes = null, mode = 'local') {
  const rng = seededRandom(trainSeed);
  const delayInfo = getTrainDelayInfo(trainSeed, mode);
  const result = [];
  const defaultSegmentSeconds = DEFAULT_SEGMENT_TIME * 60;
  let cumulativeSeconds = 0;

  for (let i = 0; i < stops.length; i++) {
    if (i > 0) {
      if (customSegmentTimes && customSegmentTimes[i - 1] !== undefined) {
        cumulativeSeconds += customSegmentTimes[i - 1] * 60;
      } else {
        cumulativeSeconds += defaultSegmentSeconds;
      }
    }

    const scheduledArrivalSec = departureMinutes * 60 + cumulativeSeconds;
    const arrivalOffset = Math.floor(rng() * 21) + 5;
    const dwellTime = Math.floor(rng() * 9) + 12;

    let delaySec = 0;
    let isStopDelayed = false;
    if (delayInfo.isDelayed && i >= delayInfo.delayStartStop) {
      delaySec = delayInfo.delaySeconds;
      isStopDelayed = true;
    }

    const actualArrivalSec = scheduledArrivalSec + arrivalOffset + delaySec;
    const actualDepartureSec = actualArrivalSec + dwellTime;

    result.push({
      name: stops[i],
      stopIndex: i,
      scheduledArrivalSec,
      scheduledDepartureSec: scheduledArrivalSec + dwellTime,
      actualArrivalSec,
      actualDepartureSec,
      isDelayed: isStopDelayed,
      delaySeconds: isStopDelayed ? delayInfo.delaySeconds : 0
    });
  }

  return { stops: result, hasDelay: delayInfo.isDelayed, delaySeconds: delayInfo.delaySeconds };
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

const SHUTTLE_EVENTS_CACHE = new Map();
function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getShuttleEventsForToday(serviceId, date = new Date()) {
  const dayKey = localDateKey(date);
  const key = `${serviceId}-${dayKey}`;
  if (SHUTTLE_EVENTS_CACHE.has(key)) return SHUTTLE_EVENTS_CACHE.get(key);

  const routes = ROUTES.filter(r => r.serviceId === serviceId && !r.isExpress);
  if (routes.length < 2) {
    SHUTTLE_EVENTS_CACHE.set(key, []);
    return [];
  }

  const preferredStartOrigin = (serviceId === 'G') ? 'Bradford Bay'
                           : (serviceId === 'D') ? 'Oakville City Airport'
                           : routes[0].origin;

  let curRoute = routes.find(r => r.origin === preferredStartOrigin) || routes[0];
  let otherRoute = routes.find(r => r !== curRoute) || routes[1];

  const periods = LINE_SERVICE[serviceId]?.all || [{ start: '05:30', end: '22:30', every: 9999 }];
  const dayStart = toMin(periods[0].start);
  const dayEnd = toMin(periods[periods.length - 1].end);

  const rng = seededRandom(`${key}-shuttle-seq`);
  let t0 = dayStart + Math.floor(rng() * 3);

  const events = [];
  while (t0 <= dayEnd) {
    const seg = curRoute.segmentTimes ? curRoute.segmentTimes : segFor(curRoute.stops);
    let cur = t0;

    for (let i = 0; i < curRoute.stops.length; i++) {
      events.push({
        station: curRoute.stops[i],
        time: cur,
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
        isSingleShuttle: true
      });
      if (i < seg.length) cur += seg[i];
    }

    const layover = 1 + rng() * 2;
    t0 = cur + layover;

    const tmp = curRoute;
    curRoute = otherRoute;
    otherRoute = tmp;
  }

  SHUTTLE_EVENTS_CACHE.set(key, events);
  return events;
}

function getRouteDepartureMinutes(routeDef) {
  const periods = LINE_SERVICE[routeDef.serviceId]?.all || [];
  const dep = expandDepartures(periods);

  const branchSeed = `${routeDef.serviceId}-${routeDef.tag}-${routeDef.origin}-${routeDef.destination}`;
  const rng = seededRandom(branchSeed);
  const baseOffset = Math.floor(rng() * 3);
  const deps = dep.map(t => t + baseOffset);

  return deps.map(t0 => {
    let slottedDepartureTime = t0;

    if (!SINGLE_TRAIN_SHUTTLES.has(routeDef.serviceId)) {
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
  });
}

function tripsForRoute(routeDef, mode = 'local') {
  const deps = getRouteDepartureMinutes(routeDef);
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

function arrivalsForStation(stationId, now = new Date()) {
  const nowMinRaw = now.getHours() * 60 + now.getMinutes();
  const mode = timeMode(now);
  const horizon = 6 * 60;
  const stationName = stationId;
  const out = [];
  const handledShuttles = new Set();

  ROUTES.forEach(r => {
    if (!isServiceAllowed(r, mode)) return;

    if (SINGLE_TRAIN_SHUTTLES.has(r.serviceId)) {
      if (handledShuttles.has(r.serviceId)) return;
      handledShuttles.add(r.serviceId);

      const trips = getShuttleEventsForToday(r.serviceId);
      for (const trip of trips) {
        if (trip.station !== stationName) continue;

        let arr = trip.time;
        let nowMin = nowMinRaw;
        if (mode === 'overnight') {
          if (arr < toMin('06:30')) arr += 1440;
          if (nowMinRaw < toMin('06:30')) nowMin += 1440;
        }

        const minsAway = arr - nowMin;
        if (minsAway >= -1 && minsAway <= horizon) {
          if (trip.destination === stationName) continue;
          out.push({ ...trip, timeMin: arr, minsAway, mode });
        }
      }
      return;
    }

    const trips = tripsForRoute(r, mode);
    for (const trip of trips) {
      if (trip.station !== stationName) continue;
      let arr = trip.time;
      let nowMin = nowMinRaw;
      if (mode === 'overnight') {
        if (arr < toMin('06:30')) arr += 1440;
        if (nowMinRaw < toMin('06:30')) nowMin += 1440;
      }
      const minsAway = arr - nowMin;
      if (minsAway >= -1 && minsAway <= horizon) {
        if (trip.destination === stationName) continue;
        out.push({ ...trip, timeMin: arr, minsAway, mode });
      }
    }
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

function buildScheduledRuns(planningDate, includeExpress = true) {
  const runs = [];

  ROUTES.forEach(route => {
    if (SINGLE_TRAIN_SHUTTLES.has(route.serviceId)) return;
    if (!includeExpress && route.isExpress) return;

    getRouteDepartureMinutes(route).forEach(departureMin => {
      const mode = timeModeForMinutes(departureMin);
      if (!isServiceAllowed(route, mode)) return;
      const effectiveRoute = getEffectiveRoutePattern(route, mode);
      const trainSeed = `${route.serviceId}-${route.tag}-${departureMin}-${route.origin}-${route.destination}`;
      const stopTimes = calculateStopTimes(trainSeed, effectiveRoute.stops, departureMin, effectiveRoute.segmentTimes, mode);
      runs.push({
        id: `${trainSeed}-${localDateKey(planningDate)}`,
        serviceId: route.serviceId,
        isExpress: route.isExpress,
        tag: route.tag,
        origin: route.origin,
        destination: route.destination,
        departureMin,
        mode,
        trainSeed,
        hasDelay: stopTimes.hasDelay,
        delaySeconds: stopTimes.delaySeconds,
        stops: stopTimes.stops
      });
    });
  });

  SINGLE_TRAIN_SHUTTLES.forEach(serviceId => {
    const originEvents = getShuttleEventsForToday(serviceId, planningDate)
      .filter(event => event.station === event.origin);
    originEvents.forEach(event => {
      const mode = timeModeForMinutes(event.departureMin);
      const trainSeed = `${event.serviceId}-${event.tag}-${event.departureMin}-${event.origin}-${event.destination}`;
      const stopTimes = calculateStopTimes(trainSeed, event.stops, event.departureMin, event.segmentTimes, mode);
      runs.push({
        id: `${trainSeed}-${localDateKey(planningDate)}`,
        serviceId: event.serviceId,
        isExpress: false,
        tag: event.tag,
        origin: event.origin,
        destination: event.destination,
        departureMin: event.departureMin,
        mode,
        trainSeed,
        hasDelay: stopTimes.hasDelay,
        delaySeconds: stopTimes.delaySeconds,
        stops: stopTimes.stops
      });
    });
  });

  return runs;
}

function stationHasActiveService(stationName, mode, includeExpress = true) {
  return ROUTES.some(route => {
    if (!includeExpress && route.isExpress) return false;
    if (!isServiceAllowed(route, mode)) return false;
    return getEffectiveRoutePattern(route, mode).stops.includes(stationName);
  });
}

function resolvePlanningStation(stationName, mode) {
  if (stationHasActiveService(stationName, mode, true)) {
    return { requested: stationName, effective: stationName, fallback: false };
  }
  const fallbackStation = INACTIVE_STATION_FALLBACKS[stationName];
  if (fallbackStation && stationHasActiveService(fallbackStation, mode, true)) {
    return { requested: stationName, effective: fallbackStation, fallback: true };
  }
  return { requested: stationName, effective: stationName, fallback: false, unavailable: true };
}

function planBORailTrip(originName, destinationName, planningDate) {
  const startTimeSec = planningDate.getHours() * 3600 + planningDate.getMinutes() * 60 + planningDate.getSeconds();
  const mode = timeMode(planningDate);
  const origin = resolvePlanningStation(originName, mode);
  const destination = resolvePlanningStation(destinationName, mode);

  if (origin.effective === destination.effective) {
    return { journeys: [], mode, origin, destination, sameEffectiveStation: true, planningDate };
  }

  const allRuns = buildScheduledRuns(planningDate, true);
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
        searchHorizonSec: 8 * 3600
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

  return { journeys, mode, origin, destination, planningDate, allRuns, localJourneys, allJourneys };
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
  if (mode === 'overnight') return 'Overnight';
  return 'Local Only';
}

const dropdownContainer = document.getElementById('stationDropdownContainer');
const dropdownTrigger = document.getElementById('stationDropdownTrigger');
const dropdownTriggerContent = document.getElementById('stationTriggerContent');
const dropdownOptionsPanel = document.getElementById('stationDropdownOptions');

const arrivalsEl = document.getElementById('arrivals');
const nowText = document.getElementById('nowText');
const limitSelect = document.getElementById('limitSelect');
const dirFilterSelect = document.getElementById('dirFilterSelect');
const serviceTypeFilterSelect = document.getElementById('serviceTypeFilterSelect');
const refreshBtn = document.getElementById('refreshBtn');
const upcomingTab = document.getElementById('upcomingTab');
const tripPlannerTab = document.getElementById('tripPlannerTab');
const upcomingView = document.getElementById('upcomingView');
const tripPlannerView = document.getElementById('tripPlannerView');
const upcomingHeaderControls = document.getElementById('upcomingHeaderControls');
const plannerServiceState = document.getElementById('plannerServiceState');
const tripOriginSelect = document.getElementById('tripOriginSelect');
const tripDestinationSelect = document.getElementById('tripDestinationSelect');
const tripOriginDropdownContainer = document.getElementById('tripOriginDropdownContainer');
const tripOriginDropdownTrigger = document.getElementById('tripOriginDropdownTrigger');
const tripOriginTriggerContent = document.getElementById('tripOriginTriggerContent');
const tripOriginDropdownOptions = document.getElementById('tripOriginDropdownOptions');
const tripDestinationDropdownContainer = document.getElementById('tripDestinationDropdownContainer');
const tripDestinationDropdownTrigger = document.getElementById('tripDestinationDropdownTrigger');
const tripDestinationTriggerContent = document.getElementById('tripDestinationTriggerContent');
const tripDestinationDropdownOptions = document.getElementById('tripDestinationDropdownOptions');
const swapTripStations = document.getElementById('swapTripStations');
const departNowButton = document.getElementById('departNowButton');
const departLaterButton = document.getElementById('departLaterButton');
const futureDepartureFields = document.getElementById('futureDepartureFields');
const tripDateInput = document.getElementById('tripDateInput');
const tripTimeInput = document.getElementById('tripTimeInput');
const findTripsButton = document.getElementById('findTripsButton');
const tripPlannerResults = document.getElementById('tripPlannerResults');

const openDetails = new Set();
const expandedStops = new Set();
let activeStationId = '';
let activeTimetableView = 'upcoming';
let tripDepartureMode = 'now';
let tripOriginDropdown;
let tripDestinationDropdown;

function getBadgesForStation(stationId, { serviceOrder = null, expressFirst = false } = {}) {
  const linesMap = {};
  ROUTES.forEach(route => {
    if (route.stops.includes(stationId)) {
      if (!linesMap[route.serviceId]) {
        linesMap[route.serviceId] = { local: false, express: false };
      }
      if (route.isExpress) {
        linesMap[route.serviceId].express = true;
      } else {
        linesMap[route.serviceId].local = true;
      }
    }
  });

  let htmlString = '';
  const sortedServiceIds = Object.keys(linesMap).sort((left, right) => {
    if (!serviceOrder) return left.localeCompare(right);
    const leftIndex = serviceOrder.indexOf(left);
    const rightIndex = serviceOrder.indexOf(right);
    return (leftIndex < 0 ? serviceOrder.length : leftIndex) - (rightIndex < 0 ? serviceOrder.length : rightIndex);
  });
  sortedServiceIds.forEach(serviceId => {
    const meta = SERVICE_META[serviceId];
    if (!meta) return;
    const localBadge = linesMap[serviceId].local && meta.localIcon
      ? `<img class="dropdown-badge-img" src="${meta.localIcon}" alt="(${serviceId})">`
      : '';
    const expressBadge = linesMap[serviceId].express && meta.expressIcon
      ? `<img class="dropdown-badge-img" src="${meta.expressIcon}" alt="<${serviceId}>">`
      : '';
    htmlString += expressFirst ? expressBadge + localBadge : localBadge + expressBadge;
  });
  return htmlString;
}

function getPlannerBadgesForStation(stationId) {
  return getBadgesForStation(stationId, {
    serviceOrder: ['F', 'A', 'S', 'B', 'C', 'D', 'E', 'G'],
    expressFirst: true
  });
}

function closeStationDropdowns(except = null) {
  document.querySelectorAll('.custom-select-container.open').forEach(container => {
    if (container === except) return;
    container.classList.remove('open');
    container.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
  });
  syncTripDropdownLayer();
}

function syncTripDropdownLayer() {
  document.body.classList.toggle('trip-dropdown-open', Boolean(document.querySelector('.trip-custom-select.open')));
}

function createTripStationDropdown({ container, trigger, triggerContent, optionsPanel, input, initialValue }) {
  const sortedStations = [...STATIONS].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  );

  const controller = {
    get value() {
      return input.value;
    },
    setValue(value) {
      const station = sortedStations.find(item => item.id === value);
      if (!station) return false;
      input.value = station.id;
      render();
      return true;
    }
  };

  function render() {
    const selected = sortedStations.find(station => station.id === input.value) || sortedStations[0];
    input.value = selected.id;
    triggerContent.innerHTML = `
      <span class="station-trigger-name">${tripEscape(selected.name)}</span>
      <span class="station-item-badges">${getPlannerBadgesForStation(selected.id)}</span>
    `;
    optionsPanel.innerHTML = sortedStations.map(station => `
      <button type="button" class="custom-option-item ${station.id === selected.id ? 'selected' : ''}"
        data-value="${tripEscape(station.id)}" role="option" aria-selected="${station.id === selected.id}">
        <span class="station-item-name">${tripEscape(station.name)}</span>
        <span class="station-item-badges">${getPlannerBadgesForStation(station.id)}</span>
      </button>
    `).join('');

    optionsPanel.querySelectorAll('.custom-option-item').forEach(option => {
      option.addEventListener('click', event => {
        event.stopPropagation();
        controller.setValue(option.dataset.value);
        container.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        syncTripDropdownLayer();
        trigger.focus();
      });
    });
  }

  trigger.addEventListener('click', event => {
    event.stopPropagation();
    const shouldOpen = !container.classList.contains('open');
    closeStationDropdowns(container);
    container.classList.toggle('open', shouldOpen);
    trigger.setAttribute('aria-expanded', String(shouldOpen));
    syncTripDropdownLayer();
    if (shouldOpen) {
      requestAnimationFrame(() => {
        const selectedOption = optionsPanel.querySelector('.custom-option-item.selected');
        if (!selectedOption) return;
        optionsPanel.scrollTop = Math.max(0, selectedOption.offsetTop - (optionsPanel.clientHeight - selectedOption.offsetHeight) / 2);
      });
    }
  });

  trigger.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    container.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    syncTripDropdownLayer();
  });

  controller.setValue(initialValue);
  return controller;
}

function renderCustomStationsDropdown() {
  const sorted = [...STATIONS].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  );

  if (!activeStationId) {
    activeStationId = sorted[0].id;
  }

  let optionsHtml = '';
  sorted.forEach(s => {
    const badgeImages = getBadgesForStation(s.id);
    const isSelectedClass = (s.id === activeStationId) ? 'selected' : '';
    optionsHtml += `
      <div class="custom-option-item ${isSelectedClass}" data-value="${s.id}">
        <span class="station-item-name">${s.name}</span>
        <div class="station-item-badges">${badgeImages}</div>
      </div>
    `;
  });
  dropdownOptionsPanel.innerHTML = optionsHtml;

  const activeStationObj = sorted.find(s => s.id === activeStationId) || sorted[0];
  dropdownTriggerContent.innerHTML = `
    <span class="station-trigger-name">${activeStationObj.name}</span>
    <div class="station-item-badges">${getBadgesForStation(activeStationObj.id)}</div>
  `;

  dropdownOptionsPanel.querySelectorAll('.custom-option-item').forEach(item => {
    item.addEventListener('click', (e) => {
      activeStationId = item.dataset.value;
      const selectedName = item.querySelector('.station-item-name').textContent;
      const selectedBadgesHtml = item.querySelector('.station-item-badges').innerHTML;
      dropdownTriggerContent.innerHTML = `
        <span class="station-trigger-name">${selectedName}</span>
        <div class="station-item-badges">${selectedBadgesHtml}</div>
      `;
      dropdownContainer.classList.remove('open');
      openDetails.clear();
      expandedStops.clear();
      renderCustomStationsDropdown();
      renderArrivals();
    });
  });
}

dropdownTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  const shouldOpen = !dropdownContainer.classList.contains('open');
  closeStationDropdowns(dropdownContainer);
  dropdownContainer.classList.toggle('open', shouldOpen);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select-container')) closeStationDropdowns();
});

function renderClock() {
  const now = new Date();
  nowText.textContent = `Now: ${formatTime24Full(now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds())}`;
  const mode = timeMode(now);
  serviceState.textContent = (mode === 'rushAM' || mode === 'rushPM') ? 'Service: Rush (LCL+EXP)' :
                             (mode === 'local') ? 'Service: Local only' :
                             'Service: Overnight';
  serviceState.classList.toggle('late-night', mode === 'overnight');
}

function iconFor(serviceId, isExpress) {
  const meta = SERVICE_META[serviceId];
  if (isExpress && meta.expressIcon) return meta.expressIcon;
  return meta.localIcon;
}

function serviceLabel(serviceId, isExpress) {
  return isExpress ? `<${serviceId}>` : `(${serviceId})`;
}

function lineBadgeHtml(serviceId, isExpress) {
  const src = iconFor(serviceId, isExpress);
  return `<img src="${src}" alt="${serviceId} ${isExpress?'Express':'Local'}" style="width:22px;height:22px;border-radius:6px;object-fit:contain;"/>`;
}

function slideDown(el) {
  el.classList.add('open');
  el.style.maxHeight = el.scrollHeight + 'px';
  el.style.opacity = '1';
}

function setTimetableView(view) {
  activeTimetableView = view;
  const plannerActive = view === 'planner';
  upcomingView.hidden = plannerActive;
  tripPlannerView.hidden = !plannerActive;
  upcomingHeaderControls.hidden = plannerActive;
  upcomingTab.classList.toggle('active', !plannerActive);
  tripPlannerTab.classList.toggle('active', plannerActive);
  upcomingTab.setAttribute('aria-selected', String(!plannerActive));
  tripPlannerTab.setAttribute('aria-selected', String(plannerActive));
  if (plannerActive) updatePlannerServiceState(getTripPlanningDate(false) || new Date());
}

function inputDateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function inputTimeValue(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function initializeTripPlanner() {
  tripOriginDropdown = createTripStationDropdown({
    container: tripOriginDropdownContainer,
    trigger: tripOriginDropdownTrigger,
    triggerContent: tripOriginTriggerContent,
    optionsPanel: tripOriginDropdownOptions,
    input: tripOriginSelect,
    initialValue: 'Newkirk'
  });
  tripDestinationDropdown = createTripStationDropdown({
    container: tripDestinationDropdownContainer,
    trigger: tripDestinationDropdownTrigger,
    triggerContent: tripDestinationTriggerContent,
    optionsPanel: tripDestinationDropdownOptions,
    input: tripDestinationSelect,
    initialValue: 'New Halifax'
  });

  const now = new Date();
  tripDateInput.value = inputDateValue(now);
  tripDateInput.min = inputDateValue(now);
  tripTimeInput.value = inputTimeValue(new Date(now.getTime() + 15 * 60000));
  updatePlannerServiceState(now);
}

function setTripDepartureMode(mode) {
  tripDepartureMode = mode;
  const leaveLater = mode === 'later';
  departNowButton.classList.toggle('active', !leaveLater);
  departLaterButton.classList.toggle('active', leaveLater);
  futureDepartureFields.hidden = !leaveLater;
  updatePlannerServiceState(getTripPlanningDate(false) || new Date());
}

function getTripPlanningDate(showError = true) {
  if (tripDepartureMode === 'now') return new Date();
  if (!tripDateInput.value || !tripTimeInput.value) {
    if (showError) renderTripPlannerMessage('Choose a departure date and time.', 'The planner needs both fields before it can search.');
    return null;
  }
  const date = new Date(`${tripDateInput.value}T${tripTimeInput.value}:00`);
  if (Number.isNaN(date.getTime())) {
    if (showError) renderTripPlannerMessage('That departure time is invalid.', 'Please choose another date and time.');
    return null;
  }
  if (date.getTime() < Date.now() - 60000) {
    if (showError) renderTripPlannerMessage('That departure time has already passed.', 'Choose Depart Now or a future time.');
    return null;
  }
  return date;
}

function updatePlannerServiceState(date) {
  const mode = timeMode(date);
  plannerServiceState.textContent = `Service: ${plannerModeLabel(mode)}`;
  plannerServiceState.classList.toggle('late-night', mode === 'overnight');
}

function routePillHtml(leg) {
  const meta = SERVICE_META[leg.serviceId];
  return `<span class="route-pill" style="--route-color:${meta.color}">
    <img src="${iconFor(leg.serviceId, leg.isExpress)}" alt="${tripEscape(serviceLabel(leg.serviceId, leg.isExpress))}">
    <span>${tripEscape(leg.destination)}</span>
  </span>`;
}

function fallbackNoticeHtml(result) {
  const notices = [];
  if (result.origin.fallback) {
    notices.push(`<div class="fallback-notice"><span>↗</span><span>No active trains depart ${tripEscape(result.origin.requested)} during ${tripEscape(plannerModeLabel(result.mode))}. Begin at ${tripEscape(result.origin.effective)} by walking/alternate transportation.</span></div>`);
  }
  if (result.destination.fallback) {
    notices.push(`<div class="fallback-notice"><span>↗</span><span>No active trains reach ${tripEscape(result.destination.requested)} during ${tripEscape(plannerModeLabel(result.mode))}. Rail service ends at ${tripEscape(result.destination.effective)}; continue by walking/alternate transportation.</span></div>`);
  }
  return notices.join('');
}

function transferSummaryHtml(journey) {
  if (!journey.transfers) return 'Direct train';
  const stations = journey.legs.slice(0, -1).map(leg => leg.alightStation);
  return `Transfer at ${stations.map(tripEscape).join(', then ')}`;
}

function renderTripLeg(leg, nextLeg) {
  const meta = SERVICE_META[leg.serviceId];
  const consist = getTrainConsist(leg.trainSeed, leg.serviceId, leg.isExpress);
  if (SINGLE_TRAIN_SHUTTLES.has(leg.serviceId)) {
    consist.model = 'MTC-T 110';
    consist.cars = 2;
    const fixed = FIXED_SHUTTLE_LEAD_CARS[leg.serviceId] && FIXED_SHUTTLE_LEAD_CARS[leg.serviceId][leg.destination];
    if (typeof fixed === 'number') consist.leadCar = fixed;
  }

  const stopsHtml = leg.stops.map((stop, index) => {
    const endpoint = index === 0 || index === leg.stops.length - 1;
    const delayed = stop.isDelayed && stop.actualArrivalSec !== stop.scheduledArrivalSec;
    return `<div class="trip-stop ${endpoint ? 'endpoint' : ''}">
      <span class="trip-stop-time">${formatTripClock(index === 0 ? stop.actualDepartureSec : stop.actualArrivalSec)}</span>
      <span>${tripEscape(stop.name)}${delayed ? ` <small style="color:var(--warning)">+${Math.round(stop.delaySeconds / 60)}m</small>` : ''}</span>
    </div>`;
  }).join('');

  let transferHtml = '';
  if (nextLeg) {
    const waitSeconds = nextLeg.actualDepartureSec - leg.actualArrivalSec;
    const tight = waitSeconds <= 4 * 60;
    transferHtml = `<div class="transfer-block ${tight ? 'tight' : ''}">
      <span class="transfer-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h4.2c3.8 0 3.8 10 7.6 10H20m-3-3 3 3-3 3M4 17h4.2c3.8 0 3.8-10 7.6-10H20m-3-3 3 3-3 3"/></svg></span>
      <div class="transfer-block-copy"><strong>Transfer at ${tripEscape(leg.alightStation)} • ${formatTripDuration(waitSeconds)}</strong>
      <span>${tight ? 'Train may not wait' : `Next train departs at ${formatTripClock(nextLeg.actualDepartureSec)}`}</span></div>
    </div>`;
  }

  return `<div class="trip-leg">
    <div class="trip-leg-card">
      <img src="${iconFor(leg.serviceId, leg.isExpress)}" alt="${tripEscape(serviceLabel(leg.serviceId, leg.isExpress))}">
      <div><strong>Train toward ${tripEscape(leg.destination)}</strong><span>${tripEscape(consist.model)} • ${consist.cars} cars • Lead car ${consist.leadCar}</span></div>
      <div class="trip-leg-time"><strong>${formatTripClock(leg.actualDepartureSec)}</strong><span>${tripEscape(leg.boardStation)}</span></div>
    </div>
    <div class="trip-stop-timeline" style="--leg-color:${meta.color}">${stopsHtml}</div>
    ${transferHtml}
  </div>`;
}

function renderJourneyCard(journey, index, result) {
  const first = journey.legs[0];
  const waitSeconds = journey.departureSec - journey.requestedDepartureSec;
  const tightTransfer = journey.legs.slice(1).some(leg => leg.transferWaitSec <= 4 * 60);
  const pills = journey.legs.map((leg, legIndex) => `${legIndex ? '<span class="route-pill-arrow">›</span>' : ''}${routePillHtml(leg)}`).join('');
  const details = journey.legs.map((leg, legIndex) => renderTripLeg(leg, journey.legs[legIndex + 1])).join('');
  const rush = result.mode === 'rushAM' || result.mode === 'rushPM';

  const isFastest = index === 0;

  return `<details class="trip-option ${isFastest ? 'fastest' : ''}" ${index === 0 ? 'open' : ''}>
    <summary>
      <div class="trip-option-top">
        <div>
          <div class="trip-time-range">${formatTripClock(journey.departureSec)} <span>–</span> ${formatTripClock(journey.arrivalSec)}</div>
          <div class="trip-badges">
            ${isFastest ? '<span class="trip-badge fastest">Fastest</span>' : ''}
            ${journey.hasDelay ? '<span class="trip-badge delay">Delay included</span>' : ''}
            ${rush ? `<span class="trip-badge rush">${plannerModeLabel(result.mode)}</span>` : ''}
          </div>
        </div>
        <div class="trip-departs-in">${waitSeconds < 60 ? 'departing now' : `in ${Math.max(1, Math.round(waitSeconds / 60))} min`}</div>
      </div>
      <div class="trip-pill-chain">${pills}</div>
      <div class="trip-transfer-summary">${transferSummaryHtml(journey)}</div>
      <div class="trip-meta"><span>${formatTripDuration(journey.rideDurationSec)} total</span><span>${journey.transfers} transfer${journey.transfers === 1 ? '' : 's'}</span><span>${journey.legs.reduce((sum, leg) => sum + leg.stops.length - 1, 0)} stops</span></div>
      ${tightTransfer ? '<div class="journey-warning"><span>⇄</span><span>One connection is tight. Train may not wait, so be ready to transfer.</span></div>' : ''}
      ${journey.hasDelay ? '<div class="journey-warning delay-warning"><span>!</span><span>Delay is included in this estimate. The shown connections remain catchable, but conditions can change.</span></div>' : ''}
      ${fallbackNoticeHtml(result)}
    </summary>
    <div class="trip-details">
      ${result.origin.fallback ? `<div class="alternate-final-step"><strong>Before boarding:</strong> Continue from ${tripEscape(result.origin.requested)} to ${tripEscape(result.origin.effective)} by walking/alternate transportation.</div>` : ''}
      ${details}
      ${result.destination.fallback ? `<div class="alternate-final-step"><strong>After the train:</strong> Continue from ${tripEscape(result.destination.effective)} to ${tripEscape(result.destination.requested)} by walking/alternate transportation.</div>` : ''}
    </div>
  </details>`;
}

function renderTripPlannerMessage(title, message) {
  tripPlannerResults.innerHTML = `<div class="trip-no-results"><strong>${tripEscape(title)}</strong><span>${tripEscape(message)}</span></div>`;
}

function findAndRenderTrips() {
  const origin = tripOriginSelect.value;
  const destination = tripDestinationSelect.value;
  if (!origin || !destination) {
    renderTripPlannerMessage('Choose both stations.', 'Select where you are leaving from and where you want to go.');
    return;
  }
  if (origin === destination) {
    renderTripPlannerMessage('You are already there.', 'Choose two different stations to plan a trip.');
    return;
  }
  const planningDate = getTripPlanningDate(true);
  if (!planningDate) return;
  updatePlannerServiceState(planningDate);
  findTripsButton.disabled = true;
  findTripsButton.textContent = 'Planning…';

  requestAnimationFrame(() => {
    const result = planBORailTrip(origin, destination, planningDate);
    findTripsButton.disabled = false;
    findTripsButton.textContent = 'Find Trips';

    if (result.origin.unavailable || result.destination.unavailable) {
      renderTripPlannerMessage('No active service found.', 'BORail could not find an active station or approved fallback for this trip.');
      return;
    }
    if (result.sameEffectiveStation) {
      renderTripPlannerMessage('Use alternate transportation.', `${result.origin.requested} and ${result.destination.requested} use the same active fallback station: ${result.origin.effective}.`);
      return;
    }
    if (!result.journeys.length) {
      renderTripPlannerMessage('No catchable trip found.', 'No trains can complete this journey within the next eight hours. Try a different departure time.');
      return;
    }
    tripPlannerResults.innerHTML = result.journeys.map((journey, index) => renderJourneyCard(journey, index, result)).join('');
  });
}

function renderArrivals() {
  const now = new Date();
  const station = activeStationId;
  const limit = Number(limitSelect.value || 8);

  const allRawRows = arrivalsForStation(station, now);
  const nowSeconds = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();

  if (allRawRows.length === 0) {
    dirFilterSelect.innerHTML = '<option value="ALL">All</option>';
    arrivalsEl.innerHTML = `<div class="subtle">No upcoming trains in the next 6 hours.</div>`;
    return;
  }

  const availableDirections = new Set();
  allRawRows.forEach(r => {
    const bound = getTrainDirection(r.serviceId, r.destination);
    availableDirections.add(bound);
  });

  const currentFilterValue = dirFilterSelect.value || 'ALL';
  let filterHtml = '<option value="ALL">All Directions</option>';
  [...availableDirections].sort().forEach(dir => {
    filterHtml += `<option value="${dir}">${dir}</option>`;
  });
  dirFilterSelect.innerHTML = filterHtml;

  if (availableDirections.has(currentFilterValue) || currentFilterValue === 'ALL') {
    dirFilterSelect.value = currentFilterValue;
  } else {
    dirFilterSelect.value = 'ALL';
  }

  const activeFilter = dirFilterSelect.value;
  const activeServiceType = serviceTypeFilterSelect.value;

  const filteredRows = allRawRows.filter(r => {
    let matchDir = true;
    if (activeFilter !== 'ALL') {
      matchDir = (getTrainDirection(r.serviceId, r.destination) === activeFilter);
    }
    let matchService = true;
    if (activeServiceType === 'LOCAL') {
      matchService = !r.isExpress;
    } else if (activeServiceType === 'EXPRESS') {
      matchService = r.isExpress;
    }
    return matchDir && matchService;
  });

  const rows = filteredRows.slice(0, limit);

  if (rows.length === 0) {
    arrivalsEl.innerHTML = `<div class="subtle">No upcoming ${activeFilter} trains found.</div>`;
    return;
  }

  const directionsMap = {
    'Northbound': [],
    'Southbound': [],
    'Eastbound': [],
    'Westbound': []
  };

  rows.forEach((r, idx) => {
    const bound = getTrainDirection(r.serviceId, r.destination);
    directionsMap[bound].push({ r, idx });
  });

  let fullContainerHtml = '';
  for (const [directionName, arrivalsList] of Object.entries(directionsMap)) {
    if (arrivalsList.length === 0) continue;

    let directionCardsHtml = arrivalsList.map(({ r, idx }) => {
      const trainSeed = `${r.serviceId}-${r.tag}-${r.departureMin}-${r.origin}-${r.destination}`;
      const consist = getTrainConsist(trainSeed, r.serviceId, r.isExpress);

      if (SINGLE_TRAIN_SHUTTLES.has(r.serviceId)) {
        consist.model = 'MTC-T 110';
        consist.cars = 2;
        const fixed = FIXED_SHUTTLE_LEAD_CARS[r.serviceId] && FIXED_SHUTTLE_LEAD_CARS[r.serviceId][r.destination];
        if (typeof fixed === 'number') consist.leadCar = fixed;
      }

      const stopTimes = calculateStopTimes(trainSeed, r.stops, r.departureMin, r.segmentTimes, r.mode);
      const pos = getTrainPosition(stopTimes, nowSeconds);
      const minsText = (r.minsAway <= 0) ? 'Now' : `${Math.round(r.minsAway)} min`;
      const trainId = `${r.serviceId}-${r.tag}-${r.departureMin}-${idx}`.replace(/[^a-zA-Z0-9_-]/g,'');
      const isOpen = openDetails.has(trainId);
      const isExpanded = expandedStops.has(trainId);

      const stopsHtml = stopTimes.stops.map((st, i) => {
        let cls = 'stop-item';
        let icon = ICONS.pinGray;

        if (pos.status === 'at-station' && pos.currentIndex === i) {
          cls += ' current' + (st.isDelayed ? ' delayed' : '');
          icon = st.isDelayed ? ICONS.pinOrange : ICONS.pinGreen;
        } else if (pos.status === 'en-route' && i === pos.toIndex) {
          cls += ' en-route';
          icon = ICONS.pinDim;
        } else if ((pos.status === 'at-station' && i < pos.currentIndex) ||
                   (pos.status === 'en-route' && i < pos.fromIndex)) {
          cls += ' past';
          icon = ICONS.pinDim;
        }

        const sched = formatTime24Full(st.scheduledArrivalSec);
        const actual = formatTime24Full(st.actualArrivalSec);
        const delayed = st.isDelayed && (actual !== sched);
        const timeHtml = delayed
          ? `<span class="scheduled">${sched}</span><span class="new-time">${actual}</span>`
          : `<span>${actual}</span>`;

        // Check if current item station qualifies for accessibility layout injection
        const accessIconHtml = ACCESSIBLE_STATIONS.has(st.name)
          ? `<img class="accessible-icon-tiny" src="${ACCESSIBLE_ICON_URL}" alt="Accessible station" />`
          : '';

        return `<li class="${cls}">
          <span class="stop-icon">${icon}</span>
          <div class="stop-time-main ${delayed ? 'delayed' : ''}">${timeHtml}</div>
          <div class="stop-name">${st.name} ${accessIconHtml}</div>
          <div class="stop-details">
            <span class="detail-item">${ICONS.clock}<span>${st.isDelayed ? `Delayed ${Math.round(st.delaySeconds/60)}m` : 'On time'}</span></span>
          </div>
        </li>`;
      }).join('');

      const originStop = stopTimes.stops[0];
      const destStop = stopTimes.stops[stopTimes.stops.length - 1];

      let statusBanner = '';
      if (pos.status === 'at-station') {
        statusBanner = `<div class="en-route-banner">${ICONS.clock} At ${pos.currentStop}${pos.isDelayed ? ' (delayed)' : ''}</div>`;
      } else if (pos.status === 'en-route') {
        statusBanner = `<div class="en-route-banner">${ICONS.clock} En route: ${pos.fromStop} → ${pos.toStop}</div>`;
      } else if (pos.status === 'not-started') {
        statusBanner = `<div class="en-route-banner">${ICONS.clock} Not started yet</div>`;
      }

      const badge = lineBadgeHtml(r.serviceId, r.isExpress);
      return `<details class="row" data-train-id="${trainId}" ${isOpen ? 'open' : ''}>
        <summary style="list-style:none; cursor:pointer;">
          <div>
            <div class="lineTag" style="display:flex; align-items:center; gap:8px;">
              ${badge} <span>Line</span>
            </div>
            <div class="dest">to ${r.destination}</div>
          </div>
          <div class="mins">${minsText}</div>
        </summary>
        <div style="margin-top:10px;">
          <div class="train-info-box">
            <div class="train-info-header">
              <span class="route-code">${r.tag}</span>
              <span>${r.origin} to ${r.destination}</span>
            </div>
            <div class="train-info-details">
              <span class="model">${consist.model}</span>
              <span>with ${consist.cars} Cars</span>
              <span class="lead-car">Lead Car: ${consist.leadCar}</span>
            </div>
          </div>
          ${statusBanner}
          <div class="compact-view" id="compact-${trainId}" style="${isExpanded ? 'display:none;' : ''}">
            <div class="compact-stop ${pos.status==='not-started'?'at-station':''}">
              <div class="compact-time"><span class="scheduled">${formatTime24Full(originStop.actualArrivalSec)}</span></div>
              <div class="compact-icon">${ICONS.pinDim}</div>
              <div class="compact-name">${originStop.name}</div>
            </div>
            <button class="mid-stops-btn" data-action="expand" data-train-id="${trainId}">Show all stops</button>
            <div class="compact-stop">
              <div class="compact-time"><span class="scheduled">${formatTime24Full(destStop.actualArrivalSec)}</span></div>
              <div class="compact-icon">${ICONS.pinDim}</div>
              <div class="compact-name">${destStop.name}</div>
            </div>
          </div>
          <div class="slide" id="full-${trainId}" style="${isExpanded ? 'display:block; max-height:none; opacity:1;' : 'display:none;'}">
            <div class="subtle" style="margin-bottom:8px;">Making stops at…</div>
            <ul class="stops-list">${stopsHtml}</ul>
          </div>
        </div>
      </details>`;
    }).join('');

    fullContainerHtml += `
      <div class="direction-group">
        <div class="direction-title">
          <span>${directionName} Departures</span>
        </div>
        <div class="list">${directionCardsHtml}</div>
      </div>
    `;
  }

  arrivalsEl.innerHTML = fullContainerHtml;
  wireUpEventListeners();
}

function wireUpEventListeners() {
  arrivalsEl.querySelectorAll('details.row').forEach(d => {
    const trainId = d.dataset.trainId;
    d.addEventListener('toggle', () => {
      if (d.open) {
        openDetails.add(trainId);
      } else {
        openDetails.delete(trainId);
        expandedStops.delete(trainId);
        const compact = d.querySelector(`#compact-${trainId}`);
        const full = d.querySelector(`#full-${trainId}`);
        if (compact) compact.style.display = '';
        if (full) {
          full.style.display = 'none';
          full.classList.remove('open');
          full.style.maxHeight = '0px';
        }
      }
    });
  });

  arrivalsEl.querySelectorAll('[data-action="expand"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const trainId = btn.dataset.trainId;
      const compact = document.getElementById(`compact-${trainId}`);
      const full = document.getElementById(`full-${trainId}`);
      if (compact && full) {
        compact.style.display = 'none';
        full.style.display = 'block';
        full.style.maxHeight = '0px';
        full.style.opacity = '0';
        requestAnimationFrame(() => slideDown(full));
        expandedStops.add(trainId);
      }
    });
  });
}

renderCustomStationsDropdown();
initializeTripPlanner();
renderClock();
renderArrivals();

setInterval(() => {
  renderClock();
  renderArrivals();
  if (activeTimetableView === 'planner' && tripDepartureMode === 'now') updatePlannerServiceState(new Date());
}, 5000);

limitSelect.addEventListener('change', renderArrivals);
dirFilterSelect.addEventListener('change', renderArrivals);
serviceTypeFilterSelect.addEventListener('change', renderArrivals);
refreshBtn.addEventListener('click', () => { renderClock(); renderArrivals(); });
upcomingTab.addEventListener('click', () => setTimetableView('upcoming'));
tripPlannerTab.addEventListener('click', () => setTimetableView('planner'));
departNowButton.addEventListener('click', () => setTripDepartureMode('now'));
departLaterButton.addEventListener('click', () => setTripDepartureMode('later'));
tripDateInput.addEventListener('change', () => updatePlannerServiceState(getTripPlanningDate(false) || new Date()));
tripTimeInput.addEventListener('change', () => updatePlannerServiceState(getTripPlanningDate(false) || new Date()));
swapTripStations.addEventListener('click', () => {
  const origin = tripOriginSelect.value;
  tripOriginDropdown.setValue(tripDestinationSelect.value);
  tripDestinationDropdown.setValue(origin);
});
findTripsButton.addEventListener('click', findAndRenderTrips);

window.BORailTripDebug = {
  planBORailTrip,
  buildScheduledRuns,
  resolvePlanningStation,
  getEffectiveRoutePattern,
  timeModeForMinutes,
  getBadgesForStation,
  setTripStations(origin, destination) {
    return tripOriginDropdown.setValue(origin) && tripDestinationDropdown.setValue(destination);
  }
};

const splash = document.getElementById('splash-screen');
if (splash) {
  const navEntry = performance.getEntriesByType?.('navigation')?.[0];
  const isReload = navEntry?.type === 'reload';
  const splashSeen = sessionStorage.getItem('borailTimetableSplashSeen') === 'true';

  if (splashSeen && !isReload) {
    splash.remove();
  } else {
    sessionStorage.setItem('borailTimetableSplashSeen', 'true');
    splash.addEventListener('animationend', (e) => {
      if (e.animationName === 'fadeOutSplash') {
        splash.remove();
      }
    });
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
