import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decideLineTransition,
  elevatorCandidate,
  lineEvent,
  normalizePreferences,
  serviceLabel
} from '../src/index.js';

const NOW = new Date('2026-11-05T15:00:00Z');
const SIGNAL = { reason: 'One active train is delayed.' };

test('local service recovery uses the approved F Line wording', () => {
  const transition = decideLineTransition(
    'F-local',
    { current_state: 'minor', last_disruption: 'minor' },
    'ok',
    SIGNAL,
    NOW
  );
  assert.equal(transition.lastDisruption, null);
  assert.equal(transition.event.payload.title, 'F Line - Normal Service Resumed');
  assert.equal(transition.event.preference, 'lineNormalResumed');
});

test('a no-active gap preserves a disruption without sending a false recovery', () => {
  const transition = decideLineTransition(
    'F-local',
    { current_state: 'minor', last_disruption: 'minor' },
    'noactive',
    SIGNAL,
    NOW
  );
  assert.equal(transition.lastDisruption, 'minor');
  assert.equal(transition.event, null);
});

test('scheduled no service never produces the unexpected no-service alert', () => {
  const transition = decideLineTransition(
    'F-express',
    { current_state: 'ok', last_disruption: null },
    'noservice',
    SIGNAL,
    NOW
  );
  assert.equal(transition.event, null);
});

test('elevator recovery uses the approved station wording', () => {
  const event = elevatorCandidate({ id: 'newkirk-sb', station: 'Newkirk', direction: 'SB' }, 'fixed');
  assert.equal(event.payload.title, 'Elevator Fixed - Newkirk');
  assert.equal(event.preference, 'stationElevatorFixed');
});

test('normalizes favorites and all seven allowed notification choices', () => {
  const preferences = normalizePreferences({
    services: ['F-local', 'F-local', 'invalid'],
    stations: ['Newkirk', 'Newkirk'],
    alerts: { lineNormalResumed: true, stationElevatorFixed: true }
  });
  assert.deepEqual(preferences.services, ['F-local']);
  assert.deepEqual(preferences.stations, ['Newkirk']);
  assert.equal(Object.keys(preferences.alerts).length, 7);
});

test('service labels distinguish local and express favorites', () => {
  assert.equal(serviceLabel('F-local'), 'F Line');
  assert.equal(serviceLabel('F-express'), 'F Express');
  assert.match(lineEvent('F-local', 'line-minor', SIGNAL, NOW).payload.title, /^F Line/);
});
