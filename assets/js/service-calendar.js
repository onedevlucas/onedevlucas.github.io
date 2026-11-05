(function initializeBORailServiceCalendar(global) {
  'use strict';

  const CLOCK = global.BORailTime;
  if (!CLOCK) throw new Error('BORailTime must load before BORailService.');

  const OPEN_MINUTE = 6 * 60;
  const LAST_ORIGIN_DEPARTURE_MINUTE = 23 * 60;
  const WINTER_START = { month: 12, day: 10 };
  const WINTER_END = { month: 3, day: 10 };
  const WINTER_EMERGENCY_DAY_COUNT = 10;
  const WINTER_DELAY_RATE = 0.60;
  const WINTER_DELAY_MINUTES = { min: 5, max: 15 };
  const BASE_DELAY_RATE = 0.10;
  const RUSH_DELAY_MULTIPLIER = 1.09;

  const reverseRoute = route => ({
    ...route,
    dir: route.reverseDir,
    origin: route.destination,
    destination: route.origin,
    stops: [...route.stops].reverse()
  });

  const WINTER_ROUTE_PAIRS = [
    {
      serviceId: 'F', isExpress: false, tag: 'LCL', dir: 'SB', reverseDir: 'NB',
      origin: 'Newkirk', destination: 'Boylston',
      stops: ['Newkirk', 'Newkirk - Oak Street', 'Hoganville', 'Bayview Park', 'Chelsea Bay', 'Berwick Hall', 'Cambridge Central', 'Atkinson Junction', 'La Vista', 'Brookfield Lawn', 'Boylston']
    },
    {
      serviceId: 'F', isExpress: false, tag: 'LCL', dir: 'SB', reverseDir: 'NB',
      origin: 'Atkinson Junction', destination: 'Kenilworth',
      stops: ['Atkinson Junction', 'Garner', 'Kenilworth'],
      singleTrainShuttle: true,
      shuttleKey: 'F-winter-shuttle',
      terminalLayoverMinutes: 5,
      intermediateDwellMinutes: 1
    },
    {
      serviceId: 'G', isExpress: false, tag: 'LCL', dir: 'WB', reverseDir: 'EB',
      origin: 'Berwick Hall', destination: 'Bradford Bay',
      stops: ['Berwick Hall', 'Westpoint', 'Bradford Square', 'Bradford Bay'],
      segmentTimes: [2, 1.5, 1.5], singleTrainShuttle: true, shuttleKey: 'G'
    },
    {
      serviceId: 'A', isExpress: false, tag: 'LCL', dir: 'SB', reverseDir: 'NB',
      origin: 'Newkirk', destination: 'Mount River',
      stops: ['Newkirk', 'Burlington - University of NCU', 'Willow Springs', 'Rockcastle', 'Cannon View', 'Atkins Bridge', 'Radcliff Fields', 'Oakville City Airport', 'Oakville Exchange', 'Oakville Plaza', 'Talmedge Hill', 'Mount River']
    },
    {
      serviceId: 'S', isExpress: false, tag: 'LCL', dir: 'SB', reverseDir: 'NB',
      origin: 'Cannon View', destination: 'Ralston-Finch East',
      stops: ['Cannon View', 'Ivory Knolls', 'Djimar', 'Vanderburg', 'Ralston-Finch East']
    },
    {
      serviceId: 'D', isExpress: false, tag: 'LCL', dir: 'WB', reverseDir: 'EB',
      origin: 'Veridia Nexus', destination: 'Oakville City Airport',
      stops: ['Veridia Nexus', 'Oakville City Airport'], segmentTimes: [1.5],
      singleTrainShuttle: true, shuttleKey: 'D'
    },
    {
      serviceId: 'C', isExpress: false, tag: 'LCL', dir: 'NB', reverseDir: 'SB',
      origin: 'Fernwood', destination: 'East Heights',
      stops: ['Fernwood', 'Joplin', 'Yoakum', 'Fort Meadow', 'Leighton Castle', 'Oakville Plaza', 'Oakville City Center', 'Oakville Exchange', 'Perry Road', 'Mount Hindsboro', 'Wood-by-Hike', 'New Salemview', 'Millford Heights', 'Roxbury Landing', 'East Heights']
    },
    {
      serviceId: 'B', isExpress: false, tag: 'LCL', dir: 'NB', reverseDir: 'SB',
      origin: 'Mount Hindsboro', destination: 'Hadleigh',
      stops: ['Mount Hindsboro', 'Greens Corner', 'Doverville', 'Orchard Ridge', 'Groveton', 'Madisonboro', 'Hutchinson Point', 'Vanwood', 'South Harrington', 'Harrington City', 'Carrollton', 'Hadleigh']
    },
    {
      serviceId: 'E', isExpress: false, tag: 'LCL', dir: 'SB', reverseDir: 'NB',
      origin: 'Santa Mora', destination: 'East Heights',
      stops: ['Santa Mora', 'Brandywine', 'Cherrywood', 'Grant Park', 'Scottsdale', 'Ameryville', 'Scottsbury', 'New Halifax', 'Alpherst', 'Roxbury Landing', 'East Heights']
    }
  ];

  const WINTER_ROUTES = Object.freeze(WINTER_ROUTE_PAIRS.flatMap(route => [
    Object.freeze({ ...route, stops: Object.freeze([...route.stops]), segmentTimes: route.segmentTimes ? Object.freeze([...route.segmentTimes]) : undefined }),
    Object.freeze({ ...reverseRoute(route), stops: Object.freeze([...route.stops].reverse()), segmentTimes: route.segmentTimes ? Object.freeze([...route.segmentTimes].reverse()) : undefined })
  ]));

  const WINTER_LINE_SERVICE = Object.freeze({
    A: Object.freeze([{ start: '06:00', end: '22:59', every: 15 }]),
    F: Object.freeze([{ start: '06:00', end: '22:59', every: 15 }]),
    B: Object.freeze([{ start: '06:00', end: '22:59', every: 15 }]),
    C: Object.freeze([{ start: '06:00', end: '22:59', every: 15 }]),
    E: Object.freeze([{ start: '06:00', end: '22:59', every: 15 }]),
    S: Object.freeze([{ start: '06:00', end: '22:59', every: 15 }]),
    D: Object.freeze([{ start: '06:00', end: '22:59', every: 12 }]),
    G: Object.freeze([{ start: '06:00', end: '22:59', every: 12 }])
  });

  function seededRandom(seed) {
    let hash = 2166136261 >>> 0;
    for (const character of String(seed)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return function random() {
      hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
      hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
      return ((hash ^= hash >>> 16) >>> 0) / 4294967296;
    };
  }

  const pad = value => String(value).padStart(2, '0');
  const keyForParts = parts => `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  const keyForUTCDate = date => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

  function seasonStartYearForParts(parts) {
    if (parts.month === 12 && parts.day >= WINTER_START.day) return parts.year;
    if (parts.month < WINTER_END.month || (parts.month === WINTER_END.month && parts.day <= WINTER_END.day)) return parts.year - 1;
    return null;
  }

  const winterDatesCache = new Map();
  function winterEmergencyDatesForSeason(startYear) {
    const numericYear = Number(startYear);
    if (winterDatesCache.has(numericYear)) return winterDatesCache.get(numericYear);
    const candidates = [];
    const cursor = new Date(Date.UTC(numericYear, WINTER_START.month - 1, WINTER_START.day));
    const end = new Date(Date.UTC(numericYear + 1, WINTER_END.month - 1, WINTER_END.day));
    while (cursor <= end) {
      candidates.push(keyForUTCDate(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const random = seededRandom(`borail-winter-emergency-${numericYear}-${numericYear + 1}`);
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [candidates[index], candidates[target]] = [candidates[target], candidates[index]];
    }
    const selected = Object.freeze(candidates.slice(0, WINTER_EMERGENCY_DAY_COUNT).sort());
    winterDatesCache.set(numericYear, selected);
    return selected;
  }

  function context(date = CLOCK.now()) {
    const parts = CLOCK.parts(date);
    const minutes = parts.hour * 60 + parts.minute + parts.second / 60;
    const dateKey = keyForParts(parts);
    const seasonStartYear = seasonStartYearForParts(parts);
    const winterEmergency = seasonStartYear !== null
      && winterEmergencyDatesForSeason(seasonStartYear).includes(dateKey);
    const operatingWindowOpen = minutes >= OPEN_MINUTE && minutes < LAST_ORIGIN_DEPARTURE_MINUTE;
    let mode = 'closed';
    if (operatingWindowOpen) {
      if (winterEmergency) mode = 'winterEmergency';
      else if (minutes >= 6 * 60 && minutes < 9 * 60 + 30) mode = 'rushAM';
      else if (minutes >= 17 * 60 && minutes < 19 * 60 + 30) mode = 'rushPM';
      else mode = 'local';
    }
    return {
      dateKey,
      parts,
      minutes,
      mode,
      operatingWindowOpen,
      winterEmergency,
      winterSeason: seasonStartYear !== null,
      seasonStartYear,
      emergencyDates: seasonStartYear === null ? [] : winterEmergencyDatesForSeason(seasonStartYear)
    };
  }

  function timeModeForMinutes(minutes) {
    const normalized = ((Number(minutes) % 1440) + 1440) % 1440;
    if (normalized < OPEN_MINUTE || normalized >= LAST_ORIGIN_DEPARTURE_MINUTE) return 'closed';
    if (normalized < 9 * 60 + 30) return 'rushAM';
    if (normalized >= 17 * 60 && normalized < 19 * 60 + 30) return 'rushPM';
    return 'local';
  }

  function delayInfo(trainSeed, mode, stopCount) {
    const random = seededRandom(`${trainSeed}-delay`);
    const winterEmergency = mode === 'winterEmergency';
    const delayRate = winterEmergency
      ? WINTER_DELAY_RATE
      : BASE_DELAY_RATE * (mode === 'rushAM' || mode === 'rushPM' ? RUSH_DELAY_MULTIPLIER : 1);
    if (random() >= delayRate) return { isDelayed: false, delaySeconds: 0, delayStartStop: -1 };
    const usableStops = Math.max(1, Number(stopCount) - 1);
    const delayStartStop = 1 + Math.floor(random() * usableStops);
    const delayMinutes = winterEmergency
      ? WINTER_DELAY_MINUTES.min + Math.floor(random() * (WINTER_DELAY_MINUTES.max - WINTER_DELAY_MINUTES.min + 1))
      : (random() < 0.2 ? 1 : 2 + Math.floor(random() * 2));
    return { isDelayed: true, delaySeconds: delayMinutes * 60, delayStartStop };
  }

  function calculateStopTimes(trainSeed, stops, departureMinutes, options = {}) {
    const stopNames = Array.from(stops || []);
    const segmentTimes = options.segmentTimes || null;
    const customDwellSeconds = options.customDwellSeconds || null;
    const defaultSegmentMinutes = Number(options.defaultSegmentMinutes) || 1.5;
    const mode = options.mode || 'local';
    const random = seededRandom(trainSeed);
    const trainDelay = delayInfo(trainSeed, mode, stopNames.length);
    const result = [];
    let cumulativeSeconds = 0;

    stopNames.forEach((name, index) => {
      if (index > 0) {
        cumulativeSeconds += Number(customDwellSeconds?.[index - 1] || 0);
        cumulativeSeconds += Number(segmentTimes?.[index - 1] ?? defaultSegmentMinutes) * 60;
      }
      const scheduledArrivalSec = departureMinutes * 60 + cumulativeSeconds;
      const arrivalOffset = Math.floor(random() * 21) + 5;
      const dwellTime = customDwellSeconds?.[index] ?? (Math.floor(random() * 9) + 12);
      const delayedAtStop = trainDelay.isDelayed && index >= trainDelay.delayStartStop;
      const appliedDelaySeconds = delayedAtStop ? trainDelay.delaySeconds : 0;
      result.push({
        name,
        stopIndex: index,
        scheduledArrivalSec,
        scheduledDepartureSec: scheduledArrivalSec + dwellTime,
        actualArrivalSec: scheduledArrivalSec + arrivalOffset + appliedDelaySeconds,
        actualDepartureSec: scheduledArrivalSec + arrivalOffset + appliedDelaySeconds + dwellTime,
        isDelayed: delayedAtStop,
        delaySeconds: appliedDelaySeconds
      });
    });

    const delayStartSec = trainDelay.isDelayed && trainDelay.delayStartStop > 0
      ? result[Math.min(trainDelay.delayStartStop - 1, result.length - 1)]?.scheduledDepartureSec ?? null
      : null;
    return {
      stops: result,
      hasDelay: trainDelay.isDelayed,
      delaySeconds: trainDelay.delaySeconds,
      delayStartStop: trainDelay.delayStartStop,
      delayStartSec
    };
  }

  function initializeEmergencyNotice(date = CLOCK.now()) {
    if (typeof document === 'undefined') return null;
    const current = context(date);
    if (!current.winterEmergency) return null;
    const storageKey = `borailWinterEmergencyAcknowledged:${current.dateKey}`;
    try {
      if (sessionStorage.getItem(storageKey) === 'true') return null;
    } catch { /* session storage is optional */ }

    const host = document.createElement('div');
    host.className = 'winter-emergency-overlay';
    host.hidden = true;
    host.innerHTML = `
      <section class="winter-emergency-dialog" role="alertdialog" aria-modal="true" aria-labelledby="winterEmergencyTitle" aria-describedby="winterEmergencyMessage">
        <div class="winter-emergency-brand">
          <span class="winter-emergency-warning" aria-hidden="true">!</span>
          <img src="assets/images/branding/borail-logo.png" alt="BORail">
        </div>
        <p class="winter-emergency-kicker">Severe weather protocol</p>
        <h2 id="winterEmergencyTitle">Winter Emergency Notice!</h2>
        <p id="winterEmergencyMessage">A significant snowstorm is affecting the State of Newkirk. All BORail service has switched to Winter Emergency protocols. Please allow extra travel time: trains are operating less frequently and may be delayed by low visibility and snow accumulation.</p>
        <div class="winter-emergency-actions">
          <a href="assets/maps/borail-flatlands-winter-emergency-map.pdf" target="_blank" rel="noopener">View Winter Emergency Map</a>
          <button type="button">I Understand</button>
        </div>
      </section>`;
    document.body.appendChild(host);

    const show = () => {
      host.hidden = false;
      document.body.classList.add('winter-emergency-notice-open');
      requestAnimationFrame(() => host.classList.add('visible'));
      host.querySelector('button')?.focus();
    };
    const waitForSplash = () => {
      if (!document.getElementById('splash-screen')) {
        show();
        return;
      }
      const observer = new MutationObserver(() => {
        if (document.getElementById('splash-screen')) return;
        observer.disconnect();
        show();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };
    host.querySelector('button')?.addEventListener('click', () => {
      try { sessionStorage.setItem(storageKey, 'true'); } catch { /* optional */ }
      host.classList.remove('visible');
      document.body.classList.remove('winter-emergency-notice-open');
      window.setTimeout(() => host.remove(), 240);
    });
    waitForSplash();
    return host;
  }

  global.BORailService = Object.freeze({
    OPEN_MINUTE,
    LAST_ORIGIN_DEPARTURE_MINUTE,
    WINTER_EMERGENCY_DAY_COUNT,
    WINTER_DELAY_RATE,
    WINTER_DELAY_MINUTES,
    WINTER_ROUTES,
    WINTER_LINE_SERVICE,
    seededRandom,
    context,
    timeModeForMinutes,
    delayInfo,
    calculateStopTimes,
    winterEmergencyDatesForSeason,
    isOriginDepartureAllowed: minutes => Number(minutes) >= OPEN_MINUTE && Number(minutes) < LAST_ORIGIN_DEPARTURE_MINUTE,
    initializeEmergencyNotice
  });

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeEmergencyNotice, { once: true });
    } else {
      initializeEmergencyNotice();
    }
  }
})(globalThis);
