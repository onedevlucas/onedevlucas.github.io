(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BORailWorkbench = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const SCHEMA_VERSION = '1.0.0';
  const WORLD_WIDTH = 10000;
  const WORLD_HEIGHT = 7000;

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function slugify(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unnamed';
  }

  function makeId(prefix, existingIds) {
    const used = existingIds instanceof Set ? existingIds : new Set(existingIds || []);
    let id;
    do {
      const stamp = Date.now().toString(36);
      const random = Math.random().toString(36).slice(2, 7);
      id = `${prefix}_${stamp}_${random}`;
    } while (used.has(id));
    return id;
  }

  function pointInBounds(point, settings) {
    return Boolean(point) && Number.isFinite(point.x) && Number.isFinite(point.y) &&
      point.x >= 0 && point.y >= 0 &&
      point.x <= settings.worldWidth && point.y <= settings.worldHeight;
  }

  function worldToMapCoord(point) {
    return { x: point.x, y: point.y };
  }

  function mapToWorldCoord(point) {
    return { x: point.x, y: point.y };
  }

  function createSeedWorld(nowValue) {
    const now = nowValue || new Date().toISOString();
    const lineId = 'line_a_green';
    const stationSpecs = [
      ['station_newkirk', 'Newkirk', 1800, 720, true, false, 'terminal'],
      ['station_burlington', 'Burlington - University of NCU', 2500, 1320, true, false, 'transfer'],
      ['station_cannon_view', 'Cannon View', 3150, 1880, true, false, 'transfer'],
      ['station_atkins_bridge', 'Atkins Bridge', 3700, 2450, true, false, 'local'],
      ['station_radcliff_fields', 'Radcliff Fields', 4300, 3030, false, false, 'local'],
      ['station_oakville_airport', 'Oakville City Airport', 5000, 3550, true, false, 'transfer'],
      ['station_oakville_exchange', 'Oakville Exchange', 5700, 4100, true, false, 'transfer'],
      ['station_oakville_plaza', 'Oakville Plaza', 6350, 4720, true, false, 'transfer'],
      ['station_talmedge_hill', 'Talmedge Hill', 7000, 5360, true, false, 'local'],
      ['station_mount_river', 'Mount River', 7650, 6020, true, false, 'terminal']
    ];

    const stations = stationSpecs.map(([id, name, x, y, accessible, expressStop, stationType]) => ({
      id,
      name,
      slug: slugify(name),
      position: { x, y },
      lineIds: [lineId],
      accessible,
      expressStop,
      status: 'active',
      stationType,
      notes: name === 'Oakville City Airport' ? 'Airport connection and transfer point.' : ''
    }));

    const railSegments = stations.slice(0, -1).map((station, index) => {
      const next = stations[index + 1];
      const bend = index % 2 === 0 ? 90 : -70;
      return {
        id: `segment_a_${String(index + 1).padStart(2, '0')}`,
        name: `${station.name} to ${next.name}`,
        lineIds: [lineId],
        path: [
          deepClone(station.position),
          { x: Math.round((station.position.x + next.position.x) / 2 + bend), y: Math.round((station.position.y + next.position.y) / 2) },
          deepClone(next.position)
        ],
        verticalMode: index === 2 ? 'bridge' : index === 5 ? 'elevated' : index === 7 ? 'tunnel' : 'surface',
        trackType: 'mainline',
        status: 'active',
        fromStationId: station.id,
        toStationId: next.id,
        notes: ''
      };
    });

    return {
      schemaVersion: SCHEMA_VERSION,
      worldId: 'world_borail_green_starter',
      name: 'BORail Flatlands: Green Line',
      description: 'Starter Architect Workbench world featuring every Green Line (A) local station.',
      createdAt: now,
      updatedAt: now,
      settings: { worldWidth: WORLD_WIDTH, worldHeight: WORLD_HEIGHT, gridSize: 250, origin: 'top-left' },
      lines: [{
        id: lineId,
        name: 'Green Line',
        shortName: 'A',
        color: '#34c759',
        status: 'active',
        description: 'Local service between Newkirk and Mount River.'
      }],
      stations,
      railSegments,
      landPolygons: [
        {
          id: 'land_flatlands_central',
          name: 'Central Flatlands',
          polygon: [{x:900,y:420},{x:6500,y:300},{x:8300,y:2250},{x:9000,y:6350},{x:5050,y:6740},{x:1200,y:5600}],
          landType: 'suburban'
        },
        {
          id: 'land_oakville_urban',
          name: 'Oakville Urban Core',
          polygon: [{x:3850,y:2850},{x:6100,y:2650},{x:6900,y:4700},{x:5550,y:5300},{x:3950,y:4300}],
          landType: 'urban'
        }
      ],
      waterPolygons: [
        {
          id: 'water_newkirk_bay',
          name: 'Newkirk Bay',
          polygon: [{x:0,y:0},{x:10000,y:0},{x:10000,y:620},{x:7250,y:980},{x:4200,y:620},{x:1300,y:1080},{x:0,y:790}],
          waterType: 'bay'
        },
        {
          id: 'water_river_azure',
          name: 'Azure River',
          polygon: [{x:2850,y:0},{x:3350,y:0},{x:4030,y:1400},{x:4450,y:2600},{x:5050,y:3900},{x:6000,y:5200},{x:6650,y:7000},{x:6100,y:7000},{x:5500,y:5450},{x:4600,y:4250},{x:3980,y:2800},{x:3500,y:1500}],
          waterType: 'river'
        }
      ],
      regions: [
        {
          id: 'region_newkirk',
          name: 'Newkirk District',
          polygon: [{x:700,y:500},{x:3300,y:420},{x:3900,y:2150},{x:2500,y:2680},{x:700,y:1900}],
          regionType: 'district'
        },
        {
          id: 'region_oakville',
          name: 'Oakville',
          polygon: [{x:3500,y:2500},{x:6900,y:2400},{x:7900,y:5450},{x:5900,y:6400},{x:3400,y:4700}],
          regionType: 'city'
        }
      ],
      labels: [
        { id: 'label_newkirk', text: 'NEWKIRK', position: {x:1050,y:1450}, labelType: 'city' },
        { id: 'label_oakville', text: 'OAKVILLE', position: {x:4750,y:4600}, labelType: 'city' },
        { id: 'label_newkirk_bay', text: 'NEWKIRK BAY', position: {x:6500,y:420}, labelType: 'water' }
      ],
      terrainZones: [
        {
          id: 'terrain_talmedge_hills',
          name: 'Talmedge Hills',
          polygon: [{x:6100,y:4550},{x:8300,y:4300},{x:9300,y:6400},{x:7450,y:6900},{x:5900,y:5850}],
          elevation: 420,
          terrainType: 'hill'
        },
        {
          id: 'terrain_newkirk_lowlands',
          name: 'Newkirk Lowlands',
          polygon: [{x:500,y:800},{x:3300,y:650},{x:3900,y:2100},{x:2500,y:2550},{x:600,y:1900}],
          elevation: 35,
          terrainType: 'lowland'
        }
      ],
      changeLog: [{ id: 'change_seed', at: now, action: 'Created Green Line starter world' }]
    };
  }

  function validateWorld(world) {
    const issues = [];
    const add = (severity, code, message, objectType, objectId) => issues.push({ severity, code, message, objectType, objectId });

    if (!world || typeof world !== 'object') {
      add('error', 'WORLD_INVALID', 'The imported file is not a BoRail world.');
      return issues;
    }
    if (world.schemaVersion !== SCHEMA_VERSION) add('error', 'SCHEMA_VERSION', `Expected schema version ${SCHEMA_VERSION}.`);
    if (!world.settings || !Number.isFinite(world.settings.worldWidth) || !Number.isFinite(world.settings.worldHeight)) {
      add('error', 'WORLD_SETTINGS', 'World dimensions are missing or invalid.');
      return issues;
    }

    const collections = [
      ['line', world.lines], ['station', world.stations], ['segment', world.railSegments],
      ['land', world.landPolygons], ['water', world.waterPolygons], ['region', world.regions],
      ['label', world.labels], ['terrain', world.terrainZones]
    ];
    const allIds = new Set();
    collections.forEach(([type, items]) => {
      if (!Array.isArray(items)) {
        add('error', 'COLLECTION_MISSING', `${type} collection is missing.`);
        return;
      }
      items.forEach(item => {
        if (!item || !item.id) add('error', 'ID_MISSING', `${type} object is missing an ID.`, type);
        else if (allIds.has(item.id)) add('error', 'DUPLICATE_ID', `Duplicate ID: ${item.id}`, type, item.id);
        else allIds.add(item.id);
      });
    });

    const lineIds = new Set((world.lines || []).map(line => line.id));
    const stationIds = new Set((world.stations || []).map(station => station.id));
    const stationSlugs = new Set();

    (world.stations || []).forEach(station => {
      if (!String(station.name || '').trim()) add('error', 'STATION_NAME', 'Station has no name.', 'station', station.id);
      if (stationSlugs.has(station.slug)) add('error', 'DUPLICATE_SLUG', `Duplicate station slug: ${station.slug}`, 'station', station.id);
      stationSlugs.add(station.slug);
      if (!pointInBounds(station.position, world.settings)) add('error', 'STATION_BOUNDS', `${station.name || station.id} is outside the world.`, 'station', station.id);
      (station.lineIds || []).forEach(lineId => {
        if (!lineIds.has(lineId)) add('error', 'STATION_LINE_MISSING', `${station.name} references a missing line.`, 'station', station.id);
      });
    });

    (world.railSegments || []).forEach(segment => {
      if (!Array.isArray(segment.path) || segment.path.length < 2) add('error', 'SEGMENT_POINTS', 'Rail segment needs at least two points.', 'railSegment', segment.id);
      if (!Array.isArray(segment.lineIds) || !segment.lineIds.length) add('error', 'SEGMENT_LINE', 'Rail segment is not assigned to a line.', 'railSegment', segment.id);
      (segment.lineIds || []).forEach(lineId => {
        if (!lineIds.has(lineId)) add('error', 'SEGMENT_LINE_MISSING', 'Rail segment references a missing line.', 'railSegment', segment.id);
      });
      if (segment.fromStationId && !stationIds.has(segment.fromStationId)) add('error', 'FROM_STATION_MISSING', 'From station does not exist.', 'railSegment', segment.id);
      if (segment.toStationId && !stationIds.has(segment.toStationId)) add('error', 'TO_STATION_MISSING', 'To station does not exist.', 'railSegment', segment.id);
      (segment.path || []).forEach(point => {
        if (!pointInBounds(point, world.settings)) add('error', 'SEGMENT_BOUNDS', 'Rail segment extends outside the world.', 'railSegment', segment.id);
      });
    });

    (world.lines || []).forEach(line => {
      if (!(world.stations || []).some(station => (station.lineIds || []).includes(line.id))) add('warning', 'LINE_NO_STATIONS', `${line.name} has no stations.`, 'line', line.id);
      if (!(world.railSegments || []).some(segment => (segment.lineIds || []).includes(line.id))) add('warning', 'LINE_NO_SEGMENTS', `${line.name} has no rail segments.`, 'line', line.id);
    });

    [
      ['land', world.landPolygons], ['water', world.waterPolygons],
      ['region', world.regions], ['terrain', world.terrainZones]
    ].forEach(([type, items]) => (items || []).forEach(item => {
      if (!Array.isArray(item.polygon) || item.polygon.length < 3) add('error', 'POLYGON_POINTS', `${item.name || item.id} needs at least three points.`, type, item.id);
      (item.polygon || []).forEach(point => {
        if (!pointInBounds(point, world.settings)) add('error', 'POLYGON_BOUNDS', `${item.name || item.id} extends outside the world.`, type, item.id);
      });
    }));

    (world.labels || []).forEach(label => {
      if (!pointInBounds(label.position, world.settings)) add('error', 'LABEL_BOUNDS', `${label.text || label.id} is outside the world.`, 'label', label.id);
    });

    if (!issues.length) add('info', 'WORLD_VALID', 'No structural problems found. The Green Line world is ready to use.');
    return issues;
  }

  function getAllIds(world) {
    return new Set([
      ...(world.lines || []), ...(world.stations || []), ...(world.railSegments || []),
      ...(world.landPolygons || []), ...(world.waterPolygons || []), ...(world.regions || []),
      ...(world.labels || []), ...(world.terrainZones || [])
    ].map(item => item.id));
  }

  return {
    SCHEMA_VERSION,
    WORLD_WIDTH,
    WORLD_HEIGHT,
    deepClone,
    slugify,
    makeId,
    pointInBounds,
    worldToMapCoord,
    mapToWorldCoord,
    createSeedWorld,
    validateWorld,
    getAllIds
  };
});
