import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker, { wantsEvent } from '../src/index.js';
import { describeService, operationalEvents, prepareRevision } from '../src/operations.js';
import { prepareTrip, tripCandidates } from '../src/trips.js';

const clock = globalThis.BORailTime;
const schedule = globalThis.BORailSchedule;
const ops = globalThis.BORailOperations;
const day = '2026-11-19';
const at = time => clock.fromWallTime(day, time);
const dayStart = ops.serviceDayStart(at('12:00'));
const closed = (target, startsAt = +at('00:00'), endsAt = null) => ({
  id: target, kind: 'station', target, startsAt, endsAt, reason: 'Construction'
});
const operations = (...changes) => ({ revision: 1, changes });
const routes = (snapshot, id, pattern) => schedule.buildScheduledRuns(at('08:00'), true, {
  operations: snapshot
}).filter(run => ops.serviceKey(run) === id &&
  (!pattern || run.id.includes(pattern)));
const pathNames = run => run.stops.map(stop => stop.name);

test('B local and B Express use corrected station coordinates and onward geometry', () => {
  const b = routes(ops.empty, 'B-local');
  const outbound = b.find(run => run.origin === 'Harrington City');
  const inbound = b.find(run => run.destination === 'Harrington City');
  assert.deepEqual(pathNames(outbound).slice(0, 7),
    ['Harrington City', 'South Harrington', 'Vanwood', 'Hutchinson Point', 'Madisonboro', 'Groveton', 'Orchard Ridge']);
  assert.deepEqual(pathNames(inbound).slice(-7), pathNames(outbound).slice(0, 7).reverse());
  const geometry = globalThis.BORAIL_ID_ROUTE_GEOMETRY;
  assert.equal(geometry['B-local|Groveton|Madisonboro'].at(-1)[0] > 480, true);
  assert.equal(geometry['B-express|Greens Corner|Madisonboro'].at(-1)[0] > 480, true);
  assert.deepEqual(geometry['B-local|Madisonboro|Hutchinson Point'].at(-1),
    geometry['B-local|Hutchinson Point|Vanwood'][0]);
});

test('terminus rules compose and preserve rail paths and unaffected services', () => {
  const cases = [
    ['Newkirk', 'F-local', 'Hoganville'], ['Newkirk', 'F-express', 'Hoganville'],
    ['Newkirk', 'A-local', 'Burlington - University of NCU'], ['Newkirk', 'S-express', 'Burlington - University of NCU'],
    ['Berwick Hall', 'G-local', 'Westpoint'], ['Bradford Bay', 'G-local', 'Bradford Square'],
    ['Kenilworth', 'F-local', 'Atkinson Junction', 'Kenilworth'], ['Boylston', 'F-local', 'Brookfield Lawn', 'Boylston'],
    ['Whitebranch', 'F-express', 'New Cottage'], ['Burlington - University of NCU', 'S-local', 'Newkirk'],
    ['Port Williamson', 'A-express', 'Willow Springs'], ['Ralston-Finch East', 'S-local', 'Vanderburg'],
    ['Ralston-Finch East', 'S-express', 'Vanderburg'], ['Veridia Nexus', 'D-local', null],
    ['Oakville City Airport', 'D-local', null], ['Oakville City Airport', 'C-local', 'Fernwood'],
    ['Leighton Castle', 'B-local', 'Oakville Plaza'], ['Leighton Castle', 'B-express', 'Oakville Plaza'],
    ['Mount River', 'A-local', 'Talmedge Hill'], ['Mount River', 'A-express', 'Talmedge Hill'],
    ['Fernwood', 'C-local', 'Joplin', 'Fernwood'], ['East Heights', 'E-local', 'Alpherst'],
    ['East Heights', 'C-local', 'Roxbury Landing'], ['Santa Mora', 'E-local', 'Brandywine'],
    ['Harrington City', 'B-local', 'South Harrington'], ['Hadleigh', 'B-express', 'Carrollton']
  ];
  for (const [station, service, terminal, pattern] of cases) {
    const runs = routes(operations(closed(station)), service, pattern);
    if (!terminal) { assert.equal(runs.length, 0, station); continue; }
    assert.ok(runs.length, station);
    for (const run of runs) {
      assert.ok([run.origin, run.destination].includes(terminal), `${station} ${run.id}`);
      assert.ok(!pathNames(run).includes(station), `${station} ${run.id}`);
      assert.ok(!run.legs || run.legs.every(leg => leg.length && leg.every(key => globalThis.BORAIL_ID_ROUTE_GEOMETRY[key])),
        `${station} ${run.id} ${JSON.stringify(run.legs)}`);
    }
  }
  assert.equal(routes(operations(closed('Newkirk'), closed('Boylston'), closed('Kenilworth')), 'F-local').length, 0);
  assert.deepEqual(routes(operations(closed('Newkirk')), 'E-local'), routes(ops.empty, 'E-local'));
  const b = routes(operations(closed('Harrington City'), closed('Leighton Castle')), 'B-local');
  assert.ok(b.every(run => [run.origin, run.destination].sort().join('|') === 'Oakville Plaza|South Harrington'));
  assert.ok(routes(operations(closed('Harrington City')), 'B-express').every(run =>
    !pathNames(run).includes('Harrington City') && pathNames(run).includes('Hadleigh')));
  assert.ok(routes(operations(closed('East Heights')), 'E-local').every(run =>
    !pathNames(run).includes('Roxbury Landing')));
  assert.ok(routes(operations(closed('Mount River')), 'A-express').every(run =>
    [run.origin, run.destination].sort().join('|') === 'Newkirk|Talmedge Hill'));
});

test('active edits preserve completed stops and express edits can use connected local tracks', () => {
  const run = routes(ops.empty, 'B-local').find(candidate => candidate.destination === 'Harrington City');
  const madisonboro = run.stops.find(stop => stop.name === 'Madisonboro');
  const now = dayStart + madisonboro.actualArrivalSec * 1000;
  const remaining = run.stops.slice(madisonboro.stopIndex + 1).map(stop => stop.name).filter(name => name !== 'Vanwood');
  const action = { kind: 'train', target: run.id, stops: remaining };
  const edited = prepareRevision(ops.empty, [action], now).summary[0].run;
  assert.deepEqual(edited.stops.slice(0, madisonboro.stopIndex + 1), run.stops.slice(0, madisonboro.stopIndex + 1));
  assert.ok(!pathNames(edited).includes('Vanwood'));
  assert.throws(() => prepareRevision(ops.empty, [{ ...action, stops: ['Orchard Ridge'] }], now), /already passed/);
  const express = routes(ops.empty, 'F-express').find(candidate => candidate.destination === 'Whitebranch');
  const stops = pathNames(express);
  stops.splice(stops.indexOf('Hoganville') + 1, 0, 'Bayview Park', 'Chelsea Bay');
  const result = prepareRevision(ops.empty, [{ kind: 'train', target: express.id, stops }], +at('05:00'));
  assert.deepEqual(pathNames(result.summary[0].run), stops);
  const g = routes(ops.empty, 'G-local').find(candidate => candidate.origin === 'Bradford Bay' && candidate.departureMin >= 360);
  assert.throws(() => prepareRevision(ops.empty, [
    { kind: 'train', target: g.id, stops: ['Bradford Bay', 'New Halifax'] }
  ], +at('05:00')), /No connected rail path/);
});

test('actual departure cutoff preserves running trips, with reopening and exact service controls', () => {
  const original = routes(ops.empty, 'B-local').find(run => run.origin === 'Leighton Castle' && run.departureMin > 480);
  const departed = dayStart + original.stops[0].actualDepartureSec * 1000;
  const lookup = snapshot => routes(snapshot, 'B-local').find(run => run.id === original.id);
  assert.equal(lookup(operations(closed('Harrington City', departed + 1))).destination, 'Harrington City');
  assert.equal(lookup(operations(closed('Harrington City', departed))).destination, 'South Harrington');
  assert.equal(lookup(operations(closed('Harrington City', departed - 1000, departed))).destination, 'Harrington City');
  const bOff = { kind: 'service', id: 's', target: 'B-express', startsAt: +at('06:00'), reason: 'Testing' };
  assert.equal(routes(operations(bOff), 'B-express').length, 0);
  assert.equal(routes(operations(bOff), 'B-local').length, routes(ops.empty, 'B-local').length);
  const system = { ...bOff, id: 'all', kind: 'system', target: 'system', startsAt: departed, endsAt: +at('17:00'), recoveryMinutes: 30 };
  assert.equal(lookup(operations(system)), undefined);
  assert.ok(routes(operations(system), 'B-local').some(run => run.mode === 'rushPM'));
});

test('a one-time G edit updates a valid saved trip; removing its boarding stop requires a replan', () => {
  const run = routes(ops.empty, 'G-local').find(run => run.origin === 'Bradford Bay' && run.departureMin >= 360);
  const now = at('05:45');
  const trip = prepareTrip({
    dateKey: day, origin: 'Bradford Bay', destination: 'Berwick Hall',
    legs: [{ runId: run.id, boardStation: 'Bradford Bay', alightStation: 'Berwick Hall' }]
  }, now);
  const draft = { kind: 'train', target: run.id, stops: ['Bradford Bay', 'Bradford Square', 'Berwick Hall'] };
  const snapshot = prepareRevision(ops.empty, [draft], +now);
  const edited = routes(snapshot, 'G-local').find(other => other.id === run.id);
  assert.deepEqual(pathNames(edited), draft.stops);
  assert.match(tripCandidates(trip, new Map([[edited.id, edited]]), now, {})[0].title, /Your G train schedule has changed/);
  const removed = prepareRevision(ops.empty, [{ ...draft, stops: draft.stops.slice(1) }], +now);
  const removedRun = routes(removed, 'G-local').find(other => other.id === run.id);
  assert.match(tripCandidates(trip, new Map([[run.id, removedRun]]), now, {})[0].title, /Replan/);
  assert.deepEqual(schedule.buildScheduledRuns(clock.fromWallTime('2026-11-20', '08:00'), true, { operations: snapshot }),
    schedule.buildScheduledRuns(clock.fromWallTime('2026-11-20', '08:00')));
});

test('scheduled administrative alerts are universal and emitted at start and reopening', () => {
  const start = +at('14:00');
  const end = +at('15:00');
  const snapshot = operations(closed('Berwick Hall', start, end));
  assert.deepEqual(operationalEvents(snapshot, start - 1), []);
  const alerts = operationalEvents(snapshot, start);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].payload.title, 'Station Closed - Berwick Hall');
  assert.equal(wantsEvent({ preferences_json: '{}' }, { event_type: 'operations' }), true);
  assert.equal(operationalEvents(snapshot, end).at(-1).payload.title, 'Station Reopened - Berwick Hall');
  assert.equal(describeService('F-local', new Date(start), snapshot).type, 'bypassed');
});

test('Worker password login, expiry, authorization, rate limit and revision compare-and-swap', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0002_operations.sql', import.meta.url), 'utf8'));
  const DB = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      const bind = (...args) => ({
        first: async () => statement.get(...args),
        all: async () => ({ results: statement.all(...args) }),
        run: async () => ({ meta: statement.run(...args) })
      });
      return { bind, ...bind() };
    }
  };
  const password = 'test-only-password';
  const env = { DB, OPERATIONS_PASSWORD_HASH: createHash('sha256').update(password).digest('base64url') };
  const call = (path, body, token, ip = '127.0.0.1') => worker.fetch(new Request(`https://worker.test${path}`, {
    method: body ? 'POST' : 'GET', headers: { 'CF-Connecting-IP': ip, Authorization: `Bearer ${token || ''}` },
    body: body && JSON.stringify(body)
  }), env);
  const endpoint = '/admin/operations/';
  const payload = { revision: 0, actions: [{ kind: 'station', target: 'Newkirk', reason: 'Repairs' }] };
  assert.equal((await call(endpoint + 'publish', payload)).status, 401);
  for (let index = 0; index < 8; index++) {
    assert.equal((await call(endpoint + 'login', { password: 'wrong' }, null, '127.0.0.2')).status, 401);
  }
  assert.equal((await call(endpoint + 'login', { password }, null, '127.0.0.2')).status, 429);
  const session = await (await call(endpoint + 'login', { password })).json();
  assert.equal((await call(endpoint + 'preview', payload, session.token)).status, 200);
  assert.equal((await (await call('/operations')).json()).revision, 0);
  const results = await Promise.all([call(endpoint + 'publish', payload, session.token), call(endpoint + 'publish', payload, session.token)]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  const published = await (await call('/operations')).json();
  assert.equal(published.revision, 1);
  assert.equal(published.changes[0].target, 'Newkirk');
  sqlite.exec('UPDATE operations_sessions SET expires_at = 0');
  assert.equal((await call(endpoint + 'overview', null, session.token)).status, 401);
});
