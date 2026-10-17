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

async function realClickElement(expression) {
  const point = await evaluate(`(() => {
    const element = ${expression};
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height };
  })()`);
  assert.ok(point && point.width > 0 && point.height > 0, `Clickable element was not visible: ${expression}`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await wait(80);
}

await send('Runtime.enable');
await send('Page.enable');
const viewportWidth = Number(process.env.BORAIL_VIEWPORT_WIDTH || 390);
const viewportHeight = Number(process.env.BORAIL_VIEWPORT_HEIGHT || 844);
await send('Emulation.setDeviceMetricsOverride', {
  width: viewportWidth,
  height: viewportHeight,
  deviceScaleFactor: 1,
  mobile: viewportWidth < 700
});
await send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Seoul' });
await send('Runtime.evaluate', { expression: `try {
  sessionStorage.removeItem('borailTimetableSplashSeen');
  sessionStorage.removeItem('borailTimetableView');
} catch {}` });
await send('Page.navigate', { url: 'http://127.0.0.1:8766/index.html' });
await wait(750);

assert.equal(await evaluate(`document.getElementById('splash-version').textContent`), 'V70 - 10/16/26');
assert.equal(await evaluate(`Number(getComputedStyle(document.getElementById('splash-version')).opacity)`), 0);
await wait(2850);
assert.ok(await evaluate(`Number(getComputedStyle(document.getElementById('splash-version')).opacity)`) > 0.9);
assert.ok(await evaluate(`Number(getComputedStyle(document.getElementById('splash-logo')).opacity)`) > 0.9);
if (process.env.BORAIL_SPLASH_SCREENSHOT) {
  const splashScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(process.env.BORAIL_SPLASH_SCREENSHOT, Buffer.from(splashScreenshot.data, 'base64'));
}
await wait(1400);
assert.equal(await evaluate(`document.getElementById('splash-screen') === null`), true);

assert.equal(await evaluate('document.title'), 'BORail Live Timetable');
assert.equal(await evaluate(`document.querySelector('footer').textContent`), '© BORail • Built for iPhone • Works offline after first load');
assert.equal(await evaluate(`new Date().getHours() === BORailTime.parts().hour`), false);
assert.match(await evaluate(`nowText.textContent`), /^New York: 07:0\d:\d{2} EDT • AM Rush Preview$/);
assert.ok(await evaluate(`(() => {
  const match = /New York: (\\d{2}):(\\d{2}):(\\d{2})/.exec(nowText.textContent);
  const displayed = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  const actual = BORailTime.clockSeconds(BORailTime.now());
  const difference = Math.abs(actual - displayed);
  return Math.min(difference, 86400 - difference);
})()`) <= 5);
assert.equal(await evaluate(`document.getElementById('upcomingView').hidden`), false);
assert.equal(await evaluate(`document.getElementById('tripPlannerView').hidden`), true);
assert.equal(await evaluate(`document.querySelector('main > .grid > aside') === null`), true);
assert.equal(await evaluate(`document.querySelectorAll('#adCarouselTrack .ad-carousel-slide').length`), 4);
assert.equal(await evaluate(`document.getElementById('adCarousel').nextElementSibling.classList.contains('grid')`), true);
assert.equal(await evaluate(`Math.round(document.getElementById('adCarousel').getBoundingClientRect().width / document.getElementById('adCarousel').getBoundingClientRect().height)`), 5);
assert.equal(await evaluate(`BORailAdCarouselDebug.getState().autoIntervalMs`), 5000);
assert.equal(await evaluate(`BORailAdCarouselDebug.getState().manualPauseMs`), 10000);
const carouselIndexBeforeAutomaticNavigation = await evaluate(`BORailAdCarouselDebug.getState().activeIndex`);
await wait(1200);
assert.notEqual(await evaluate(`BORailAdCarouselDebug.getState().activeIndex`), carouselIndexBeforeAutomaticNavigation);
await evaluate(`document.getElementById('adCarouselNext').click()`);
const carouselIndexAfterManualNavigation = await evaluate(`BORailAdCarouselDebug.getState().activeIndex`);
assert.equal(await evaluate(`BORailAdCarouselDebug.getState().manuallyPaused`), true);
assert.match(await evaluate(`document.querySelector('#adCarouselTrack .ad-carousel-slide:nth-child(2) a').href`), /youtube\.com\/theemfanner/);
assert.match(await evaluate(`document.querySelector('#adCarouselTrack .ad-carousel-slide:nth-child(3) a').href`), /discord\.com\/invite\/yTVATZSsGN/);
assert.equal(await evaluate(`document.querySelector('#adCarouselTrack .ad-carousel-slide:nth-child(4) a')`), null);
await wait(5200);
assert.equal(await evaluate(`BORailAdCarouselDebug.getState().activeIndex`), carouselIndexAfterManualNavigation);
await wait(5000);
assert.notEqual(await evaluate(`BORailAdCarouselDebug.getState().activeIndex`), carouselIndexAfterManualNavigation);
assert.equal(await evaluate(`BORailAdCarouselDebug.getState().manuallyPaused`), false);

await evaluate(`document.getElementById('liveMapTab').click()`);
await wait(250);
assert.equal(await evaluate(`document.getElementById('liveMapView').hidden`), false);
assert.equal(await evaluate(`document.getElementById('upcomingView').hidden`), true);
assert.equal(await evaluate(`document.getElementById('upcomingHeaderControls').hidden`), true);
assert.equal(await evaluate(`document.querySelectorAll('#liveMapStations .live-map-station').length`), await evaluate(`STATIONS.length`));
assert.equal(await evaluate(`Object.keys(BORailLiveMapDebug.getStationCoordinates()).length`), await evaluate(`STATIONS.length`));
assert.equal(await evaluate(`document.getElementById('liveMapStationSearch')`), null);
assert.equal(await evaluate(`document.getElementById('liveMapSvg').viewBox.baseVal.height`), 1200);
assert.equal(await evaluate(`document.querySelector('.live-map-track-layout')?.getAttribute('href')`), 'assets/maps/borail-live-track-layout.svg');
assert.equal(await evaluate(`Boolean(document.querySelector('.live-map-internal-alias-mask'))`), true);
assert.equal(await evaluate(`document.body.textContent.includes('Wychwood')`), false);
assert.deepEqual(await evaluate(`BORailLiveMapDebug.getStationCoordinates()['Oakville City Airport']`), [598, 873]);
assert.equal(await evaluate(`document.querySelectorAll('#liveMapStations .live-map-accessibility-icon').length`), await evaluate(`Array.from(ACCESSIBLE_STATIONS).filter(station => BORailLiveMapDebug.getStationCoordinates()[station]).length`));
assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('input[name="liveMapService"]')).map(input => input.value)`), [
  'A-express', 'A-local', 'B-local', 'B-express', 'C-local', 'D-local',
  'E-local', 'F-local', 'F-express', 'G-local', 'S-local', 'S-express'
]);
assert.equal(await evaluate(`document.querySelectorAll('#liveMapLineFilters img[src*="assets/images/line-icons/"]').length`), 12);

const liveMapTrackRules = await evaluate(`(() => {
  const edges = BORailLiveMapDebug.getTrackEdges();
  const edge = (left, right) => edges.find(item =>
    (item.left === left && item.right === right) || (item.left === right && item.right === left)
  );
  return {
    fSingle: edge('Foxston', 'New Cottage')?.count,
    sThree: edge('Cannon View', 'Ivory Knolls')?.count,
    sFour: edge('Cannon View', 'Rockcastle')?.count,
    sharedNewkirk: edges.find(item => item.key === ['Newkirk', 'Newkirk - Oak Street'].sort().join('::') && item.services.includes('A')),
    newkirkF: edges.find(item => item.key === ['Newkirk', 'Newkirk - Oak Street'].sort().join('::') && item.services.length === 1 && item.services[0] === 'F'),
    sharedWillow: edge('Willow Springs', 'Rockcastle'),
    portWillow: edge('Port Williamson', 'Willow Springs'),
    cAirportSingle: edge('Perry Road', 'Oakville City Airport')?.count,
    bHadleighSingle: edge('Carrollton', 'Hadleigh')?.count,
    sharedBC: edge('Mount Hindsboro', 'Perry Road')
  };
})()`);
assert.equal(liveMapTrackRules.fSingle, 1);
assert.equal(liveMapTrackRules.sThree, 3);
assert.equal(liveMapTrackRules.sFour, 4);
assert.equal(liveMapTrackRules.sharedNewkirk.count, 4);
assert.deepEqual([...liveMapTrackRules.sharedNewkirk.services].sort(), ['A', 'S']);
assert.equal(liveMapTrackRules.newkirkF.count, 2);
assert.equal(liveMapTrackRules.sharedWillow.count, 4);
assert.deepEqual([...liveMapTrackRules.sharedWillow.services].sort(), ['A', 'S']);
assert.equal(liveMapTrackRules.portWillow.count, 2);
assert.deepEqual(liveMapTrackRules.portWillow.services, ['A']);
assert.equal(liveMapTrackRules.cAirportSingle, 1);
assert.equal(liveMapTrackRules.bHadleighSingle, 1);
assert.equal(liveMapTrackRules.sharedBC.count, 2);
assert.deepEqual([...liveMapTrackRules.sharedBC.services].sort(), ['B', 'C']);
assert.equal(await evaluate(`BORailLiveMapDebug.getLaneOffset('Port Williamson::Willow Springs', { serviceId: 'A', isExpress: false, direction: 'Northbound' })`), 2.4);
assert.equal(await evaluate(`BORailLiveMapDebug.getLaneOffset('Port Williamson::Willow Springs', { serviceId: 'A', isExpress: false, direction: 'Southbound' })`), 2.4);
assert.equal(await evaluate(`BORailLiveMapDebug.getLaneOffset('Rockcastle::Willow Springs', { serviceId: 'S', isExpress: false })`), 7.2);
assert.equal(await evaluate(`BORailLiveMapDebug.getLaneOffset('Rockcastle::Willow Springs', { serviceId: 'A', isExpress: false })`), 2.4);

const guidedTrackGeometry = await evaluate(`(() => {
  const path = (serviceId, direction, stations) => BORailLiveMapDebug.getPathPoints(serviceId, direction, stations);
  const fSouth = path('F', 'Southbound', ['Newkirk', 'Newkirk - Oak Street']);
  const fNorth = path('F', 'Northbound', ['Newkirk - Oak Street', 'Newkirk']);
  const fTransition = path('F', 'Southbound', ['Newkirk - Oak Street', 'Hoganville', 'Bayview Park']);
  const bShared = path('B', 'Southbound', ['Mount Hindsboro', 'Perry Road', 'Oakville Exchange']);
  const cShared = path('C', 'Southbound', ['Mount Hindsboro', 'Perry Road', 'Oakville Exchange']);
  const aAirport = path('A', 'Southbound', ['Radcliff Fields', 'Oakville City Airport', 'Oakville Exchange']);
  return { fSouth, fNorth, fTransition, bShared, cShared, aAirport };
})()`);
assert.deepEqual([guidedTrackGeometry.fSouth[0].x, guidedTrackGeometry.fSouth[0].y], [214, 471]);
assert.deepEqual([
  guidedTrackGeometry.fSouth.at(-1).x,
  guidedTrackGeometry.fSouth.at(-1).y
], [208, 544]);
assert.equal(guidedTrackGeometry.fSouth.every(point => point.guidedTrack), true);
assert.deepEqual([guidedTrackGeometry.fNorth[0].x, guidedTrackGeometry.fNorth[0].y], [246, 544]);
assert.deepEqual([
  guidedTrackGeometry.fNorth.at(-1).x,
  guidedTrackGeometry.fNorth.at(-1).y
], [254, 471]);
assert.equal(guidedTrackGeometry.fTransition.find(point => point.station === 'Hoganville').guidedTrack, false);
assert.deepEqual(
  guidedTrackGeometry.bShared.map(point => [point.x, point.y]),
  guidedTrackGeometry.cShared.map(point => [point.x, point.y])
);
assert.equal(guidedTrackGeometry.bShared.some(point => point.y === 864 && point.x > 631), true);
assert.equal(guidedTrackGeometry.aAirport.every(point => Math.abs(point.y - 881) < 0.01), true);

const liveMapSnapshot = await evaluate(`(() => {
  const testDate = BORailTime.fromWallTime('2026-10-16', '07:08');
  const trains = BORailLiveMapDebug.getActiveTrainSnapshots(testDate);
  BORailLiveMapDebug.refresh(testDate);
  const first = trains[0];
  BORailLiveMapDebug.selectTrain(first.id);
  const element = document.querySelector('[data-train-id="' + CSS.escape(first.id) + '"]');
  return {
    activeCount: trains.length,
    delayedCount: trains.filter(train => train.currentDelayed).length,
    expressCount: trains.filter(train => train.isExpress).length,
    firstCars: first.consist.cars,
    renderedCars: element?.querySelectorAll('.live-map-train-car').length,
    lineColoredCars: Array.from(element?.querySelectorAll('.live-map-train-car') || []).every(car => car.getAttribute('fill') === SERVICE_META[first.serviceId].color),
    hasIcon: Boolean(element?.querySelector('.live-map-train-icon[href*="assets/images/line-icons/"]')),
    hasArrow: Boolean(element?.querySelector('.live-map-direction-arrow')),
    titleUsesIcon: Boolean(document.querySelector('#liveMapDetailsContent .live-map-train-title img')),
    duplicateBadge: Boolean(document.querySelector('#liveMapDetailsContent .live-map-detail-badges')),
    details: document.getElementById('liveMapDetailsContent').textContent,
    positionFinite: Number.isFinite(first.x) && Number.isFinite(first.y) && Number.isFinite(first.angle)
  };
})()`);
assert.ok(liveMapSnapshot.activeCount > 0);
assert.ok(liveMapSnapshot.delayedCount > 0);
assert.ok(liveMapSnapshot.expressCount > 0);
assert.equal(liveMapSnapshot.firstCars, liveMapSnapshot.renderedCars);
assert.equal(liveMapSnapshot.lineColoredCars, true);
assert.equal(liveMapSnapshot.hasIcon, true);
assert.equal(liveMapSnapshot.hasArrow, true);
assert.equal(liveMapSnapshot.titleUsesIcon, true);
assert.equal(liveMapSnapshot.duplicateBadge, false);
assert.match(liveMapSnapshot.details, /Lead car/i);
assert.match(liveMapSnapshot.details, /cars/i);
assert.equal(liveMapSnapshot.positionFinite, true);

assert.equal(await evaluate(`(() => {
  document.getElementById('liveMapFollowTrain').click();
  return document.getElementById('liveMapDetails').hidden && !document.getElementById('liveMapFollowStatus').hidden;
})()`), true);
await evaluate(`document.getElementById('liveMapStopFollowing').click()`);
assert.equal(await evaluate(`document.getElementById('liveMapDetails').hidden && document.getElementById('liveMapFollowStatus').hidden && BORailLiveMapDebug.getState().selected === null`), true);

const expressFilterResult = await evaluate(`(() => {
  const testDate = BORailTime.fromWallTime('2026-10-16', '07:08');
  document.querySelector('input[name="liveMapServiceType"][value="local"]').checked = false;
  BORailLiveMapDebug.refresh(testDate);
  const state = BORailLiveMapDebug.getState();
  const snapshots = new Map(BORailLiveMapDebug.getActiveTrainSnapshots(testDate).map(train => [train.id, train]));
  const allExpress = Array.from(document.querySelectorAll('#liveMapTrains .live-map-train'))
    .every(element => snapshots.get(element.dataset.trainId)?.isExpress);
  document.querySelector('input[name="liveMapServiceType"][value="local"]').checked = true;
  BORailLiveMapDebug.refresh(testDate);
  return { rendered: state.renderedTrainCount, allExpress };
})()`);
assert.ok(expressFilterResult.rendered > 0);
assert.equal(expressFilterResult.allExpress, true);

const delayedFilterResult = await evaluate(`(() => {
  const testDate = BORailTime.fromWallTime('2026-10-16', '07:08');
  document.querySelector('input[name="liveMapRunningStatus"][value="on-time"]').checked = false;
  BORailLiveMapDebug.refresh(testDate);
  const snapshots = new Map(BORailLiveMapDebug.getActiveTrainSnapshots(testDate).map(train => [train.id, train]));
  const rendered = Array.from(document.querySelectorAll('#liveMapTrains .live-map-train'));
  const allDelayed = rendered.every(element => snapshots.get(element.dataset.trainId)?.currentDelayed);
  document.querySelector('input[name="liveMapRunningStatus"][value="on-time"]').checked = true;
  BORailLiveMapDebug.refresh(testDate);
  return { rendered: rendered.length, allDelayed };
})()`);
assert.ok(delayedFilterResult.rendered > 0);
assert.equal(delayedFilterResult.allDelayed, true);

assert.equal(await evaluate(`(() => {
  const firstDate = BORailTime.fromWallTime('2026-10-16', '07:08:00');
  const secondDate = BORailTime.fromWallTime('2026-10-16', '07:08:10');
  const first = BORailLiveMapDebug.getActiveTrainSnapshots(firstDate);
  const second = new Map(BORailLiveMapDebug.getActiveTrainSnapshots(secondDate).map(train => [train.id, train]));
  return first.some(train => {
    const later = second.get(train.id);
    return later && Math.hypot(later.x - train.x, later.y - train.y) > .1;
  });
})()`), true);

assert.equal(await evaluate(`(() => {
  BORailLiveMapDebug.selectStation('Perry Road');
  const content = document.getElementById('liveMapDetailsContent');
  return /Perry Road/.test(content.textContent) && content.querySelectorAll('.live-map-arrival').length <= 5;
})()`), true);
await evaluate(`(() => {
  document.getElementById('liveMapDetailsClose').click();
  document.getElementById('liveMapFit').click();
  document.getElementById('liveMapView').scrollIntoView({ block: 'start' });
})()`);
await wait(120);
const clickableStationId = await evaluate(`(() => {
  const dots = Array.from(document.querySelectorAll('.live-map-station-dot'));
  const dot = dots.find(candidate => {
    const rect = candidate.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return top?.closest('.live-map-station') === candidate.closest('.live-map-station');
  });
  return dot?.closest('.live-map-station')?.dataset.stationId || null;
})()`);
assert.ok(clickableStationId);
await realClickElement(`document.querySelector(${JSON.stringify(`[data-station-id="${clickableStationId}"] .live-map-station-dot`)})`);
assert.equal(await evaluate(`BORailLiveMapDebug.getState().selected?.id`), clickableStationId);
assert.equal(await evaluate(`document.getElementById('liveMapDetails').hidden`), false);
await evaluate(`document.getElementById('liveMapDetailsClose').click()`);
await realClickElement(`Array.from(document.querySelectorAll('#liveMapTrains .live-map-train-car')).find(element => {
  const rect = element.getBoundingClientRect();
  const svgRect = document.getElementById('liveMapSvg').getBoundingClientRect();
  return rect.left > svgRect.left + 8 && rect.right < svgRect.right - 58 && rect.top > svgRect.top + 55 && rect.bottom < svgRect.bottom - 15;
}) || document.querySelector('#liveMapTrains .live-map-train-car')`);
assert.equal(await evaluate(`BORailLiveMapDebug.getState().selected?.type`), 'train');
assert.equal(await evaluate(`document.getElementById('liveMapDetails').hidden`), false);
const mapWidthBeforeZoom = await evaluate(`BORailLiveMapDebug.getState().viewBox.width`);
await evaluate(`document.getElementById('liveMapZoomIn').click()`);
assert.ok(await evaluate(`BORailLiveMapDebug.getState().viewBox.width`) < mapWidthBeforeZoom);
await evaluate(`document.getElementById('liveMapFit').click()`);
assert.equal(await evaluate(`BORailLiveMapDebug.getState().viewBox.width`), 1200);
if (process.env.BORAIL_LIVE_MAP_SCREENSHOT) {
  await evaluate(`document.getElementById('liveMapDetailsClose').click()`);
  await evaluate(`document.getElementById('liveMapView').scrollIntoView({ block: 'start' })`);
  await wait(120);
  const liveMapScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(process.env.BORAIL_LIVE_MAP_SCREENSHOT, Buffer.from(liveMapScreenshot.data, 'base64'));
}
await evaluate(`document.getElementById('upcomingTab').click()`);
assert.equal(await evaluate(`document.getElementById('upcomingView').hidden`), false);

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
    newkirk: summarize(BORailTripDebug.planBORailTrip('Newkirk', 'New Halifax', BORailTime.fromWallTime('2026-08-01', '07:00'))),
    harrington: summarize(BORailTripDebug.planBORailTrip('Harrington City', 'Kenilworth', BORailTime.fromWallTime('2026-08-01', '17:10'))),
    bradford: summarize(BORailTripDebug.planBORailTrip('Bradford Bay', 'Willow Springs', BORailTime.fromWallTime('2026-08-01', '12:00'))),
    hadleigh: summarize(BORailTripDebug.planBORailTrip('Kenilworth', 'Hadleigh', BORailTime.fromWallTime('2026-08-01', '12:00')))
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
assert.equal(await evaluate(`arrivalsForStation('Radcliff Fields', BORailTime.fromWallTime('2026-08-01', '12:00')).length`), 0);
assert.ok(await evaluate(`arrivalsForStation('Radcliff Fields', BORailTime.fromWallTime('2026-08-01', '07:00')).length`) > 0);

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
assert.equal(await evaluate(`getComputedStyle(document.getElementById('adCarousel')).display`), 'block');
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
  tripDateInput.value = '2099-08-01';
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
  const result = BORailTripDebug.planBORailTrip('Newkirk', 'New Halifax', BORailTime.fromWallTime('2026-08-01', '07:00'));
  return result.journeys[0].arrivalSec === Math.min(...result.journeys.map(journey => journey.arrivalSec));
})()`), true);
assert.ok(await evaluate(`document.querySelectorAll('.trip-stop-name .accessible-icon-tiny').length`) > 0);
assert.ok(await evaluate(`document.querySelector('.transfer-icon svg path') !== null`));
assert.equal(await evaluate(`Math.round(document.querySelector('.transfer-icon').getBoundingClientRect().width)`), 40);

await evaluate(`(() => {
  BORailTripDebug.setTripStations('Kenilworth', 'Hadleigh');
  tripDateInput.value = '2099-08-01';
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
const upcomingTimelineStyle = await evaluate(`(() => {
  const row = document.querySelector('#arrivals details.row');
  row.querySelector('summary').click();
  const button = row.querySelector('[data-action="expand"]');
  if (button) button.click();
  const list = row.querySelector('.stops-list');
  const firstStop = row.querySelector('.stop-item');
  const firstIcon = row.querySelector('.stop-icon');
  const activeIcon = document.querySelector('.tabbar a.active img');
  return {
    borderLeftWidth: getComputedStyle(list).borderLeftWidth,
    borderLeftColor: getComputedStyle(list).borderLeftColor,
    stopIconDisplay: getComputedStyle(firstIcon).display,
    stopBeforeLeft: getComputedStyle(firstStop, '::before').left,
    activeNavFilter: getComputedStyle(activeIcon).filter,
    stopCount: row.querySelectorAll('.stop-item').length
  };
})()`);
assert.equal(upcomingTimelineStyle.borderLeftWidth, '3px');
assert.notEqual(upcomingTimelineStyle.borderLeftColor, 'rgba(0, 0, 0, 0)');
assert.equal(upcomingTimelineStyle.stopIconDisplay, 'none');
assert.equal(upcomingTimelineStyle.stopBeforeLeft, '-22px');
assert.notEqual(upcomingTimelineStyle.activeNavFilter, 'none');
assert.ok(upcomingTimelineStyle.stopCount > 1);
const delayedStopLayout = await evaluate(`(() => {
  const host = document.createElement('ul');
  host.className = 'stops-list';
  host.style.setProperty('--stop-line-color', '#c28b42');
  host.innerHTML = '<li class="stop-item"><span class="stop-icon"></span><div class="stop-time-main delayed"><span class="scheduled">20:29:30</span><span class="new-time">20:30:45</span></div><div class="stop-copy"><div class="stop-name">Roxbury Landing <img class="accessible-icon-tiny" src="assets/images/ui/accessibility.png" alt="Accessible station"></div><div class="stop-details"><span class="detail-item">Delayed 1m</span></div></div></li>';
  document.body.appendChild(host);
  const scheduled = host.querySelector('.scheduled').getBoundingClientRect();
  const newTime = host.querySelector('.new-time').getBoundingClientRect();
  const name = host.querySelector('.stop-name').getBoundingClientRect();
  const beforeLeft = getComputedStyle(host.querySelector('.stop-item'), '::before').left;
  const result = {
    beforeLeft,
    newTimeBelow: newTime.top > scheduled.bottom - 1,
    noOverlap: scheduled.right < name.left && newTime.right < name.left,
    gap: Math.min(name.left - scheduled.right, name.left - newTime.right)
  };
  host.remove();
  return result;
})()`);
assert.equal(delayedStopLayout.beforeLeft, '-22px');
assert.equal(delayedStopLayout.newTimeBelow, true);
assert.equal(delayedStopLayout.noOverlap, true);
assert.ok(delayedStopLayout.gap >= 8);
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
await evaluate(`BORailStatusDebug.renderStatus(BORailStatusDebug.statusState, {
  A: {
    type: 'major',
    delayed: 12,
    total: 20,
    maxDelaySeconds: 180,
    reason: 'Timetable is showing 12 delayed trains on the A line in the next 2 hours. Longest delay: 3 min.'
  },
  B: {
    type: 'minor',
    delayed: 6,
    total: 18,
    maxDelaySeconds: 120,
    reason: 'Timetable is showing 6 delayed trains on the B line in the next 2 hours. Longest delay: 2 min.'
  }
})`);
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
await evaluate(`BORailStatusDebug.renderStatus(BORailStatusDebug.statusState, {
  A: {
    type: 'major',
    delayed: 12,
    total: 18,
    maxDelaySeconds: 180,
    reason: 'Timetable is showing 12 delayed trains on the A line in the next 2 hours. Longest delay: 3 min.'
  },
  F: {
    type: 'minor',
    delayed: 6,
    total: 14,
    maxDelaySeconds: 120,
    reason: 'Timetable is showing 6 delayed trains on the F line in the next 2 hours. Longest delay: 2 min.'
  },
  B: {
    type: 'ok',
    delayed: 5,
    total: 16,
    maxDelaySeconds: 60,
    reason: 'Timetable is showing 5 delayed trains on the B line in the next 2 hours. Longest delay: 1 min.'
  }
})`);
const delayOverride = await evaluate(`(() => ({
  aLocalType: document.querySelector('[data-service-id="A-local"]').dataset.statusType,
  aExpressType: document.querySelector('[data-service-id="A-express"]').dataset.statusType,
  aLocalReason: document.querySelector('[data-service-id="A-local"] .reason')?.textContent.trim(),
  aExpressReason: document.querySelector('[data-service-id="A-express"] .reason')?.textContent.trim(),
  fLocalType: document.querySelector('[data-service-id="F-local"]').dataset.statusType,
  bLocalType: document.querySelector('[data-service-id="B-local"]').dataset.statusType,
  bLocalPill: document.querySelector('[data-service-id="B-local"] .pill')?.textContent.trim()
}))()`);
assert.equal(delayOverride.aLocalType, 'major');
assert.equal(delayOverride.aExpressType, 'major');
assert.match(delayOverride.aLocalReason, /12 delayed trains/);
assert.equal(delayOverride.aLocalReason, delayOverride.aExpressReason);
assert.equal(delayOverride.fLocalType, 'minor');
assert.equal(delayOverride.bLocalType, 'ok');
assert.match(delayOverride.bLocalPill, /No Disruptions/);

const elevatorInitial = await evaluate(`(() => {
  const active = BORailElevatorDebug.state.outages.filter(outage => BORailElevatorDebug.getStatus(outage) !== 'repaired');
  return {
    activeCount: active.length,
    rowCount: document.querySelectorAll('.elevator-row').length,
    summary: document.getElementById('elevatorOutageSummary').textContent.trim(),
    hasHazard: Boolean(document.querySelector('#elevatorOutageSummary .hazard-symbol')),
    pageText: document.getElementById('elevatorStatusList').textContent
  };
})()`);
assert.ok(elevatorInitial.activeCount >= 2 && elevatorInitial.activeCount <= 4);
assert.ok(elevatorInitial.rowCount >= 1);
assert.match(elevatorInitial.summary, /\d/);
assert.equal(elevatorInitial.hasHazard, true);
assert.doesNotMatch(elevatorInitial.pageText, /Wychwood/);

const elevatorDailyDeterminism = await evaluate(`(() => {
  const first = BORailStatusDebug.buildDailyElevatorState(BORailTime.fromWallTime('2026-07-14', '08:00').getTime());
  localStorage.setItem('borail_elevator_status_v2_daily', JSON.stringify({
    createdAt: 1,
    targetActive: 4,
    outages: [{ id: 'browser-only-random-state', elevatorId: 'fake', station: 'Wychwood', direction: 'Exit' }]
  }));
  const second = BORailStatusDebug.buildDailyElevatorState(BORailTime.fromWallTime('2026-07-14', '21:00').getTime());
  const nextDay = BORailStatusDebug.buildDailyElevatorState(BORailTime.fromWallTime('2026-07-15', '08:00').getTime());
  return {
    sameDayKey: first.dayKey === second.dayKey,
    sameOutages: first.outages.map(outage => outage.id).join('|') === second.outages.map(outage => outage.id).join('|'),
    nextDayChanges: first.outages.map(outage => outage.id).join('|') !== nextDay.outages.map(outage => outage.id).join('|'),
    activeCount: first.outages.filter(outage => outage.id.startsWith('daily-' + first.dayKey + '-')).length,
    hasWychwood: first.outages.some(outage => outage.station === 'Wychwood')
  };
})()`);
assert.equal(elevatorDailyDeterminism.sameDayKey, true);
assert.equal(elevatorDailyDeterminism.sameOutages, true);
assert.equal(elevatorDailyDeterminism.nextDayChanges, true);
assert.ok(elevatorDailyDeterminism.activeCount >= 2 && elevatorDailyDeterminism.activeCount <= 4);
assert.equal(elevatorDailyDeterminism.hasWychwood, false);

const elevatorLifecycle = await evaluate(`(() => {
  const now = BORailTime.fromWallTime('2026-07-14', '14:34').getTime();
  const units = BORailElevatorDebug.units.slice(0, 3);
  BORailStatusDebug.renderElevatorStatus({
    createdAt: now,
    targetActive: 2,
    outages: [
      {
        id: 'test-awaiting',
        elevatorId: units[0].id,
        station: 'Cannon View',
        direction: 'SB',
        reportedAt: now - 60 * 60 * 1000,
        repairStartAt: now + 12 * 60 * 60 * 1000,
        repairedAt: now + 16 * 60 * 60 * 1000
      },
      {
        id: 'test-progress',
        elevatorId: units[1].id,
        station: 'Oakville City Airport',
        direction: 'NB',
        reportedAt: now - 13 * 60 * 60 * 1000,
        repairStartAt: now - 30 * 60 * 1000,
        repairedAt: now + 3 * 60 * 60 * 1000
      },
      {
        id: 'test-repaired',
        elevatorId: units[2].id,
        station: 'Newkirk',
        direction: 'Exit',
        reportedAt: now - 26 * 60 * 60 * 1000,
        repairStartAt: now - 14 * 60 * 60 * 1000,
        repairedAt: now - 60 * 60 * 1000
      }
    ]
  }, new Date(now));
  return {
    activeText: document.getElementById('elevatorStatusList').textContent,
    activeRows: document.querySelectorAll('.elevator-row:not(.recently-repaired)').length,
    repairedRows: document.querySelectorAll('.elevator-row.recently-repaired').length,
    cannonBadges: Array.from(document.querySelectorAll('.elevator-row:not(.recently-repaired) .station-badges img')).map(img => img.alt)
  };
})()`);
assert.match(elevatorLifecycle.activeText, /Cannon View/);
assert.match(elevatorLifecycle.activeText, /Southbound Elevator/);
assert.match(elevatorLifecycle.activeText, /Awaiting Repair/);
assert.match(elevatorLifecycle.activeText, /Oakville City Airport/);
assert.match(elevatorLifecycle.activeText, /Repairs in Progress/);
assert.match(elevatorLifecycle.activeText, /Recently Repaired Elevators/);
assert.match(elevatorLifecycle.activeText, /Repaired/);
assert.match(elevatorLifecycle.activeText, /2026/);
assert.doesNotMatch(elevatorLifecycle.activeText, /Wychwood/);
assert.ok(elevatorLifecycle.activeRows >= 2);
assert.ok(elevatorLifecycle.repairedRows >= 1);
assert.ok(elevatorLifecycle.cannonBadges.includes('(A)') || elevatorLifecycle.cannonBadges.includes('<A>'));

if (process.env.BORAIL_STATUS_SCREENSHOT) {
  const statusScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(process.env.BORAIL_STATUS_SCREENSHOT, Buffer.from(statusScreenshot.data, 'base64'));
}

console.log(JSON.stringify(routeExamples));
socket.close();
console.log('Timetable trip planner browser and routing tests passed.');
