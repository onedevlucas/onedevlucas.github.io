import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the same schedule used by the timetable and notification worker.
const context = vm.createContext({ console });
for (const file of ['time.js', 'service-calendar.js', 'schedule.js']) {
  vm.runInContext(fs.readFileSync(new URL(`../assets/js/${file}`, import.meta.url), 'utf8'), context);
}
const clock = context.BORailTime;
const service = context.BORailService;
const dates = ['2026-11-05', '2026-07-15', '2026-03-08', '2026-11-01', ...service.winterEmergencyDatesForSeason(2026)];
let checked = 0;
for (const day of dates) {
  context.testDate = clock.fromWallTime(day, '12:00');
  const runs = vm.runInContext('buildScheduledRuns(testDate)', context);
  const keys = [...new Set(runs.filter(run => run.isSingleShuttle).map(run => run.shuttleKey))];
  for (const key of keys) {
    const trips = runs.filter(run => run.shuttleKey === key).sort((a, b) => a.departureMin - b.departureMin);
    assert.ok(trips.length > 1);
    for (let index = 0; index < trips.length; index += 1) {
      const trip = trips[index];
      assert.ok(trip.departureMin >= clock.serviceDay(context.testDate).firstMinute && trip.departureMin < 1440, 'No origin departure outside operating hours');
      if (!index) continue;
      const previous = trips[index - 1];
      const terminal = previous.stops.at(-1);
      assert.equal(trip.origin, previous.destination);
      const minimumLayover = key === 'F-winter-shuttle' ? 300 : 60;
      assert.ok(trip.stops[0].scheduledArrivalSec >= terminal.actualDepartureSec + minimumLayover - 0.001,
        `${day} ${key}: return must wait for the delayed trip and layover`);
      checked += 1;
    }
  }
  context.testRuns = runs;
  const statusContext = vm.createContext({ console, BORailTime: clock, BORailService: service });
  vm.runInContext(fs.readFileSync(new URL('../assets/js/status.js', import.meta.url), 'utf8'), statusContext);
  statusContext.testDate = context.testDate;
  const statusRuns = vm.runInContext('statusRunDescriptors(testDate)', statusContext);
  for (const key of keys) {
    const line = key === 'F-winter-shuttle' ? 'F' : key;
    const expected = runs.filter(run => run.shuttleKey === key);
    const actual = statusRuns.filter(run => run.route.shuttleKey === key);
    assert.equal(actual.length, expected.length, `${day} ${line}: status/timetable trip counts match`);
    actual.forEach((run, index) => {
      assert.equal(run.departureMin, expected[index].departureMin);
      assert.ok(Math.abs(run.endMin * 60 - expected[index].stops.at(-1).actualDepartureSec) < 0.001);
    });
  }
}
console.log(`Verified ${checked} shuttle turnarounds across ${dates.length} regular, DST, and Winter Emergency dates. No overlapping G, D, or winter F shuttle trips; Status timing matches.`);
