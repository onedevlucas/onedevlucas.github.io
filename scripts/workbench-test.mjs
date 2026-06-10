import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Core = require('../assets/js/workbench-core.js');

const world = Core.createSeedWorld('2026-06-10T00:00:00.000Z');

assert.equal(world.schemaVersion, '1.0.0');
assert.equal(world.lines.length, 1);
assert.equal(world.lines[0].shortName, 'A');
assert.equal(world.stations.length, 10);
assert.equal(world.stations[0].name, 'Newkirk');
assert.equal(world.stations.at(-1).name, 'Mount River');
assert.equal(world.railSegments.length, 9);
assert.equal(Core.slugify('Burlington - University of NCU'), 'burlington-university-of-ncu');

const point = { x: 4123, y: 2789 };
assert.deepEqual(Core.mapToWorldCoord(Core.worldToMapCoord(point)), point);
assert.equal(Core.pointInBounds(point, world.settings), true);
assert.equal(Core.pointInBounds({ x: -1, y: 20 }, world.settings), false);

const validIssues = Core.validateWorld(world);
assert.equal(validIssues.some(issue => issue.severity === 'error'), false);

const brokenWorld = Core.deepClone(world);
brokenWorld.stations[1].slug = brokenWorld.stations[0].slug;
brokenWorld.railSegments[0].lineIds = [];
brokenWorld.stations[0].position.x = -50;
const brokenCodes = new Set(Core.validateWorld(brokenWorld).map(issue => issue.code));
assert.equal(brokenCodes.has('DUPLICATE_SLUG'), true);
assert.equal(brokenCodes.has('SEGMENT_LINE'), true);
assert.equal(brokenCodes.has('STATION_BOUNDS'), true);

const roundtrip = JSON.parse(JSON.stringify(world));
assert.deepEqual(roundtrip, world);

console.log('Workbench model, coordinate, validation, and export roundtrip tests passed.');
