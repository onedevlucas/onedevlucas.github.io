import assert from 'node:assert/strict';
import fs from 'node:fs';

const endpoint = process.env.BORAIL_CDP_URL || 'http://127.0.0.1:9223/json/list';
const targets = await fetch(endpoint).then(response => response.json());
const target = targets.find(item => item.type === 'page');
assert.ok(target, 'A headless Chrome page must be running.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const request = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: 'http://127.0.0.1:8766/index.html' });
await wait(3600);

assert.equal(await evaluate('document.title'), 'BORail Live Timetable');
assert.equal(await evaluate(`document.getElementById('upcomingView').hidden`), false);
assert.equal(await evaluate(`document.getElementById('tripPlannerView').hidden`), true);

const routeExamples = await evaluate(`(() => {
  const summarize = result => ({
    count: result.journeys.length,
    legs: result.journeys[0]?.legs.map(leg => ({ service: leg.serviceId, express: leg.isExpress, board: leg.boardStation, alight: leg.alightStation })),
    arrival: result.journeys[0]?.arrivalSec,
    expressGain: result.journeys[0]?.hasExpress && result.localJourneys[0] ? result.localJourneys[0].arrivalSec - result.journeys[0].arrivalSec : null,
    fallbackOrigin: result.origin.fallback,
    fallbackDestination: result.destination.fallback
  });
  return {
    newkirk: summarize(BORailTripDebug.planBORailTrip('Newkirk', 'New Halifax', new Date('2026-07-01T07:00:00'))),
    harrington: summarize(BORailTripDebug.planBORailTrip('Harrington City', 'Kenilworth', new Date('2026-07-01T17:10:00'))),
    bradford: summarize(BORailTripDebug.planBORailTrip('Bradford Bay', 'Willow Springs', new Date('2026-07-01T12:00:00'))),
    hadleigh: summarize(BORailTripDebug.planBORailTrip('Kenilworth', 'Hadleigh', new Date('2026-07-01T12:00:00')))
  };
})()`);

assert.ok(routeExamples.newkirk.count > 0);
assert.ok(routeExamples.newkirk.legs.some(leg => leg.service === 'C'));
assert.ok(routeExamples.newkirk.legs.some(leg => leg.service === 'E'));
assert.ok(routeExamples.harrington.count > 0);
assert.ok(routeExamples.harrington.expressGain === null || routeExamples.harrington.expressGain >= 120);
assert.ok(routeExamples.bradford.count > 0);
assert.equal(routeExamples.bradford.legs[0].service, 'G');
assert.equal(routeExamples.hadleigh.fallbackDestination, true);

const radcliffRules = await evaluate(`(() => {
  const northboundA = ROUTES.find(route => route.serviceId === 'A' && !route.isExpress && route.origin === 'Mount River');
  const southboundA = ROUTES.find(route => route.serviceId === 'A' && !route.isExpress && route.origin === 'Newkirk');
  const expressA = ROUTES.find(route => route.serviceId === 'A' && route.isExpress);
  const northboundOffPeak = BORailTripDebug.getEffectiveRoutePattern(northboundA, 'local');
  const southboundOffPeak = BORailTripDebug.getEffectiveRoutePattern(southboundA, 'local');
  const airportIndex = northboundOffPeak.stops.indexOf('Oakville City Airport');
  const atkinsIndex = southboundOffPeak.stops.indexOf('Atkins Bridge');
  return {
    localOffPeak: northboundOffPeak.stops.includes('Radcliff Fields'),
    localRush: BORailTripDebug.getEffectiveRoutePattern(northboundA, 'rushAM').stops.includes('Radcliff Fields'),
    expressRush: BORailTripDebug.getEffectiveRoutePattern(expressA, 'rushAM').stops.includes('Radcliff Fields'),
    airportToAtkinsMinutes: northboundOffPeak.segmentTimes[airportIndex],
    atkinsToAirportMinutes: southboundOffPeak.segmentTimes[atkinsIndex],
    offPeakFallback: BORailTripDebug.resolvePlanningStation('Radcliff Fields', 'local'),
    rushFallback: BORailTripDebug.resolvePlanningStation('Radcliff Fields', 'rushAM')
  };
})()`);

assert.equal(radcliffRules.localOffPeak, false);
assert.equal(radcliffRules.localRush, true);
assert.equal(radcliffRules.expressRush, false);
assert.equal(radcliffRules.airportToAtkinsMinutes, 3);
assert.equal(radcliffRules.atkinsToAirportMinutes, 3);
assert.equal(radcliffRules.offPeakFallback.effective, 'Oakville City Airport');
assert.equal(radcliffRules.offPeakFallback.fallback, true);
assert.equal(radcliffRules.rushFallback.fallback, false);
assert.equal(await evaluate(`arrivalsForStation('Radcliff Fields', new Date('2026-07-01T12:00:00')).length`), 0);
assert.ok(await evaluate(`arrivalsForStation('Radcliff Fields', new Date('2026-07-01T07:00:00')).length`) > 0);

const bExpressRules = await evaluate(`(() => {
  const northbound = ROUTES.find(route => route.serviceId === 'B' && route.isExpress && route.origin === 'Leighton Castle');
  const southbound = ROUTES.find(route => route.serviceId === 'B' && route.isExpress && route.origin === 'Hadleigh');
  return {
    northbound: northbound.stops,
    southbound: southbound.stops,
    dovervilleBadges: Array.from(new DOMParser().parseFromString(BORailTripDebug.getBadgesForStation('Doverville'), 'text/html').querySelectorAll('img')).map(image => image.alt),
    madisonboroBadges: Array.from(new DOMParser().parseFromString(BORailTripDebug.getBadgesForStation('Madisonboro'), 'text/html').querySelectorAll('img')).map(image => image.alt)
  };
})()`);
assert.deepEqual(bExpressRules.northbound, [
  'Leighton Castle',
  'Oakville Plaza',
  'Oakville City Center',
  'Oakville Exchange',
  'Greens Corner',
  'Madisonboro',
  'Harrington City',
  'Carrollton',
  'Hadleigh'
]);
assert.deepEqual(bExpressRules.southbound, [
  'Hadleigh',
  'Carrollton',
  'Harrington City',
  'Madisonboro',
  'Greens Corner',
  'Oakville Exchange',
  'Oakville City Center',
  'Oakville Plaza',
  'Leighton Castle'
]);
assert.deepEqual(bExpressRules.dovervilleBadges.filter(badge => badge.includes('B')), ['(B)']);
assert.deepEqual(bExpressRules.madisonboroBadges.filter(badge => badge.includes('B')), ['(B)', '<B>']);

await evaluate(`document.getElementById('tripPlannerTab').click()`);
assert.equal(await evaluate(`document.getElementById('tripPlannerView').hidden`), false);
assert.equal(await evaluate(`tripOriginSelect.type`), 'hidden');
assert.equal(await evaluate(`document.querySelectorAll('#tripOriginTriggerContent .dropdown-badge-img').length`), 4);
assert.equal(await evaluate(`document.querySelectorAll('#tripDestinationTriggerContent .dropdown-badge-img').length`), 1);
assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#tripOriginTriggerContent .dropdown-badge-img')).map(image => image.alt)`), ['<F>', '(F)', '(A)', '<S>']);
assert.equal(await evaluate(`document.querySelector('#tripOriginTriggerContent .station-trigger-name').textContent`), 'Newkirk');
assert.equal(await evaluate(`document.querySelector('#tripDestinationTriggerContent .station-trigger-name').textContent`), 'New Halifax');
await evaluate(`document.getElementById('tripOriginDropdownTrigger').click()`);
assert.equal(await evaluate(`document.getElementById('tripOriginDropdownContainer').classList.contains('open')`), true);
assert.equal(await evaluate(`getComputedStyle(document.querySelector('.trip-search-card')).zIndex`), '30');
assert.equal(await evaluate(`getComputedStyle(document.getElementById('tripOriginDropdownOptions')).backgroundColor`), 'rgb(24, 24, 38)');
assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('#tripOriginDropdownOptions .custom-option-item')).color`), 'rgb(255, 255, 255, 0)');
await evaluate(`document.getElementById('tripOriginDropdownTrigger').click()`);
await evaluate(`document.getElementById('swapTripStations').click()`);
assert.equal(await evaluate(`tripOriginSelect.value`), 'New Halifax');
assert.equal(await evaluate(`document.querySelector('#tripOriginTriggerContent .station-trigger-name').textContent`), 'New Halifax');
await evaluate(`document.getElementById('swapTripStations').click()`);
await evaluate(`(() => {
  BORailTripDebug.setTripStations('Newkirk', 'New Halifax');
  document.getElementById('departLaterButton').click();
  tripDateInput.value = '2026-07-01';
  tripTimeInput.value = '07:00';
  document.getElementById('findTripsButton').click();
  return true;
})()`);
await wait(900);
assert.equal(await evaluate(`document.querySelectorAll('.trip-option').length`), 3);
assert.ok(await evaluate(`document.querySelectorAll('.route-pill').length`) > 0);
assert.equal(await evaluate(`document.querySelector('.trip-badge.fastest').textContent`), 'Fastest');
assert.equal(await evaluate(`document.querySelectorAll('.trip-badge.fastest').length`), 1);
assert.equal(await evaluate(`(() => {
  const result = BORailTripDebug.planBORailTrip('Newkirk', 'New Halifax', new Date('2026-07-01T07:00:00'));
  return result.journeys[0].arrivalSec === Math.min(...result.journeys.map(journey => journey.arrivalSec));
})()`), true);
assert.ok(await evaluate(`document.querySelector('.transfer-icon svg path') !== null`));
assert.equal(await evaluate(`Math.round(document.querySelector('.transfer-icon').getBoundingClientRect().width)`), 40);

await evaluate(`(() => {
  BORailTripDebug.setTripStations('Kenilworth', 'Hadleigh');
  tripDateInput.value = '2026-07-01';
  tripTimeInput.value = '12:00';
  document.getElementById('findTripsButton').click();
  return true;
})()`);
await wait(500);
assert.match(await evaluate(`document.querySelector('.fallback-notice').textContent`), /Harrington City/);
assert.match(await evaluate(`document.querySelector('.alternate-final-step').textContent`), /Hadleigh/);

await evaluate(`document.getElementById('departNowButton').click()`);
assert.equal(await evaluate(`document.getElementById('futureDepartureFields').hidden`), true);

if (process.env.BORAIL_SCREENSHOT) {
  await evaluate(`(() => {
    BORailTripDebug.setTripStations('Newkirk', 'New Halifax');
    document.getElementById('tripOriginDropdownTrigger').click();
    return true;
  })()`);
  await wait(250);
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(process.env.BORAIL_SCREENSHOT, Buffer.from(screenshot.data, 'base64'));
}

await evaluate(`document.getElementById('upcomingTab').click()`);
assert.equal(await evaluate(`document.getElementById('upcomingView').hidden`), false);
assert.ok(await evaluate(`document.querySelectorAll('#arrivals details.row').length`) > 0);
assert.deepEqual(await evaluate(`(() => {
  const findOption = (panel, stationName) => Array.from(panel.querySelectorAll('.custom-option-item'))
    .find(item => item.querySelector('.station-item-name')?.textContent.trim() === stationName);
  const upcomingDoverville = findOption(document.getElementById('stationDropdownOptions'), 'Doverville');
  document.getElementById('tripPlannerTab').click();
  const tripDoverville = findOption(document.getElementById('tripOriginDropdownOptions'), 'Doverville');
  return {
    upcoming: Array.from(upcomingDoverville.querySelectorAll('.dropdown-badge-img')).map(image => image.alt).filter(alt => alt.includes('B')),
    planner: Array.from(tripDoverville.querySelectorAll('.dropdown-badge-img')).map(image => image.alt).filter(alt => alt.includes('B'))
  };
})()`), { upcoming: ['(B)'], planner: ['(B)'] });

await send('Page.navigate', { url: 'http://127.0.0.1:8766/map.html' });
await wait(300);
await send('Page.navigate', { url: 'http://127.0.0.1:8766/index.html' });
await wait(200);
assert.equal(await evaluate(`document.getElementById('splash-screen') === null`), true);

await evaluate(`(() => {
  localStorage.setItem('borail_status_window_v3', JSON.stringify({
    start: Date.now(),
    statuses: [
      { id: 'A-local', letter: 'A', mode: 'local', type: 'major', reasonIndex: 1 },
      { id: 'A-express', letter: 'A', mode: 'express', type: 'ok', reasonIndex: -1 },
      { id: 'B-local', letter: 'B', mode: 'local', type: 'minor', reasonIndex: 2 }
    ]
  }));
  return true;
})()`);
await send('Page.navigate', { url: 'http://127.0.0.1:8766/status.html' });
await wait(700);
const pairedStatuses = await evaluate(`(() => {
  const byId = Object.fromEntries(BORailStatusDebug.statusState.statuses.map(service => [service.id, service]));
  return {
    hasBExpress: BORailStatusDebug.services.some(service => service.id === 'B-express'),
    aLocal: byId['A-local'],
    aExpress: byId['A-express'],
    bLocal: byId['B-local'],
    bExpress: byId['B-express'],
    renderedBExpress: Boolean(document.querySelector('[data-service-id="B-express"]')),
    aLocalPill: document.querySelector('[data-service-id="A-local"] .pill')?.textContent.trim(),
    aExpressPill: document.querySelector('[data-service-id="A-express"] .pill')?.textContent.trim(),
    bLocalPill: document.querySelector('[data-service-id="B-local"] .pill')?.textContent.trim(),
    bExpressPill: document.querySelector('[data-service-id="B-express"] .pill')?.textContent.trim(),
    aLocalReason: document.querySelector('[data-service-id="A-local"] .reason')?.textContent.trim(),
    aExpressReason: document.querySelector('[data-service-id="A-express"] .reason')?.textContent.trim(),
    bLocalReason: document.querySelector('[data-service-id="B-local"] .reason')?.textContent.trim(),
    bExpressReason: document.querySelector('[data-service-id="B-express"] .reason')?.textContent.trim()
  };
})()`);
assert.equal(pairedStatuses.hasBExpress, true);
assert.equal(pairedStatuses.renderedBExpress, true);
assert.equal(pairedStatuses.aLocal.type, pairedStatuses.aExpress.type);
assert.equal(pairedStatuses.aLocal.reasonIndex, pairedStatuses.aExpress.reasonIndex);
assert.equal(pairedStatuses.bLocal.type, pairedStatuses.bExpress.type);
assert.equal(pairedStatuses.bLocal.reasonIndex, pairedStatuses.bExpress.reasonIndex);
assert.equal(pairedStatuses.aLocalPill, pairedStatuses.aExpressPill);
assert.equal(pairedStatuses.bLocalPill, pairedStatuses.bExpressPill);
assert.equal(pairedStatuses.aLocalReason, pairedStatuses.aExpressReason);
assert.equal(pairedStatuses.bLocalReason, pairedStatuses.bExpressReason);

if (process.env.BORAIL_STATUS_SCREENSHOT) {
  const statusScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(process.env.BORAIL_STATUS_SCREENSHOT, Buffer.from(statusScreenshot.data, 'base64'));
}

console.log(JSON.stringify(routeExamples));
socket.close();
console.log('Timetable trip planner browser and routing tests passed.');
