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
    newkirk: summarize(BORailTripDebug.planBORailTrip('Newkirk', 'New Halifax', new Date('2026-06-12T07:00:00'))),
    harrington: summarize(BORailTripDebug.planBORailTrip('Harrington City', 'Kenilworth', new Date('2026-06-12T17:10:00'))),
    bradford: summarize(BORailTripDebug.planBORailTrip('Bradford Bay', 'Willow Springs', new Date('2026-06-12T12:00:00'))),
    hadleigh: summarize(BORailTripDebug.planBORailTrip('Kenilworth', 'Hadleigh', new Date('2026-06-12T12:00:00')))
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
assert.equal(await evaluate(`arrivalsForStation('Radcliff Fields', new Date('2026-06-12T12:00:00')).length`), 0);
assert.ok(await evaluate(`arrivalsForStation('Radcliff Fields', new Date('2026-06-12T07:00:00')).length`) > 0);

await evaluate(`document.getElementById('tripPlannerTab').click()`);
assert.equal(await evaluate(`document.getElementById('tripPlannerView').hidden`), false);
await evaluate(`(() => {
  tripOriginSelect.value = 'Newkirk';
  tripDestinationSelect.value = 'New Halifax';
  document.getElementById('departLaterButton').click();
  tripDateInput.value = '2026-06-12';
  tripTimeInput.value = '07:00';
  document.getElementById('findTripsButton').click();
  return true;
})()`);
await wait(900);
assert.equal(await evaluate(`document.querySelectorAll('.trip-option').length`), 3);
assert.ok(await evaluate(`document.querySelectorAll('.route-pill').length`) > 0);
assert.equal(await evaluate(`document.querySelector('.trip-badge.fastest').textContent`), 'Fastest');

await evaluate(`(() => {
  tripOriginSelect.value = 'Kenilworth';
  tripDestinationSelect.value = 'Hadleigh';
  tripDateInput.value = '2026-06-12';
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
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(process.env.BORAIL_SCREENSHOT, Buffer.from(screenshot.data, 'base64'));
}

await evaluate(`document.getElementById('upcomingTab').click()`);
assert.equal(await evaluate(`document.getElementById('upcomingView').hidden`), false);
assert.ok(await evaluate(`document.querySelectorAll('#arrivals details.row').length`) > 0);

console.log(JSON.stringify(routeExamples));
socket.close();
console.log('Timetable trip planner browser and routing tests passed.');
