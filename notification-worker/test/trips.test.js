import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import '../../assets/js/trip-planner-core.js';
import worker, { evaluateTrips, lineEvent, runNotificationCycle } from '../src/index.js';
import { prepareTrip, tripCandidates } from '../src/trips.js';

const { BORailTime: clock, BORailService: service, BORailSchedule: schedule, BORailStatusEngine: status } = globalThis;
const regularDate = '2026-11-09';
const emergencyDate = service.winterEmergencyDatesForSeason(2026)[0];
const regularNow = clock.fromWallTime('2026-11-06', '12:00');
const at = (day, seconds) => new Date(clock.fromWallTime(day, '12:00').getTime() + (seconds - 43200) * 1000);
const selectLeg = ({ runId, boardStation, alightStation }) => ({ runId, boardStation, alightStation });

test('24-hour departures use the evening intervals, Eastern rush boundaries and one shuttle per line', () => {
  for (const [time, mode] of [['01:00','local'], ['02:00','local'], ['05:59','local'], ['06:00','rushAM'],
    ['09:29','rushAM'], ['09:30','local'], ['16:59','local'], ['17:00','rushPM'], ['19:29','rushPM'], ['19:30','local']]) {
    assert.equal(service.context(clock.fromWallTime(regularDate, time)).mode, mode);
  }
  for (const date of [clock.fromWallTime(regularDate, '01:00'), new Date('2026-03-08T06:30Z'),
    new Date('2026-03-08T07:30Z'), new Date('2026-11-01T05:30Z'), new Date('2026-11-01T06:30Z')]) {
    const seconds = clock.scheduleSeconds(date);
    assert.equal(clock.wallSecondsAt(date, seconds), clock.clockSeconds(date));
    const runs = schedule.buildRunWindow(date);
    const active = runs.filter(r => r.stops[0].actualArrivalSec <= seconds && seconds < r.stops.at(-1).actualDepartureSec);
    assert.ok(active.length && active.every(r => !r.isExpress));
    for (const line of ['D', 'G']) assert.ok(active.filter(r => r.serviceId === line).length <= 1);
    for (const [line, interval] of [['A',20], ['B',25], ['C',20], ['E',25], ['F',20], ['S',20]]) {
      const first = runs.find(r => r.serviceId === line && r.departureMin * 60 >= seconds && !r.isExpress);
      const next = runs.find(r => r.origin === first.origin && r.destination === first.destination &&
        r.serviceId === line && !r.isExpress && r.departureMin > first.departureMin);
      assert.equal(next.departureMin - first.departureMin, interval);
    }
  }
});

test('a midnight carryover keeps its ID and timing, and a late trip can save a next-day connection', () => {
  const before = clock.fromWallTime('2026-11-22', '23:50');
  const midnight = clock.fromWallTime('2026-11-23', '00:00');
  const late = schedule.buildScheduledRuns(before).find(run => run.stops.at(-1).actualDepartureSec > 86400);
  const carry = schedule.buildRunWindow(midnight).find(run => run.id === late.id);
  assert.equal(carry.stops.at(-1).actualDepartureSec + 86400, late.stops.at(-1).actualDepartureSec);
  const result = schedule.planBORailTrip('Bradford Bay', 'Mount River', before, before);
  const journey = result.journeys[0];
  assert.ok(journey.legs.some(leg => leg.runId.endsWith('2026-11-23')));
  const trip = prepareTrip({ dateKey: '2026-11-22', origin: 'Bradford Bay', destination: 'Mount River',
    legs: journey.legs.map(selectLeg) }, before);
  assert.equal(trip.startsAt, at(trip.dateKey, journey.departureSec).getTime());
  const index = new Map(schedule.buildRunWindow(before, {
    knownAt: midnight, runIds: new Set(trip.legs.map(leg => leg.runId))
  }).map(run => [run.id, run]));
  assert.ok(tripCandidates(trip, index, before, {}).every(event => event.key !== 'replan'));
});

test('future emergency date uses the usual rush schedule, stations and shuttles until Eastern midnight', () => {
  const date = clock.fromWallTime(emergencyDate, '08:00');
  const midnight = clock.startOfDay(date);
  const before = schedule.planBORailTrip('Alpherst', 'Tyford Farms', date, new Date(midnight.getTime() - 1000));
  assert.equal(before.mode, 'rushAM');
  assert.equal(before.winterEmergency, false);
  assert.ok(before.journeys.length);
  assert.ok(before.allRuns.some(run => run.isExpress));
  assert.ok(before.allRuns.some(run => run.shuttleKey === 'G'));
  assert.ok(before.allRuns.every(run => run.mode !== 'winterEmergency'));
  const after = schedule.planBORailTrip('Alpherst', 'Tyford Farms', date, midnight);
  assert.equal(after.mode, 'winterEmergency');
  assert.ok(after.destination.unavailable);
  assert.ok(after.allRuns.every(run => !run.isExpress && !run.stops.some(stop => stop.name === 'Tyford Farms')));
  const atMidnight = schedule.buildScheduledRuns(midnight);
  assert.deepEqual(atMidnight.map(run => run.id), schedule.buildScheduledRuns(date).map(run => run.id));
});

test('line thresholds count only active delayed trains and keep express separate', () => {
  const now = clock.fromWallTime(regularDate, '08:00');
  const fakeRun = (isExpress = false, start = 28000, delayStart = 28500) => ({
    serviceId: 'A', isExpress, hasDelay: true, delaySeconds: 120, delayStartSec: delayStart,
    departureMin: start / 60, stops: [{ actualArrivalSec: start }, { actualDepartureSec: 31000 }]
  });
  for (const [count, expected] of [[1, 'ok'], [2, 'ok'], [3, 'minor'], [4, 'major'], [5, 'major']]) {
    const runs = [...Array.from({ length: count }, () => fakeRun()), fakeRun(true), fakeRun(false, 29000), fakeRun(false, 28000, 29000)];
    const signals = status.computeStatusDelaySignals(now, runs);
    assert.equal(signals['A-local'].type, expected);
    assert.equal(signals['A-local'].delayed, count);
    assert.equal(signals['A-express'].type, 'ok');
    const payload = lineEvent('A-local', 'line-minor', signals['A-local'], now).payload;
    if (count === 3) assert.equal(payload.body, 'A local trains delayed. Longest current delay: 2 minutes.');
    assert.equal(payload.url, 'status.html?service=A-local');
  }
});

test('the Status schedule shortcut agrees with the full timetable at service boundaries', () => {
  for (const day of [regularDate, emergencyDate]) {
    for (const time of ['00:00', '05:59', '06:03', '08:12', '09:30', '12:10', '17:01', '19:30', '22:59', '23:05', '23:59']) {
      const date = clock.fromWallTime(day, time);
      const allRuns = schedule.buildRunWindow(date);
      assert.deepEqual(status.computeStatusDelaySignals(date), status.computeStatusDelaySignals(date, allRuns), `${day} ${time}`);
    }
  }
});

test('a real planner itinerary can be saved with exact run IDs and get a 20-minute reminder once', () => {
  const date = clock.fromWallTime(regularDate, '08:00');
  const result = schedule.planBORailTrip('Djimar', 'Santa Mora', date, regularNow);
  const journey = result.journeys[0];
  assert.ok(journey.legs.length > 1);
  const trip = prepareTrip({
    dateKey: regularDate, origin: 'Djimar', destination: 'Santa Mora', legs: journey.legs.map(selectLeg)
  }, regularNow);
  assert.deepEqual(trip.legs.map(selectLeg), journey.legs.map(selectLeg));
  const runs = new Map(schedule.buildScheduledRuns(date).map(run => [run.id, run]));
  const due = new Date(trip.startsAt - 20 * 60000);
  assert.equal(tripCandidates(trip, runs, new Date(due.getTime() - 60000), {}).length, 0);
  const alerts = tripCandidates(trip, runs, due, {});
  assert.deepEqual(alerts.map(item => item.key), ['reminder']);
  assert.match(alerts[0].body, /in 20 minutes/);
  assert.match(alerts[0].url, /view=planner&from=Djimar&to=Santa\+Mora/);
  assert.equal(tripCandidates(trip, runs, due, { flags: ['reminder'] }).length, 0);
});

test('known run delays and missed transfers alert only after the train starts and the delay begins', () => {
  const station = (name, stopIndex, scheduled, delay = 0) => ({
    name, stopIndex, scheduledDepartureSec: scheduled, scheduledArrivalSec: scheduled,
    actualDepartureSec: scheduled + delay, actualArrivalSec: scheduled + delay, delaySeconds: delay
  });
  const first = {
    id: 'A-run', hasDelay: true, delayStartSec: 28900,
    stops: [station('Origin', 0, 28800), station('Board', 1, 29000, 300), station('Transfer', 2, 29400, 300), station('Terminal', 3, 29900, 300)]
  };
  const second = { id: 'C-run', hasDelay: false, stops: [station('Transfer', 0, 29600), station('End', 1, 30000)] };
  const trip = {
    dateKey: regularDate, origin: 'Board', destination: 'End',
    legs: [
      { runId: first.id, serviceId: 'A', boardStation: 'Board', alightStation: 'Transfer', departureSec: 29000, arrivalSec: 29400 },
      { runId: second.id, serviceId: 'C', boardStation: 'Transfer', alightStation: 'End', departureSec: 29600, arrivalSec: 30000 }
    ]
  };
  const runs = new Map([[first.id, first], [second.id, second]]);
  const options = { flags: ['reminder'] };
  assert.deepEqual(tripCandidates(trip, runs, at(regularDate, 28799), options), []);
  assert.deepEqual(tripCandidates(trip, runs, at(regularDate, 28899), options), []);
  const alerts = tripCandidates(trip, runs, at(regularDate, 28900), options);
  assert.deepEqual(alerts.map(item => item.key), ['delay-0-300', 'transfer-0']);
  assert.match(alerts[0].body, /Your A train scheduled to leave Board.*5 min/);
  assert.deepEqual(tripCandidates(trip, runs, at(regularDate, 29700), options), []);
});

function testDb() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['../schema.sql', '../migrations/0001_saved_trips.sql', '../migrations/0002_operations.sql']) {
    sqlite.exec(readFileSync(new URL(file, import.meta.url), 'utf8'));
  }
  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      const bind = (...args) => ({
        first: async () => statement.get(...args),
        all: async () => ({ results: statement.all(...args) }),
        run: async () => ({ meta: statement.run(...args) })
      });
      return { bind, ...bind() };
    },
    batch: statements => Promise.all(statements.map(statement => statement.run()))
  };
  return { sqlite, DB: db };
}

test('a winter change queues only on the service date, and canceled trips cannot deliver queued alerts', async () => {
  const env = testDb();
  const date = clock.fromWallTime(emergencyDate, '08:00');
  const journey = schedule.planBORailTrip('Alpherst', 'Tyford Farms', date, regularNow).journeys[0];
  const trip = prepareTrip({
    dateKey: emergencyDate, origin: 'Alpherst', destination: 'Tyford Farms', legs: journey.legs.map(selectLeg)
  }, regularNow);
  env.sqlite.prepare(`INSERT INTO subscriptions VALUES ('device','https://push.example.test','key','auth',?,'hash','','')`)
    .run(JSON.stringify({ alerts: { winterEmergency: false } }));
  env.sqlite.prepare(`INSERT INTO saved_trips
    (id, subscription_id, date_key, starts_at, expires_at, journey_key, trip_json) VALUES ('trip','device',?,?,?,?,?)`)
    .run(trip.dateKey, trip.startsAt, trip.expiresAt, 'journey', JSON.stringify(trip));
  const midnight = clock.startOfDay(date);
  await evaluateTrips(env, new Date(midnight.getTime() - 1000));
  assert.equal(env.sqlite.prepare('SELECT count(*) AS n FROM events').get().n, 0);
  await evaluateTrips(env, midnight);
  await evaluateTrips(env, new Date(midnight.getTime() + 60000));
  const events = env.sqlite.prepare("SELECT * FROM events WHERE event_type = 'trip-update'").all();
  assert.equal(events.length, 1);
  assert.match(JSON.parse(events[0].payload_json).body, /Winter Emergency Service is in effect today/);
  env.sqlite.prepare("DELETE FROM subscriptions WHERE id = 'device'").run();
  assert.equal(env.sqlite.prepare('SELECT count(*) AS n FROM saved_trips').get().n, 0);
  await runNotificationCycle(env, midnight);
  assert.ok(env.sqlite.prepare("SELECT processed_at FROM events WHERE event_type = 'trip-update'").get().processed_at);
});

test('saved trips API checks device ownership, deduplicates saves, lists and cancels trips', async () => {
  const env = testDb();
  const call = (path, method, token, body) => worker.fetch(new Request(`https://example.test${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body)
  }), env);
  const created = await call('/subscriptions', 'POST', null, {
    subscription: { endpoint: 'https://push.example.test/test', keys: { p256dh: 'dummy', auth: 'dummy' } }
  });
  assert.equal(created.status, 201);
  const { id, manageToken } = await created.json();
  const path = `/subscriptions/${id}/trips`;
  const dateKey = clock.dateKey(Date.now() + 2 * 86400_000);
  const date = clock.fromWallTime(dateKey, '08:00');
  const result = schedule.planBORailTrip('Djimar', 'Santa Mora', date);
  const trip = { dateKey, origin: 'Djimar', destination: 'Santa Mora', legs: result.journeys[0].legs.map(selectLeg) };
  assert.equal((await call(path, 'GET', 'wrong-token')).status, 404);
  const saved = await call(path, 'POST', manageToken, trip);
  assert.equal(saved.status, 201);
  const details = await saved.json();
  assert.equal((await (await call(path, 'POST', manageToken, trip)).json()).id, details.id);
  assert.equal((await (await call(path, 'GET', manageToken)).json()).trips.length, 1);
  assert.equal((await call(`${path}/${details.id}`, 'DELETE', manageToken)).status, 200);
  assert.deepEqual((await (await call(path, 'GET', manageToken)).json()).trips, []);
});
