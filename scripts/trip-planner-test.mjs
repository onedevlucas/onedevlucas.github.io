import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Planner = require('../assets/js/trip-planner-core.js');

function run(id, serviceId, isExpress, destination, stops) {
  return {
    id, serviceId, isExpress, tag: isExpress ? 'EXP' : 'LCL', origin: stops[0][0], destination,
    stops: stops.map(([name, minute]) => ({
      name,
      scheduledArrivalSec: minute * 60,
      scheduledDepartureSec: minute * 60,
      actualArrivalSec: minute * 60,
      actualDepartureSec: minute * 60,
      isDelayed: false,
      delaySeconds: 0
    }))
  };
}

const runs = [
  run('local-1', 'A', false, 'C', [['A', 0], ['B', 10], ['C', 20]]),
  run('express-1', 'A', true, 'C', [['A', 3], ['C', 15]]),
  run('connection-tight', 'C', false, 'D', [['C', 17], ['D', 27]]),
  run('connection-safe', 'C', false, 'D', [['C', 24], ['D', 34]])
];

const all = Planner.planJourneys({ runs, origin: 'A', destination: 'D', startTimeSec: 0, minTransferSec: 120 });
assert.ok(all.length > 0);
assert.equal(all[0].arrivalSec, 27 * 60);
assert.equal(all[0].legs[0].isExpress, true);
assert.equal(all[0].legs[1].transferWaitSec, 2 * 60);

const local = Planner.planJourneys({ runs: runs.filter(item => !item.isExpress), origin: 'A', destination: 'C', startTimeSec: 0 });
const directAll = Planner.planJourneys({ runs, origin: 'A', destination: 'C', startTimeSec: 0 });
const recommended = Planner.selectRecommendedJourneys(local, directAll, { expressMinimumGainSec: 120, limit: 3 });
assert.equal(recommended[0].hasExpress, true);

const weakExpress = [run('express-slow', 'A', true, 'C', [['A', 3], ['C', 19]])];
const weakAll = Planner.planJourneys({ runs: [runs[0], ...weakExpress], origin: 'A', destination: 'C', startTimeSec: 0 });
const localOnly = Planner.planJourneys({ runs: [runs[0]], origin: 'A', destination: 'C', startTimeSec: 0 });
const filtered = Planner.selectRecommendedJourneys(localOnly, weakAll, { expressMinimumGainSec: 120, limit: 3 });
assert.equal(filtered.some(item => item.hasExpress), false);

const earlierButLonger = {
  signature: 'earlier-longer', hasExpress: false, departureSec: 0, arrivalSec: 33 * 60,
  durationSec: 33 * 60, rideDurationSec: 33 * 60, transfers: 2
};
const laterButFaster = {
  signature: 'later-faster', hasExpress: false, departureSec: 2 * 60, arrivalSec: 34 * 60,
  durationSec: 34 * 60, rideDurationSec: 32 * 60, transfers: 2
};
const durationRanked = Planner.selectRecommendedJourneys([earlierButLonger, laterButFaster], [], { limit: 3 });
assert.equal(durationRanked[0].signature, 'later-faster');
assert.equal(durationRanked[0].rideDurationSec, 32 * 60);

const delayedFeeder = run('delayed-feeder', 'A', false, 'C', [['A', 0], ['C', 16]]);
delayedFeeder.hasDelay = true;
delayedFeeder.delaySeconds = 60;
delayedFeeder.stops[1].isDelayed = true;
delayedFeeder.stops[1].delaySeconds = 60;
const delayedJourney = Planner.planJourneys({
  runs: [delayedFeeder, runs[2], runs[3]],
  origin: 'A',
  destination: 'D',
  startTimeSec: 0,
  minTransferSec: 120
});
assert.equal(delayedJourney[0].arrivalSec, 34 * 60);
assert.equal(delayedJourney[0].legs[1].runId, 'connection-safe');
assert.equal(delayedJourney[0].hasDelay, true);

console.log('Trip planner routing, transfer, and express recommendation tests passed.');
