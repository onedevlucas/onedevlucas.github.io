import assert from 'node:assert/strict';

await import('../assets/js/time.js');

const clock = globalThis.BORailTime;
assert.equal(clock.TIME_ZONE, 'America/New_York');

const winter = clock.parts(new Date('2026-01-15T13:00:00Z'));
assert.deepEqual(
  { hour: winter.hour, minute: winter.minute, zoneName: winter.zoneName },
  { hour: 8, minute: 0, zoneName: 'EST' }
);

const summer = clock.parts(new Date('2026-07-15T12:00:00Z'));
assert.deepEqual(
  { hour: summer.hour, minute: summer.minute, zoneName: summer.zoneName },
  { hour: 8, minute: 0, zoneName: 'EDT' }
);

assert.equal(clock.fromWallTime('2026-01-15', '08:00').toISOString(), '2026-01-15T13:00:00.000Z');
assert.equal(clock.fromWallTime('2026-07-15', '08:00').toISOString(), '2026-07-15T12:00:00.000Z');
assert.equal(clock.fromWallTime('2026-03-08', '02:30'), null);
assert.equal(clock.dateKey(new Date('2026-09-28T03:30:00Z')), '2026-09-27');
assert.equal(clock.startOfDay(new Date('2026-07-15T20:00:00Z')).toISOString(), '2026-07-15T04:00:00.000Z');

console.log('New York time conversion checks passed for EST, EDT, midnight, and the DST spring-forward gap.');
