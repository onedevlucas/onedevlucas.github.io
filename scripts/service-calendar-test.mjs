import assert from 'node:assert/strict';

await import('../assets/js/time.js');
await import('../assets/js/service-calendar.js');

const clock = globalThis.BORailTime;
const service = globalThis.BORailService;

assert.equal(service.context(clock.fromWallTime('2026-11-04', '05:59')).mode, 'closed');
assert.equal(service.context(clock.fromWallTime('2026-11-04', '06:00')).mode, 'rushAM');
assert.equal(service.context(clock.fromWallTime('2026-11-04', '22:59')).mode, 'local');
assert.equal(service.context(clock.fromWallTime('2026-11-04', '23:00')).mode, 'closed');
assert.equal(service.isOriginDepartureAllowed(22 * 60 + 59), true);
assert.equal(service.isOriginDepartureAllowed(23 * 60), false);

const dates2026 = service.winterEmergencyDatesForSeason(2026);
assert.equal(dates2026.length, 10);
assert.equal(new Set(dates2026).size, 10);
assert.deepEqual(dates2026, service.winterEmergencyDatesForSeason(2026));
assert.ok(dates2026.every(dateKey => dateKey >= '2026-12-10' && dateKey <= '2027-03-10'));
assert.notDeepEqual(dates2026, service.winterEmergencyDatesForSeason(2027));

const emergencyDateKey = dates2026[0];
const emergencyDate = clock.fromWallTime(emergencyDateKey, '12:00');
assert.equal(service.context(emergencyDate).mode, 'winterEmergency');
assert.equal(service.context(emergencyDate).winterEmergency, true);

assert.equal(service.WINTER_ROUTES.some(route => route.isExpress), false);
assert.equal(service.WINTER_ROUTES.length, 18);
const route = (line, origin, destination) => service.WINTER_ROUTES.find(item =>
  item.serviceId === line && item.origin === origin && item.destination === destination
);
assert.deepEqual(route('F', 'Newkirk', 'Boylston').stops.at(-1), 'Boylston');
assert.equal(route('F', 'Atkinson Junction', 'Kenilworth').singleTrainShuttle, true);
assert.deepEqual(route('F', 'Atkinson Junction', 'Kenilworth').stops, ['Atkinson Junction', 'Garner', 'Kenilworth']);
assert.equal(route('C', 'Fernwood', 'East Heights').stops.includes('Oakville City Airport'), false);
assert.equal(route('E', 'Santa Mora', 'East Heights').stops.includes('Tyford Farms'), false);
assert.deepEqual(route('D', 'Veridia Nexus', 'Oakville City Airport').stops, ['Veridia Nexus', 'Oakville City Airport']);
assert.equal(service.WINTER_ROUTES.some(item => item.stops.includes('Wychwood')), false);

const winterDelays = Array.from({ length: 1000 }, (_, index) =>
  service.delayInfo(`winter-sample-${index}`, 'winterEmergency', 12)
);
const delayed = winterDelays.filter(info => info.isDelayed);
assert.ok(delayed.length >= 550 && delayed.length <= 650, `Expected about 60% delayed trains; received ${delayed.length / 10}%`);
assert.ok(delayed.every(info => info.delaySeconds >= 5 * 60 && info.delaySeconds <= 15 * 60));
assert.ok(delayed.every(info => info.delayStartStop >= 1 && info.delayStartStop <= 11));

const timing = service.calculateStopTimes('exact-timing-test', ['A', 'B', 'C'], 600, {
  segmentTimes: [2, 3],
  customDwellSeconds: [0, 60, 0],
  mode: 'winterEmergency'
});
assert.equal(timing.stops[1].scheduledArrivalSec, (600 + 2) * 60);
assert.equal(timing.stops[2].scheduledArrivalSec, (600 + 2 + 1 + 3) * 60);

console.log(`Winter service calendar checks passed. 2026–27 emergency dates: ${dates2026.join(', ')}.`);
