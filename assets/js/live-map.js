(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MAP_WIDTH = 1200;
  const MAP_HEIGHT = 1200;
  const MAX_ZOOM = 5;
  const REFRESH_INTERVAL_MS = 1000;
  const SERVICE_FILTERS = Object.freeze([
    { serviceId: 'A', isExpress: true },
    { serviceId: 'A', isExpress: false },
    { serviceId: 'B', isExpress: false },
    { serviceId: 'B', isExpress: true },
    { serviceId: 'C', isExpress: false },
    { serviceId: 'D', isExpress: false },
    { serviceId: 'E', isExpress: false },
    { serviceId: 'F', isExpress: false },
    { serviceId: 'F', isExpress: true },
    { serviceId: 'G', isExpress: false },
    { serviceId: 'S', isExpress: false },
    { serviceId: 'S', isExpress: true }
  ]);

  const view = document.getElementById('liveMapView');
  if (!view) return;

  const svg = document.getElementById('liveMapSvg');
  const geographyLayer = document.getElementById('liveMapGeography');
  const tracksLayer = document.getElementById('liveMapTracks');
  const selectionLayer = document.getElementById('liveMapSelection');
  const stationsLayer = document.getElementById('liveMapStations');
  const trainsLayer = document.getElementById('liveMapTrains');
  const filterToggle = document.getElementById('liveMapFilterToggle');
  const filtersPanel = document.getElementById('liveMapFilters');
  const filterCount = document.getElementById('liveMapFilterCount');
  const lineFilters = document.getElementById('liveMapLineFilters');
  const resetFilters = document.getElementById('liveMapResetFilters');
  const serviceState = document.getElementById('liveMapServiceState');
  const trainCount = document.getElementById('liveMapTrainCount');
  const clock = document.getElementById('liveMapClock');
  const followStatus = document.getElementById('liveMapFollowStatus');
  const followStatusContent = document.getElementById('liveMapFollowStatusContent');
  const stopFollowingButton = document.getElementById('liveMapStopFollowing');
  const emptyState = document.getElementById('liveMapEmpty');
  const details = document.getElementById('liveMapDetails');
  const detailsContent = document.getElementById('liveMapDetailsContent');
  const detailsClose = document.getElementById('liveMapDetailsClose');
  const zoomInButton = document.getElementById('liveMapZoomIn');
  const zoomOutButton = document.getElementById('liveMapZoomOut');
  const fitButton = document.getElementById('liveMapFit');
  const focusSelectionButton = document.getElementById('liveMapFocusSelection');
  const expandButton = document.getElementById('liveMapExpand');

  const STATION_COORDS = Object.freeze({
    'Newkirk': [234, 471],
    'Newkirk - Oak Street': [226, 544],
    'Hoganville': [209, 663],
    'Bayview Park': [209, 729],
    'Chelsea Bay': [209, 795],
    'Berwick Hall': [209, 861],
    'Westpoint': [203, 927],
    'Bradford Square': [161, 948],
    'Bradford Bay': [95, 948],
    'Cambridge Central': [209, 993],
    'Atkinson Junction': [209, 1059],
    'Garner': [209, 1125],
    'Kenilworth': [146, 1165],
    'La Vista': [287, 1092],
    'Brookfield Lawn': [353, 1092],
    'Boylston': [397, 1029],
    'Foxston': [439, 1095],
    'New Cottage': [471, 1155],
    'Whitebranch': [542, 1179],
    'Burlington - University of NCU': [307, 610],
    'Port Williamson': [497, 545],
    'Willow Springs': [394, 659],
    'Rockcastle': [394, 756],
    'Cannon View': [395, 858],
    'Ivory Knolls': [385, 939],
    'Djimar': [447, 962],
    'Vanderburg': [513, 962],
    'Ralston-Finch East': [548, 1032],
    'Atkins Bridge': [466, 880],
    'Radcliff Fields': [532, 880],
    'Oakville City Airport': [598, 873],
    'Veridia Nexus': [532, 819],
    'Oakville Exchange': [664, 872],
    'Oakville City Center': [730, 872],
    'Oakville Plaza': [796, 872],
    'Talmedge Hill': [835, 953],
    'Mount River': [835, 1019],
    'Perry Road': [630, 796],
    'Mount Hindsboro': [630, 730],
    'Wood-by-Hike': [699, 710],
    'New Salemview': [765, 710],
    'Millford Heights': [784, 643],
    'Roxbury Landing': [784, 577],
    'East Heights': [852, 543],
    'Leighton Castle': [862, 872],
    'Fort Meadow': [928, 872],
    'Yoakum': [958, 931],
    'Joplin': [958, 998],
    'Fernwood': [958, 1064],
    'Greens Corner': [630, 665],
    'Doverville': [630, 599],
    'Orchard Ridge': [630, 533],
    'Groveton': [561, 475],
    'Madisonboro': [429, 475],
    'Hutchinson Point': [495, 475],
    'Vanwood': [361, 415],
    'South Harrington': [361, 349],
    'Harrington City': [361, 283],
    'Carrollton': [363, 216],
    'Hadleigh': [428, 172],
    'Alpherst': [784, 462],
    'New Halifax': [784, 396],
    'Tyford Farms': [784, 330],
    'Scottsbury': [784, 264],
    'Ameryville': [852, 232],
    'Scottsdale': [918, 232],
    'Grant Park': [984, 232],
    'Cherrywood': [1009, 160],
    'Brandywine': [1009, 94],
    'Santa Mora': [1009, 28]
  });

  const EDGE_GEOMETRY = Object.freeze({
    [edgeKey('Hadleigh', 'Carrollton')]: { from: 'Hadleigh', via: [[363, 172]] },
    [edgeKey('Vanwood', 'Hutchinson Point')]: { from: 'Vanwood', via: [[361, 475]] },
    [edgeKey('Groveton', 'Orchard Ridge')]: { from: 'Groveton', via: [[630, 475]] },
    [edgeKey('Newkirk - Oak Street', 'Burlington - University of NCU')]: { from: 'Newkirk - Oak Street', via: [[226, 610]] },
    [edgeKey('Burlington - University of NCU', 'Willow Springs')]: { from: 'Burlington - University of NCU', via: [[394, 610]] },
    [edgeKey('Port Williamson', 'Willow Springs')]: { from: 'Port Williamson', via: [[394, 545]] },
    [edgeKey('Cannon View', 'Atkins Bridge')]: { from: 'Cannon View', via: [[395, 880]] },
    [edgeKey('Ivory Knolls', 'Djimar')]: { from: 'Ivory Knolls', via: [[385, 962]] },
    [edgeKey('Vanderburg', 'Ralston-Finch East')]: { from: 'Vanderburg', via: [[548, 962]] },
    [edgeKey('Newkirk - Oak Street', 'Hoganville')]: { from: 'Newkirk - Oak Street', via: [[209, 544]] },
    [edgeKey('Westpoint', 'Bradford Square')]: { from: 'Westpoint', via: [[203, 948]] },
    [edgeKey('Atkinson Junction', 'La Vista')]: { from: 'Atkinson Junction', via: [[209, 1092]] },
    [edgeKey('Brookfield Lawn', 'Boylston')]: { from: 'Brookfield Lawn', via: [[397, 1092]] },
    [edgeKey('Brookfield Lawn', 'Foxston')]: { from: 'Brookfield Lawn', via: [[420, 1092]] },
    [edgeKey('Foxston', 'New Cottage')]: { from: 'Foxston', via: [[471, 1095]] },
    [edgeKey('New Cottage', 'Whitebranch')]: { from: 'New Cottage', via: [[471, 1179]] },
    [edgeKey('Garner', 'Kenilworth')]: { from: 'Garner', via: [[209, 1165]] },
    [edgeKey('Scottsbury', 'Ameryville')]: { from: 'Scottsbury', via: [[784, 232]] },
    [edgeKey('Grant Park', 'Cherrywood')]: { from: 'Grant Park', via: [[1009, 232]] },
    [edgeKey('Alpherst', 'East Heights')]: { from: 'Alpherst', via: [[784, 543]] },
    [edgeKey('East Heights', 'Roxbury Landing')]: { from: 'East Heights', via: [[784, 543]] },
    [edgeKey('Millford Heights', 'New Salemview')]: { from: 'Millford Heights', via: [[784, 710]] },
    [edgeKey('Wood-by-Hike', 'Mount Hindsboro')]: { from: 'Wood-by-Hike', via: [[630, 710]] },
    [edgeKey('Perry Road', 'Oakville City Airport')]: { from: 'Perry Road', via: [[630, 872]] },
    [edgeKey('Perry Road', 'Oakville Exchange')]: { from: 'Perry Road', via: [[630, 872]] },
    [edgeKey('Veridia Nexus', 'Oakville City Airport')]: { from: 'Veridia Nexus', via: [[566, 819], [566, 857], [598, 857]] },
    [edgeKey('Oakville Plaza', 'Talmedge Hill')]: { from: 'Oakville Plaza', via: [[835, 872]] },
    [edgeKey('Fort Meadow', 'Yoakum')]: { from: 'Fort Meadow', via: [[958, 872]] }
  });

  // Centerlines extracted from the colored engineering guide. These remain data only;
  // the passenger-facing map continues to use the black-and-white track artwork.
  const SERVICE_EDGE_GEOMETRY = Object.freeze({
    [`A|${edgeKey('Cannon View', 'Atkins Bridge')}`]: { from: 'Cannon View', points: [[395, 858], [395, 881], [466, 881]] },
    [`A|${edgeKey('Atkins Bridge', 'Radcliff Fields')}`]: { from: 'Atkins Bridge', points: [[466, 881], [532, 881]] },
    [`A|${edgeKey('Radcliff Fields', 'Oakville City Airport')}`]: { from: 'Radcliff Fields', points: [[532, 881], [598, 881]] },
    [`A|${edgeKey('Oakville City Airport', 'Oakville Exchange')}`]: { from: 'Oakville City Airport', points: [[598, 881], [664, 881]] },
    [`A|${edgeKey('Oakville Exchange', 'Oakville Plaza')}`]: { from: 'Oakville Exchange', points: [[664, 881], [796, 881]] },
    [`A|${edgeKey('Oakville Plaza', 'Talmedge Hill')}`]: { from: 'Oakville Plaza', points: [[796, 881], [835, 881], [835, 953]] },
    [`A|${edgeKey('Talmedge Hill', 'Mount River')}`]: { from: 'Talmedge Hill', points: [[835, 953], [835, 1019]] },

    [`B|${edgeKey('Mount Hindsboro', 'Perry Road')}`]: { from: 'Mount Hindsboro', points: [[631, 730], [631, 796]] },
    [`C|${edgeKey('Mount Hindsboro', 'Perry Road')}`]: { from: 'Mount Hindsboro', points: [[631, 730], [631, 796]] },
    [`B|${edgeKey('Perry Road', 'Oakville Exchange')}`]: { from: 'Perry Road', points: [[631, 796], [631, 864], [664, 864]] },
    [`C|${edgeKey('Perry Road', 'Oakville Exchange')}`]: { from: 'Perry Road', points: [[631, 796], [631, 864], [664, 864]] },
    [`B|${edgeKey('Oakville Exchange', 'Oakville City Center')}`]: { from: 'Oakville Exchange', points: [[664, 864], [730, 864]] },
    [`C|${edgeKey('Oakville Exchange', 'Oakville City Center')}`]: { from: 'Oakville Exchange', points: [[664, 864], [730, 864]] },
    [`B|${edgeKey('Oakville City Center', 'Oakville Plaza')}`]: { from: 'Oakville City Center', points: [[730, 864], [796, 864]] },
    [`C|${edgeKey('Oakville City Center', 'Oakville Plaza')}`]: { from: 'Oakville City Center', points: [[730, 864], [796, 864]] },
    [`B|${edgeKey('Oakville Plaza', 'Leighton Castle')}`]: { from: 'Oakville Plaza', points: [[796, 864], [862, 864]] },
    [`C|${edgeKey('Oakville Plaza', 'Leighton Castle')}`]: { from: 'Oakville Plaza', points: [[796, 864], [862, 864]] },
    [`C|${edgeKey('Leighton Castle', 'Fort Meadow')}`]: { from: 'Leighton Castle', points: [[862, 864], [928, 864]] },
    [`C|${edgeKey('Fort Meadow', 'Yoakum')}`]: { from: 'Fort Meadow', points: [[928, 864], [958, 864], [958, 931]] },

    [`C|${edgeKey('Perry Road', 'Oakville City Airport')}`]: { from: 'Perry Road', points: [[631, 796], [631, 864], [598, 864]], guidedTrack: true },
    [`D|${edgeKey('Veridia Nexus', 'Oakville City Airport')}`]: { from: 'Veridia Nexus', points: [[532, 813], [558, 813], [566, 821], [566, 854], [575, 864], [598, 864]], guidedTrack: true }
  });

  const GUIDED_TRACK_GEOMETRY = Object.freeze({
    [`F|Southbound|${edgeKey('Newkirk', 'Newkirk - Oak Street')}`]: {
      from: 'Newkirk',
      points: [[214, 471], [215, 504], [211, 520], [208, 526], [208, 544]]
    },
    [`F|Northbound|${edgeKey('Newkirk', 'Newkirk - Oak Street')}`]: {
      from: 'Newkirk - Oak Street',
      points: [[246, 544], [246, 514], [251, 505], [253, 498], [254, 471]]
    },
    [`F|Southbound|${edgeKey('Newkirk - Oak Street', 'Hoganville')}`]: {
      from: 'Newkirk - Oak Street',
      points: [[208, 544], [208, 607], [210, 613], [210, 663]]
    },
    [`F|Northbound|${edgeKey('Newkirk - Oak Street', 'Hoganville')}`]: {
      from: 'Hoganville',
      points: [[213, 663], [213, 643], [215, 636], [232, 629], [243, 620], [246, 611], [246, 544]]
    }
  });

  const PHYSICAL_PATTERNS = Object.freeze({
    F: [
      ['Kenilworth', 'Garner', 'Atkinson Junction', 'Cambridge Central', 'Berwick Hall', 'Chelsea Bay', 'Bayview Park', 'Hoganville', 'Newkirk - Oak Street', 'Newkirk'],
      ['Boylston', 'Brookfield Lawn', 'La Vista', 'Atkinson Junction'],
      ['Whitebranch', 'New Cottage', 'Foxston', 'Brookfield Lawn']
    ],
    G: [['Bradford Bay', 'Bradford Square', 'Westpoint', 'Berwick Hall']],
    S: [
      ['Ralston-Finch East', 'Vanderburg', 'Djimar', 'Ivory Knolls', 'Cannon View', 'Rockcastle', 'Willow Springs', 'Burlington - University of NCU', 'Newkirk - Oak Street', 'Newkirk']
    ],
    A: [
      ['Newkirk', 'Newkirk - Oak Street', 'Burlington - University of NCU', 'Willow Springs', 'Rockcastle', 'Cannon View', 'Atkins Bridge', 'Radcliff Fields', 'Oakville City Airport', 'Oakville Exchange', 'Oakville Plaza', 'Talmedge Hill', 'Mount River'],
      ['Port Williamson', 'Willow Springs', 'Rockcastle', 'Cannon View', 'Atkins Bridge', 'Oakville City Airport']
    ],
    D: [['Veridia Nexus', 'Oakville City Airport']],
    C: [
      ['East Heights', 'Roxbury Landing', 'Millford Heights', 'New Salemview', 'Wood-by-Hike', 'Mount Hindsboro', 'Perry Road', 'Oakville City Airport'],
      ['Perry Road', 'Oakville Exchange', 'Oakville City Center', 'Oakville Plaza', 'Leighton Castle', 'Fort Meadow', 'Yoakum', 'Joplin', 'Fernwood']
    ],
    E: [
      ['Santa Mora', 'Brandywine', 'Cherrywood', 'Grant Park', 'Scottsdale', 'Ameryville', 'Scottsbury', 'Tyford Farms', 'New Halifax', 'Alpherst', 'Roxbury Landing', 'East Heights'],
      ['East Heights', 'Alpherst']
    ],
    B: [
      ['Leighton Castle', 'Oakville Plaza', 'Oakville City Center', 'Oakville Exchange', 'Perry Road', 'Mount Hindsboro', 'Greens Corner', 'Doverville', 'Orchard Ridge', 'Groveton', 'Hutchinson Point', 'Madisonboro', 'Vanwood', 'South Harrington', 'Harrington City'],
      ['Harrington City', 'Carrollton', 'Hadleigh']
    ]
  });

  const forceSingleTrack = new Set([
    edgeKey('Brookfield Lawn', 'Foxston'), edgeKey('Foxston', 'New Cottage'), edgeKey('New Cottage', 'Whitebranch'),
    edgeKey('Bradford Bay', 'Bradford Square'), edgeKey('Bradford Square', 'Westpoint'), edgeKey('Westpoint', 'Berwick Hall'),
    edgeKey('Veridia Nexus', 'Oakville City Airport'), edgeKey('Perry Road', 'Oakville City Airport'),
    edgeKey('Harrington City', 'Carrollton'), edgeKey('Carrollton', 'Hadleigh'),
    edgeKey('Alpherst', 'Roxbury Landing'), edgeKey('Roxbury Landing', 'East Heights'), edgeKey('East Heights', 'Alpherst')
  ]);

  const forceThreeTrack = new Set([
    edgeKey('Ralston-Finch East', 'Vanderburg'), edgeKey('Vanderburg', 'Djimar'),
    edgeKey('Djimar', 'Ivory Knolls'), edgeKey('Ivory Knolls', 'Cannon View')
  ]);

  const forceFourTrack = new Set([
    edgeKey('Cannon View', 'Rockcastle'), edgeKey('Rockcastle', 'Willow Springs'),
    edgeKey('Willow Springs', 'Burlington - University of NCU'), edgeKey('Burlington - University of NCU', 'Newkirk - Oak Street'),
    edgeKey('Newkirk - Oak Street', 'Newkirk')
  ]);

  const SHARED_BC_EDGES = new Set([
    edgeKey('Mount Hindsboro', 'Perry Road'),
    edgeKey('Perry Road', 'Oakville Exchange'),
    edgeKey('Oakville Exchange', 'Oakville City Center'),
    edgeKey('Oakville City Center', 'Oakville Plaza'),
    edgeKey('Oakville Plaza', 'Leighton Castle')
  ]);

  // These aliases correct the B route's physical station order without
  // inventing any geometry. Each replacement is sliced directly from the
  // corresponding BLocal/BExpress engineering guide polyline.
  const ENGINEERING_EDGE_ALIASES = Object.freeze({
    'Groveton|Hutchinson Point': ['Groveton', 'Madisonboro'],
    'Hutchinson Point|Madisonboro': ['Groveton', 'Madisonboro'],
    'Madisonboro|Vanwood': ['Hutchinson Point', 'Vanwood'],
    'Vanwood|Madisonboro': ['Vanwood', 'Hutchinson Point'],
    'Madisonboro|Hutchinson Point': ['Madisonboro', 'Groveton'],
    'Hutchinson Point|Groveton': ['Madisonboro', 'Groveton']
  });

  const serviceGraphs = buildServiceGraphs();
  const physicalEdges = buildPhysicalEdges();
  const trainElements = new Map();
  const activeSnapshots = new Map();
  const stationElements = new Map();
  const pointers = new Map();
  let cachedRunDateKey = '';
  let cachedRuns = [];
  let selected = null;
  let followingSelectedTrain = false;
  let lastRefresh = 0;
  let frameId = null;
  let dragStart = null;
  let pinchStart = null;
  let mapActive = !view.hidden;
  let viewBox = { x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT };

  function edgeKey(left, right) {
    return [left, right].sort().join('::');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function createSvgElement(tag, attributes = {}) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
    return element;
  }

  function buildServiceGraphs() {
    const graphs = {};
    Object.entries(PHYSICAL_PATTERNS).forEach(([serviceId, patterns]) => {
      const graph = new Map();
      const connect = (left, right) => {
        if (!graph.has(left)) graph.set(left, new Set());
        if (!graph.has(right)) graph.set(right, new Set());
        graph.get(left).add(right);
        graph.get(right).add(left);
      };
      patterns.forEach(pattern => {
        for (let index = 0; index < pattern.length - 1; index += 1) connect(pattern[index], pattern[index + 1]);
      });
      graphs[serviceId] = graph;
    });
    return graphs;
  }

  function trackCountForEdge(key, services) {
    if (forceSingleTrack.has(key) || services.every(serviceId => serviceId === 'D' || serviceId === 'G')) return 1;
    if (forceThreeTrack.has(key)) return 3;
    if (forceFourTrack.has(key)) return 4;
    return 2;
  }

  function buildPhysicalEdges() {
    const edges = new Map();
    Object.entries(PHYSICAL_PATTERNS).forEach(([serviceId, patterns]) => {
      patterns.forEach(pattern => {
        for (let index = 0; index < pattern.length - 1; index += 1) {
          const left = pattern[index];
          const right = pattern[index + 1];
          const key = edgeKey(left, right);
          if (!edges.has(key)) edges.set(key, { key, left, right, services: new Set() });
          edges.get(key).services.add(serviceId);
        }
      });
    });
    const sharedBC = edgeKey('Mount Hindsboro', 'Perry Road');
    if (edges.has(sharedBC)) {
      edges.get(sharedBC).services.add('B');
      edges.get(sharedBC).services.add('C');
    }
    const mappedEdges = [...edges.values()].map(edge => ({
      ...edge,
      services: [...edge.services],
      count: trackCountForEdge(edge.key, [...edge.services])
    }));
    const newkirkOakKey = edgeKey('Newkirk', 'Newkirk - Oak Street');
    return mappedEdges.flatMap(edge => {
      if (edge.key !== newkirkOakKey || !edge.services.includes('F')) return edge;
      return [
        { ...edge, services: edge.services.filter(serviceId => serviceId !== 'F'), count: 4, centerOffset: 0 },
        { ...edge, services: ['F'], count: 2, centerOffset: 0 }
      ];
    });
  }

  function findServicePath(serviceId, fromStation, toStation) {
    if (fromStation === toStation) return [fromStation];
    const graph = serviceGraphs[serviceId];
    if (!graph || !graph.has(fromStation) || !graph.has(toStation)) return [fromStation, toStation];
    const queue = [[fromStation]];
    const visited = new Set([fromStation]);
    while (queue.length) {
      const path = queue.shift();
      const current = path[path.length - 1];
      for (const neighbor of graph.get(current) || []) {
        if (visited.has(neighbor)) continue;
        const nextPath = [...path, neighbor];
        if (neighbor === toStation) return nextPath;
        visited.add(neighbor);
        queue.push(nextPath);
      }
    }
    return [fromStation, toStation];
  }

  function pointDistance(left, right) {
    return Math.hypot(right[0] - left[0], right[1] - left[1]);
  }

  function engineeringRailPoints(rawPoints, leftStation, rightStation) {
    const points = rawPoints.map(point => [Number(point[0]), Number(point[1])]);
    const leftCenter = STATION_COORDS[leftStation];
    const rightCenter = STATION_COORDS[rightStation];

    // The first conversion inserted station-center waypoints solely to divide
    // the SVG into timetable edges. They are not part of the supplied rails.
    if (points.length > 2 && leftCenter && pointDistance(points[0], leftCenter) < .75) points.shift();
    if (points.length > 2 && rightCenter && pointDistance(points.at(-1), rightCenter) < .75) points.pop();

    return points.filter((point, index) => !index || pointDistance(point, points[index - 1]) > .01);
  }

  function projectPointOntoPolyline(points, target) {
    let best = null;
    let distanceAlong = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
      const left = points[index];
      const right = points[index + 1];
      const dx = right[0] - left[0];
      const dy = right[1] - left[1];
      const lengthSquared = dx * dx + dy * dy;
      const length = Math.sqrt(lengthSquared);
      const ratio = lengthSquared
        ? Math.max(0, Math.min(1, ((target[0] - left[0]) * dx + (target[1] - left[1]) * dy) / lengthSquared))
        : 0;
      const point = [left[0] + dx * ratio, left[1] + dy * ratio];
      const distance = pointDistance(point, target);
      const candidate = { point, distance, distanceAlong: distanceAlong + length * ratio, segmentIndex: index };
      if (!best || candidate.distance < best.distance) best = candidate;
      distanceAlong += length;
    }
    return best;
  }

  function sliceEngineeringRail(points, leftStation, rightStation) {
    const leftProjection = projectPointOntoPolyline(points, STATION_COORDS[leftStation]);
    const rightProjection = projectPointOntoPolyline(points, STATION_COORDS[rightStation]);
    if (!leftProjection || !rightProjection) return points;
    if (leftProjection.distanceAlong > rightProjection.distanceAlong) {
      return sliceEngineeringRail([...points].reverse(), leftStation, rightStation);
    }

    const sliced = [leftProjection.point];
    for (let index = leftProjection.segmentIndex + 1; index <= rightProjection.segmentIndex; index += 1) {
      const point = points[index];
      if (point && pointDistance(sliced.at(-1), point) > .01) sliced.push(point);
    }
    if (pointDistance(sliced.at(-1), rightProjection.point) > .01) sliced.push(rightProjection.point);
    return sliced;
  }

  function engineeringPointsFor(serviceId, isExpress, leftStation, rightStation) {
    const key = edgeKey(leftStation, rightStation);
    const geometryService = serviceId === 'C' && SHARED_BC_EDGES.has(key) ? 'B' : serviceId;
    const geometryType = geometryService === 'B' && serviceId === 'C'
      ? 'local'
      : isExpress ? 'express' : 'local';
    const prefix = `${geometryService}-${geometryType}|`;
    let sourceLeft = leftStation;
    let sourceRight = rightStation;
    const alias = geometryService === 'B' ? ENGINEERING_EDGE_ALIASES[`${leftStation}|${rightStation}`] : null;
    if (alias) [sourceLeft, sourceRight] = alias;

    const rawPoints = window.BORAIL_ROUTE_GEOMETRY?.[`${prefix}${sourceLeft}|${sourceRight}`];
    if (!rawPoints?.length) return null;
    const railPoints = engineeringRailPoints(rawPoints, sourceLeft, sourceRight);
    return alias ? sliceEngineeringRail(railPoints, leftStation, rightStation) : railPoints;
  }

  function edgePoints(leftStation, rightStation, routeContext) {
    const key = edgeKey(leftStation, rightStation);
    const serviceId = routeContext?.serviceId;
    const engineeringPoints = engineeringPointsFor(serviceId, routeContext?.isExpress, leftStation, rightStation);

    if (engineeringPoints?.length > 1) {
      return engineeringPoints.map(([x, y], index) => ({
        station: index === 0 ? leftStation : index === engineeringPoints.length - 1 ? rightStation : null,
        x,
        y,
        edgeToNext: index < engineeringPoints.length - 1 ? key : null,
        guidedTrack: true
      }));
    }

    // A train is omitted instead of being placed on invented or legacy map
    // geometry. The twelve engineering SVG guides are the sole movement source.
    console.warn(`Missing engineering route geometry for ${serviceId}: ${leftStation} → ${rightStation}`);
    return [];
  }

  function roundedPathCorners(points, radius = 10) {
    if (points.length < 3) return points;
    const rounded = [points[0]];
    for (let index = 1; index < points.length - 1; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const next = points[index + 1];
      if (current.station) {
        rounded.push(current);
        continue;
      }
      const incomingLength = Math.hypot(current.x - previous.x, current.y - previous.y);
      const outgoingLength = Math.hypot(next.x - current.x, next.y - current.y);
      if (incomingLength < 1 || outgoingLength < 1) {
        rounded.push(current);
        continue;
      }
      const trim = Math.min(radius, incomingLength * 0.42, outgoingLength * 0.42);
      const before = {
        ...current,
        x: current.x + (previous.x - current.x) * trim / incomingLength,
        y: current.y + (previous.y - current.y) * trim / incomingLength
      };
      const after = {
        ...current,
        x: current.x + (next.x - current.x) * trim / outgoingLength,
        y: current.y + (next.y - current.y) * trim / outgoingLength
      };
      rounded.push(before);
      for (let step = 1; step <= 4; step += 1) {
        const t = step / 4;
        const inverse = 1 - t;
        rounded.push({
          ...current,
          x: inverse * inverse * before.x + 2 * inverse * t * current.x + t * t * after.x,
          y: inverse * inverse * before.y + 2 * inverse * t * current.y + t * t * after.y
        });
      }
    }
    rounded.push(points[points.length - 1]);
    return rounded;
  }

  function pointsForPath(path, routeContext = {}) {
    if (!path.length) return [];
    if (path.length === 1) {
      const point = STATION_COORDS[path[0]] || [MAP_WIDTH / 2, MAP_HEIGHT / 2];
      return [{ station: path[0], x: point[0], y: point[1], edgeToNext: null, guidedTrack: false }];
    }

    const points = [];
    for (let index = 0; index < path.length - 1; index += 1) {
      const leftStation = path[index];
      const rightStation = path[index + 1];
      const key = edgeKey(leftStation, rightStation);
      const segment = edgePoints(leftStation, rightStation, routeContext);

      if (!segment.length) return [];
      if (points.length) {
        points[points.length - 1].edgeToNext = key;
        points[points.length - 1].guidedTrack = segment[0].guidedTrack;
      }
      const duplicateJoin = points.length && Math.hypot(
        points.at(-1).x - segment[0].x,
        points.at(-1).y - segment[0].y
      ) < .01;
      points.push(...(duplicateJoin ? segment.slice(1) : segment));
    }
    return points;
  }

  function pointAlongPolyline(points, progress) {
    if (points.length < 2) return { ...points[0], angle: 0, edge: null };
    const segments = [];
    let total = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
      const left = points[index];
      const right = points[index + 1];
      const length = Math.hypot(right.x - left.x, right.y - left.y);
      segments.push({
        left,
        right,
        length,
        edge: left.edgeToNext || edgeKey(left.station, right.station),
        guidedTrack: Boolean(left.guidedTrack)
      });
      total += length;
    }
    let distance = Math.max(0, Math.min(1, progress)) * total;
    for (const segment of segments) {
      if (distance <= segment.length || segment === segments[segments.length - 1]) {
        const ratio = segment.length ? Math.min(1, distance / segment.length) : 0;
        return {
          x: segment.left.x + (segment.right.x - segment.left.x) * ratio,
          y: segment.left.y + (segment.right.y - segment.left.y) * ratio,
          angle: Math.atan2(segment.right.y - segment.left.y, segment.right.x - segment.left.x) * 180 / Math.PI,
          edge: segment.edge,
          guidedTrack: segment.guidedTrack
        };
      }
      distance -= segment.length;
    }
    return { ...points[points.length - 1], angle: 0, edge: null };
  }

  function laneOffsetFor(snapshot, edge) {
    const physical = physicalEdges.find(item => item.key === edge && item.services.includes(snapshot.serviceId));
    const count = physical?.count || 2;
    if (count === 1) return 0;
    if (count === 2) return 2.4;
    if (count === 3) return snapshot.isExpress ? 0 : 4.8;
    return snapshot.serviceId === 'S' ? 7.2 : 2.4;
  }

  function offsetPosition(position, snapshot) {
    if (position.guidedTrack) return position;
    const physical = physicalEdges.find(item => item.key === position.edge && item.services.includes(snapshot.serviceId));
    let amount = laneOffsetFor(snapshot, position.edge);
    if (physical?.centerOffset) {
      const left = STATION_COORDS[physical.left];
      const right = STATION_COORDS[physical.right];
      const storedAngle = Math.atan2(right[1] - left[1], right[0] - left[0]) * 180 / Math.PI;
      const movingWithStoredDirection = Math.cos((position.angle - storedAngle) * Math.PI / 180) >= 0;
      amount += movingWithStoredDirection ? physical.centerOffset : -physical.centerOffset;
    }
    const radians = position.angle * Math.PI / 180;
    return {
      ...position,
      x: position.x - Math.sin(radians) * amount,
      y: position.y + Math.cos(radians) * amount
    };
  }

  function renderGeography() {
    geographyLayer.innerHTML = `
      <rect class="live-map-background" x="0" y="0" width="${MAP_WIDTH}" height="${MAP_HEIGHT}"></rect>
      <image class="live-map-track-layout" href="assets/maps/borail-live-track-layout.svg" x="0" y="0" width="${MAP_WIDTH}" height="${MAP_HEIGHT}" preserveAspectRatio="xMidYMid meet"></image>
    `;
  }

  function renderTracks() {
    tracksLayer.innerHTML = '';
  }

  function stationAriaLabel(stationName) {
    const lines = new Set();
    ROUTES.forEach(route => {
      if (route.stops.includes(stationName)) lines.add(`${route.serviceId} ${route.isExpress ? 'express' : 'local'}`);
    });
    return `${stationName} station. ${[...lines].join(', ') || 'No active line information'}. Select for next trains.`;
  }

  function renderStations() {
    stationsLayer.innerHTML = '';
    [...STATIONS].sort((left, right) => left.name.localeCompare(right.name)).forEach(station => {
      const point = STATION_COORDS[station.id];
      if (!point) return;
      const group = createSvgElement('g', {
        class: 'live-map-station',
        'data-station-id': station.id,
        tabindex: '0',
        role: 'button',
        'aria-label': stationAriaLabel(station.id)
      });
      group.appendChild(createSvgElement('circle', { class: 'live-map-station-hit', cx: point[0], cy: point[1], r: 18 }));
      group.appendChild(createSvgElement('circle', { class: 'live-map-station-dot', cx: point[0], cy: point[1], r: 6 }));
      if (ACCESSIBLE_STATIONS.has(station.id)) {
        group.appendChild(createSvgElement('image', {
          class: 'live-map-accessibility-icon',
          href: ACCESSIBLE_ICON_URL,
          x: point[0] + 4,
          y: point[1] + 3,
          width: 12,
          height: 12
        }));
      }
      stationsLayer.appendChild(group);
      stationElements.set(station.id, group);
    });
  }

  function initializeLineFilters() {
    lineFilters.innerHTML = SERVICE_FILTERS.map(({ serviceId, isExpress }) => {
      const label = serviceLabel(serviceId, isExpress);
      const value = `${serviceId}-${isExpress ? 'express' : 'local'}`;
      return `
      <label class="live-map-line-filter" title="${escapeHtml(label)}">
        <input type="checkbox" name="liveMapService" value="${value}" checked aria-label="Show ${escapeHtml(label)} trains">
        <img src="${iconFor(serviceId, isExpress)}" alt="">
      </label>
    `;
    }).join('');
  }

  function getRunsForDate(date) {
    const dateKey = BORAIL_CLOCK.dateKey(date);
    if (dateKey !== cachedRunDateKey) {
      cachedRunDateKey = dateKey;
      cachedRuns = buildScheduledRuns(date, true);
    }
    return cachedRuns;
  }

  function consistForRun(run) {
    const consist = getTrainConsist(run.trainSeed, run.serviceId, run.isExpress);
    if (SINGLE_TRAIN_SHUTTLES.has(run.serviceId)) {
      consist.model = 'MTC-T 110';
      consist.cars = 2;
      const fixed = FIXED_SHUTTLE_LEAD_CARS[run.serviceId]?.[run.destination];
      if (typeof fixed === 'number') consist.leadCar = fixed;
    }
    return consist;
  }

  function snapshotForRun(run, nowSeconds) {
    const stops = run.stops;
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (nowSeconds < first.actualArrivalSec || nowSeconds >= last.actualDepartureSec) return null;
    const direction = getTrainDirection(run.serviceId, run.destination);
    const consist = consistForRun(run);
    let position;
    let status = 'At station';
    let currentStation = first.name;
    let nextStation = stops[1]?.name || first.name;
    let previousStation = null;
    let nextArrivalSec = stops[1]?.actualArrivalSec ?? first.actualArrivalSec;
    let scheduledNextArrivalSec = stops[1]?.scheduledArrivalSec ?? first.scheduledArrivalSec;
    let currentDelayed = first.isDelayed;
    let delaySeconds = first.delaySeconds;
    let routeProgress = 0;
    let currentStopIndex = 0;

    for (let index = 0; index < stops.length; index += 1) {
      const stop = stops[index];
      if (nowSeconds >= stop.actualArrivalSec && nowSeconds < stop.actualDepartureSec) {
        const nextStop = stops[index + 1];
        const previousStop = stops[index - 1];
        const adjacent = nextStop || previousStop || stop;
        const path = pointsForPath(findServicePath(
          run.serviceId,
          nextStop ? stop.name : adjacent.name,
          nextStop ? adjacent.name : stop.name
        ), {
          serviceId: run.serviceId,
          direction,
          isExpress: run.isExpress
        });
        if (!path.length) return null;
        const endpoint = pointAlongPolyline(path, nextStop ? 0 : 1);
        position = offsetPosition(endpoint, { direction, isExpress: run.isExpress, serviceId: run.serviceId });
        status = `At ${stop.name}`;
        currentStation = stop.name;
        previousStation = stops[index - 1]?.name || null;
        nextStation = stops[index + 1]?.name || stop.name;
        nextArrivalSec = stops[index + 1]?.actualArrivalSec ?? stop.actualArrivalSec;
        scheduledNextArrivalSec = stops[index + 1]?.scheduledArrivalSec ?? stop.scheduledArrivalSec;
        currentDelayed = stop.isDelayed;
        delaySeconds = stop.delaySeconds;
        routeProgress = stops.length > 1 ? index / (stops.length - 1) : 1;
        currentStopIndex = index;
        break;
      }
      if (index < stops.length - 1) {
        const next = stops[index + 1];
        if (nowSeconds >= stop.actualDepartureSec && nowSeconds < next.actualArrivalSec) {
          const segmentDuration = Math.max(1, next.actualArrivalSec - stop.actualDepartureSec);
          const segmentProgress = (nowSeconds - stop.actualDepartureSec) / segmentDuration;
          const path = pointsForPath(findServicePath(run.serviceId, stop.name, next.name), {
            serviceId: run.serviceId,
            direction,
            isExpress: run.isExpress
          });
          if (!path.length) return null;
          position = offsetPosition(pointAlongPolyline(path, segmentProgress), {
            direction,
            isExpress: run.isExpress,
            serviceId: run.serviceId
          });
          status = `En route: ${stop.name} → ${next.name}`;
          previousStation = stop.name;
          currentStation = null;
          nextStation = next.name;
          nextArrivalSec = next.actualArrivalSec;
          scheduledNextArrivalSec = next.scheduledArrivalSec;
          currentDelayed = next.isDelayed;
          delaySeconds = next.delaySeconds;
          routeProgress = (index + segmentProgress) / (stops.length - 1);
          currentStopIndex = index;
          break;
        }
      }
    }

    if (!position) return null;
    return {
      id: run.id,
      run,
      ...position,
      direction,
      consist,
      status,
      currentStation,
      previousStation,
      nextStation,
      nextArrivalSec,
      scheduledNextArrivalSec,
      currentDelayed,
      delaySeconds,
      routeProgress,
      currentStopIndex,
      stopsRemaining: Math.max(0, stops.length - currentStopIndex - 1),
      serviceId: run.serviceId,
      isExpress: run.isExpress
    };
  }

  function getActiveTrainSnapshots(date = BORAIL_CLOCK.now()) {
    const nowSeconds = BORAIL_CLOCK.clockSeconds(date);
    return getRunsForDate(date).map(run => snapshotForRun(run, nowSeconds)).filter(Boolean);
  }

  function selectedFilterValues(name) {
    return new Set([...document.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value));
  }

  function snapshotMatchesFilters(snapshot) {
    const serviceTypes = selectedFilterValues('liveMapServiceType');
    const statuses = selectedFilterValues('liveMapRunningStatus');
    const services = selectedFilterValues('liveMapService');
    const type = snapshot.isExpress ? 'express' : 'local';
    const runningStatus = snapshot.currentDelayed ? 'delayed' : 'on-time';
    return serviceTypes.has(type) && statuses.has(runningStatus) && services.has(`${snapshot.serviceId}-${type}`);
  }

  function createTrainElement(snapshot) {
    const serviceColor = SERVICE_META[snapshot.serviceId]?.color || '#ffffff';
    const group = createSvgElement('g', {
      class: `live-map-train ${snapshot.isExpress ? 'express' : 'local'}${snapshot.currentDelayed ? ' delayed' : ''}`,
      'data-train-id': snapshot.id,
      tabindex: '0',
      role: 'button'
    });
    const frontCenter = ((snapshot.consist.cars - 1) * 7) / 2;
    const consistHalfWidth = frontCenter + 4;
    const consistGroup = createSvgElement('g', { class: 'live-map-train-consist' });
    consistGroup.appendChild(createSvgElement('ellipse', {
      class: 'train-selection-ring', cx: 0, cy: 0, rx: consistHalfWidth + 4.5, ry: 9.5
    }));
    for (let index = 0; index < snapshot.consist.cars; index += 1) {
      const carCenter = frontCenter - index * 7;
      consistGroup.appendChild(createSvgElement('rect', {
        class: `live-map-train-car${index === 0 ? ' live-map-train-front' : ''}`,
        x: carCenter - 3,
        y: -3.2,
        width: 6,
        height: 6.4,
        rx: 1.4,
        fill: serviceColor
      }));
    }
    consistGroup.appendChild(createSvgElement('polygon', {
      class: 'live-map-direction-arrow',
      points: `${frontCenter + 5},-3.4 ${frontCenter + 11},0 ${frontCenter + 5},3.4`,
      fill: serviceColor
    }));
    group.appendChild(consistGroup);
    group.appendChild(createSvgElement('image', {
      class: 'live-map-train-icon',
      href: iconFor(snapshot.serviceId, snapshot.isExpress),
      x: -8,
      y: -23,
      width: 16,
      height: 16
    }));
    group.appendChild(createSvgElement('circle', {
      class: 'live-map-delay-dot', cx: consistHalfWidth + 5, cy: -8, r: snapshot.currentDelayed ? 3.2 : 0
    }));
    group.appendChild(createSvgElement('title'));
    trainsLayer.appendChild(group);
    trainElements.set(snapshot.id, group);
    return group;
  }

  function updateTrainElement(element, snapshot) {
    element.setAttribute('transform', `translate(${snapshot.x.toFixed(2)} ${snapshot.y.toFixed(2)})`);
    element.querySelector('.live-map-train-consist')?.setAttribute('transform', `rotate(${snapshot.angle.toFixed(2)})`);
    element.classList.toggle('delayed', snapshot.currentDelayed);
    element.classList.toggle('selected', selected?.type === 'train' && selected.id === snapshot.id);
    element.querySelector('.live-map-delay-dot')?.setAttribute('r', snapshot.currentDelayed ? '3.2' : '0');
    const label = `${snapshot.serviceId} ${snapshot.isExpress ? 'express' : 'local'} train to ${snapshot.run.destination}. ${snapshot.consist.cars} cars. ${snapshot.status}. ${snapshot.currentDelayed ? `Delayed ${Math.round(snapshot.delaySeconds / 60)} minutes.` : 'On time.'}`;
    element.setAttribute('aria-label', label);
    const title = element.querySelector('title');
    if (title) title.textContent = label;
  }

  function refreshTrains(date = BORAIL_CLOCK.now(), force = false) {
    if (!mapActive && !force) return;
    const snapshots = getActiveTrainSnapshots(date);
    activeSnapshots.clear();
    snapshots.forEach(snapshot => activeSnapshots.set(snapshot.id, snapshot));
    const visible = snapshots.filter(snapshotMatchesFilters);
    const visibleIds = new Set(visible.map(snapshot => snapshot.id));

    [...trainElements.entries()].forEach(([id, element]) => {
      if (!visibleIds.has(id)) {
        element.remove();
        trainElements.delete(id);
      }
    });
    visible.forEach(snapshot => {
      const element = trainElements.get(snapshot.id) || createTrainElement(snapshot);
      updateTrainElement(element, snapshot);
    });

    trainCount.textContent = visible.length === snapshots.length
      ? `${snapshots.length} active train${snapshots.length === 1 ? '' : 's'}`
      : `${visible.length} of ${snapshots.length} active trains`;
    emptyState.hidden = visible.length !== 0;
    updateClockAndService(date);
    updateFilterSummary();

    if (selected?.type === 'train') {
      const snapshot = activeSnapshots.get(selected.id);
      if (!snapshot || !snapshotMatchesFilters(snapshot)) {
        closeDetails();
      } else if (followingSelectedTrain) {
        renderRouteFocus(snapshot);
        updateFollowStatus(snapshot);
        centerOn(snapshot.x, snapshot.y, Math.max(2.2, currentZoom()));
      } else {
        renderRouteFocus(snapshot);
        renderTrainDetails(snapshot);
      }
    } else if (selected?.type === 'station') {
      renderStationDetails(selected.id, date);
    }
  }

  function updateClockAndService(date) {
    const parts = BORAIL_CLOCK.parts(date);
    clock.textContent = `New York ${formatTime24Full(BORAIL_CLOCK.clockSeconds(date))} ${parts.zoneName}`;
    const mode = timeMode(date);
    serviceState.textContent = mode === 'rushAM' ? 'AM Rush service'
      : mode === 'rushPM' ? 'PM Rush service'
      : mode === 'overnight' ? 'Overnight service'
      : 'Regular service';
  }

  function updateFilterSummary() {
    const totalInputs = document.querySelectorAll('#liveMapFilters input[type="checkbox"]').length;
    const checkedInputs = document.querySelectorAll('#liveMapFilters input[type="checkbox"]:checked').length;
    filterCount.textContent = checkedInputs === totalInputs ? 'All trains' : `${checkedInputs}/${totalInputs} options`;
  }

  function formatMapTime(totalSeconds) {
    return formatTime24Full(totalSeconds).slice(0, 5);
  }

  function trainStatusBanner(snapshot) {
    if (snapshot.currentDelayed) {
      return `<div class="live-map-status-banner delayed">Delayed ${Math.round(snapshot.delaySeconds / 60)} minute${snapshot.delaySeconds === 60 ? '' : 's'} · adjusted position shown</div>`;
    }
    return '<div class="live-map-status-banner">On time · schedule-based live position</div>';
  }

  function renderTrainDetails(snapshot) {
    const run = snapshot.run;
    const nextScheduled = formatMapTime(snapshot.scheduledNextArrivalSec);
    const nextActual = formatMapTime(snapshot.nextArrivalSec);
    followStatus.hidden = true;
    detailsContent.innerHTML = `
      <div class="live-map-detail-kicker">Active train</div>
      <h3 class="live-map-train-title">
        <img src="${iconFor(run.serviceId, run.isExpress)}" alt="${escapeHtml(serviceLabel(run.serviceId, run.isExpress))}">
        <span>to ${escapeHtml(run.destination)}</span>
      </h3>
      <div class="live-map-detail-subtitle">${escapeHtml(snapshot.status)}</div>
      ${trainStatusBanner(snapshot)}
      <div class="live-map-progress"><i style="width:${Math.round(snapshot.routeProgress * 100)}%"></i></div>
      <div class="live-map-detail-grid">
        <div class="live-map-detail-cell"><span>Origin</span><strong>${escapeHtml(run.origin)}</strong></div>
        <div class="live-map-detail-cell"><span>Destination</span><strong>${escapeHtml(run.destination)}</strong></div>
        <div class="live-map-detail-cell"><span>Next station</span><strong>${escapeHtml(snapshot.nextStation)}</strong></div>
        <div class="live-map-detail-cell"><span>Next arrival</span><strong>${snapshot.currentDelayed && nextActual !== nextScheduled ? `<s>${nextScheduled}</s> ${nextActual}` : nextActual}</strong></div>
        <div class="live-map-detail-cell"><span>Direction</span><strong>${escapeHtml(snapshot.direction)}</strong></div>
        <div class="live-map-detail-cell"><span>Stops remaining</span><strong>${snapshot.stopsRemaining}</strong></div>
        <div class="live-map-detail-cell"><span>Train model</span><strong>${escapeHtml(snapshot.consist.model)}</strong></div>
        <div class="live-map-detail-cell"><span>Consist</span><strong>${snapshot.consist.cars} cars</strong></div>
        <div class="live-map-detail-cell"><span>Lead car</span><strong>${snapshot.consist.leadCar}</strong></div>
        <div class="live-map-detail-cell"><span>Service</span><strong>${run.isExpress ? 'Express' : 'Local'}</strong></div>
      </div>
      <button type="button" class="live-map-reset-filters" id="liveMapFollowTrain" style="width:100%;margin-top:11px;">
        Follow this train
      </button>
    `;
    details.hidden = false;
    focusSelectionButton.disabled = false;
    document.getElementById('liveMapFollowTrain')?.addEventListener('click', () => startFollowing(snapshot));
  }

  function updateFollowStatus(snapshot) {
    followStatusContent.innerHTML = `
      <img src="${iconFor(snapshot.serviceId, snapshot.isExpress)}" alt="">
      <span>Following train to ${escapeHtml(snapshot.run.destination)}</span>
    `;
    followStatus.hidden = false;
  }

  function liveMapStationLabel(stationName) {
    return stationName === 'Oakville City Airport'
      ? 'Wychwood Oakville City Airport'
      : stationName;
  }

  function routePointsForRun(run) {
    const direction = getTrainDirection(run.serviceId, run.destination);
    const result = [];
    const stopPoints = new Map();
    for (let index = 0; index < run.stops.length - 1; index += 1) {
      const left = run.stops[index].name;
      const right = run.stops[index + 1].name;
      const stationPath = findServicePath(run.serviceId, left, right);
      const points = pointsForPath(stationPath, {
        serviceId: run.serviceId,
        direction,
        isExpress: run.isExpress
      });
      if (points.length < 2) continue;
      if (!index) stopPoints.set(left, points[0]);
      stopPoints.set(right, points.at(-1));
      const duplicateJoin = result.length && Math.hypot(
        result.at(-1).x - points[0].x,
        result.at(-1).y - points[0].y
      ) < .01;
      result.push(...(duplicateJoin ? points.slice(1) : points));
    }
    return { points: result, stopPoints };
  }

  function clearRouteFocus() {
    svg.classList.remove('route-focus-active');
    selectionLayer.innerHTML = '';
    delete selectionLayer.dataset.selectedTrainId;
    stationElements.forEach(element => element.classList.remove('selected-route-stop', 'route-origin', 'route-destination'));
  }

  function renderRouteFocus(snapshot) {
    const run = snapshot.run;
    const { points, stopPoints } = routePointsForRun(run);
    if (points.length < 2) {
      clearRouteFocus();
      return;
    }

    svg.classList.add('route-focus-active');
    stationElements.forEach(element => element.classList.remove('selected-route-stop', 'route-origin', 'route-destination'));
    selectionLayer.innerHTML = '';
    selectionLayer.dataset.selectedTrainId = snapshot.id;

    const route = createSvgElement('path', {
      class: 'live-map-selected-route',
      d: points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '),
      stroke: SERVICE_META[run.serviceId]?.color || '#ffffff'
    });
    selectionLayer.appendChild(route);

    run.stops.forEach((stop, index) => {
      const railPoint = stopPoints.get(stop.name);
      const point = railPoint ? [railPoint.x, railPoint.y] : STATION_COORDS[stop.name];
      if (!point) return;
      const isOrigin = index === 0;
      const isDestination = index === run.stops.length - 1;
      const stationElement = stationElements.get(stop.name);
      stationElement?.classList.add('selected-route-stop');
      if (isOrigin) stationElement?.classList.add('route-origin');
      if (isDestination) stationElement?.classList.add('route-destination');

      const marker = createSvgElement('g', {
        class: `live-map-route-stop${isOrigin ? ' origin' : ''}${isDestination ? ' destination' : ''}`,
        'data-route-stop': stop.name
      });
      marker.appendChild(createSvgElement('circle', {
        cx: point[0],
        cy: point[1],
        r: isOrigin || isDestination ? 7 : 4.5
      }));
      const previousPoint = STATION_COORDS[run.stops[Math.max(0, index - 1)].name] || point;
      const nextPoint = STATION_COORDS[run.stops[Math.min(run.stops.length - 1, index + 1)].name] || point;
      const horizontal = Math.abs(nextPoint[0] - previousPoint[0]) >= Math.abs(nextPoint[1] - previousPoint[1]);
      const side = index % 2 ? 1 : -1;
      const labelX = horizontal ? point[0] : point[0] + side * 10;
      const labelY = horizontal ? point[1] + side * 11 : point[1] - 3;
      const textAnchor = horizontal ? 'middle' : side < 0 ? 'end' : 'start';
      const label = createSvgElement('text', {
        x: labelX,
        y: labelY,
        'text-anchor': textAnchor,
        class: 'live-map-route-stop-label'
      });
      label.textContent = liveMapStationLabel(stop.name);
      marker.appendChild(label);
      if (isOrigin || isDestination) {
        const endpointLabel = createSvgElement('text', {
          x: labelX,
          y: horizontal ? labelY + side * 8 : labelY + 8,
          'text-anchor': textAnchor,
          class: 'live-map-route-endpoint-label'
        });
        endpointLabel.textContent = isOrigin ? 'ORIGIN' : 'DESTINATION';
        marker.appendChild(endpointLabel);
      }
      selectionLayer.appendChild(marker);
    });
  }

  function startFollowing(snapshot) {
    followingSelectedTrain = true;
    details.hidden = true;
    renderRouteFocus(snapshot);
    updateFollowStatus(snapshot);
    focusSelectionButton.setAttribute('aria-label', 'Return to followed train');
    focusSelectionButton.title = 'Return to followed train';
    centerOn(snapshot.x, snapshot.y, Math.max(2.2, currentZoom()));
  }

  function stopFollowing() {
    closeDetails();
  }

  function stationLines(stationId) {
    const lines = new Map();
    ROUTES.forEach(route => {
      if (!route.stops.includes(stationId)) return;
      if (!lines.has(route.serviceId)) lines.set(route.serviceId, { local: false, express: false });
      lines.get(route.serviceId)[route.isExpress ? 'express' : 'local'] = true;
    });
    return lines;
  }

  function arrivalRowsForStation(stationId, date = BORAIL_CLOCK.now()) {
    const nowSeconds = BORAIL_CLOCK.clockSeconds(date);
    const horizonSeconds = 6 * 60 * 60;
    return getRunsForDate(date).map(run => {
      const stationIndex = run.stops.findIndex(stop => stop.name === stationId);
      if (stationIndex < 0 || stationIndex === run.stops.length - 1) return null;
      const stationStop = run.stops[stationIndex];
      const secondsAway = stationStop.actualArrivalSec - nowSeconds;
      if (secondsAway < -60 || secondsAway > horizonSeconds) return null;
      return {
        serviceId: run.serviceId,
        isExpress: run.isExpress,
        destination: run.destination,
        runId: run.id,
        actualArrivalSec: stationStop.actualArrivalSec,
        scheduledArrivalSec: stationStop.scheduledArrivalSec,
        isDelayed: stationStop.isDelayed,
        delaySeconds: stationStop.delaySeconds,
        actualMinsAway: secondsAway / 60
      };
    }).filter(row => row && row.actualMinsAway >= -1).sort((left, right) => left.actualArrivalSec - right.actualArrivalSec).slice(0, 5);
  }

  function renderStationDetails(stationId, date = BORAIL_CLOCK.now()) {
    const rows = arrivalRowsForStation(stationId, date);
    const accessible = ACCESSIBLE_STATIONS.has(stationId);
    const lines = stationLines(stationId);
    const hasRushExpress = [...lines.values()].some(types => types.express);
    const badges = [...lines.entries()].map(([serviceId, types]) => {
      const local = types.local ? lineBadgeHtml(serviceId, false) : '';
      const express = types.express ? lineBadgeHtml(serviceId, true) : '';
      return local + express;
    }).join('');
    const arrivalsHtml = rows.length ? rows.map(row => {
      const scheduled = formatMapTime(row.scheduledArrivalSec);
      const actual = formatMapTime(row.actualArrivalSec);
      const minutes = row.actualMinsAway <= .5 ? 'Now' : `${Math.max(1, Math.round(row.actualMinsAway))} min`;
      return `<button type="button" class="live-map-arrival" data-train-id="${escapeHtml(row.runId)}">
        ${lineBadgeHtml(row.serviceId, row.isExpress)}
        <span class="live-map-arrival-copy"><strong>to ${escapeHtml(row.destination)}</strong><span>${escapeHtml(getTrainDirection(row.serviceId, row.destination))} · ${row.isExpress ? 'Express' : 'Local'}${row.isDelayed ? ` · Delayed ${Math.round(row.delaySeconds / 60)}m` : ' · On time'}</span></span>
        <span class="live-map-arrival-time${row.isDelayed ? ' delayed' : ''}">${row.isDelayed && actual !== scheduled ? `<s>${scheduled}</s><br>${actual}` : `${actual}<br>${minutes}`}</span>
      </button>`;
    }).join('') : '<div class="subtle">No upcoming trains in the current timetable window.</div>';
    detailsContent.innerHTML = `
      <div class="live-map-detail-kicker">Station</div>
      <h3>${escapeHtml(stationId)}</h3>
      <div class="live-map-detail-subtitle">${accessible ? 'Accessible station' : 'BORail station'}${hasRushExpress ? ' · Rush-hour express service' : ''} · Select an active arrival to locate its train</div>
      <div class="live-map-detail-badges">${badges || '<span class="subtle">No scheduled service badges</span>'}</div>
      <h4 class="live-map-next-title">Next five trains</h4>
      <div class="live-map-arrivals">${arrivalsHtml}</div>
    `;
    details.hidden = false;
    focusSelectionButton.disabled = false;
    detailsContent.querySelectorAll('[data-train-id]').forEach(button => {
      button.addEventListener('click', () => {
        const snapshot = activeSnapshots.get(button.dataset.trainId);
        if (snapshot) selectTrain(snapshot.id, true);
      });
    });
  }

  function clearSelections() {
    stationElements.forEach(element => element.classList.remove('selected'));
    trainElements.forEach(element => element.classList.remove('selected'));
  }

  function selectStation(stationId, focus = false) {
    if (!STATION_COORDS[stationId]) return;
    clearSelections();
    clearRouteFocus();
    selected = { type: 'station', id: stationId };
    followingSelectedTrain = false;
    followStatus.hidden = true;
    stationElements.get(stationId)?.classList.add('selected');
    focusSelectionButton.setAttribute('aria-label', 'Return to selected station');
    focusSelectionButton.title = 'Return to selected station';
    renderStationDetails(stationId, BORAIL_CLOCK.now());
    if (focus) centerOn(STATION_COORDS[stationId][0], STATION_COORDS[stationId][1], Math.max(2.1, currentZoom()));
  }

  function selectTrain(trainId, focus = false) {
    const snapshot = activeSnapshots.get(trainId);
    if (!snapshot) return;
    clearSelections();
    selected = { type: 'train', id: trainId };
    followingSelectedTrain = false;
    followStatus.hidden = true;
    trainElements.get(trainId)?.classList.add('selected');
    renderRouteFocus(snapshot);
    focusSelectionButton.setAttribute('aria-label', 'Follow selected train');
    focusSelectionButton.title = 'Follow selected train';
    renderTrainDetails(snapshot);
    if (focus) centerOn(snapshot.x, snapshot.y, Math.max(2.25, currentZoom()));
  }

  function closeDetails() {
    selected = null;
    followingSelectedTrain = false;
    followStatus.hidden = true;
    clearSelections();
    clearRouteFocus();
    details.hidden = true;
    detailsContent.innerHTML = '';
    focusSelectionButton.disabled = true;
    focusSelectionButton.setAttribute('aria-label', 'Return to selected train or station');
    focusSelectionButton.title = 'Return to selection';
  }

  function currentZoom() {
    return MAP_WIDTH / viewBox.width;
  }

  function clampViewBox() {
    viewBox.width = Math.min(MAP_WIDTH, Math.max(MAP_WIDTH / MAX_ZOOM, viewBox.width));
    viewBox.height = viewBox.width * MAP_HEIGHT / MAP_WIDTH;
    viewBox.x = Math.max(0, Math.min(MAP_WIDTH - viewBox.width, viewBox.x));
    viewBox.y = Math.max(0, Math.min(MAP_HEIGHT - viewBox.height, viewBox.y));
  }

  function applyViewBox() {
    clampViewBox();
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    const zoom = currentZoom();
    svg.dataset.zoomLevel = zoom > 2.2 ? 'close' : zoom > 1.35 ? 'medium' : 'wide';
  }

  function clientToMap(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    return {
      x: viewBox.x + (clientX - rect.left) / rect.width * viewBox.width,
      y: viewBox.y + (clientY - rect.top) / rect.height * viewBox.height
    };
  }

  function zoomAt(factor, clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    const point = clientToMap(clientX ?? rect.left + rect.width / 2, clientY ?? rect.top + rect.height / 2);
    const nextWidth = Math.min(MAP_WIDTH, Math.max(MAP_WIDTH / MAX_ZOOM, viewBox.width / factor));
    const nextHeight = nextWidth * MAP_HEIGHT / MAP_WIDTH;
    const ratioX = rect.width ? ((clientX ?? rect.left + rect.width / 2) - rect.left) / rect.width : .5;
    const ratioY = rect.height ? ((clientY ?? rect.top + rect.height / 2) - rect.top) / rect.height : .5;
    viewBox = { x: point.x - nextWidth * ratioX, y: point.y - nextHeight * ratioY, width: nextWidth, height: nextHeight };
    applyViewBox();
  }

  function centerOn(x, y, zoom = 2.4) {
    const width = MAP_WIDTH / Math.min(MAX_ZOOM, Math.max(1, zoom));
    const height = width * MAP_HEIGHT / MAP_WIDTH;
    viewBox = { x: x - width / 2, y: y - height / 2, width, height };
    applyViewBox();
  }

  function fitMap() {
    viewBox = { x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT };
    applyViewBox();
  }

  function focusSelection() {
    if (selected?.type === 'station') {
      const point = STATION_COORDS[selected.id];
      if (point) centerOn(point[0], point[1], Math.max(2.2, currentZoom()));
    } else if (selected?.type === 'train') {
      const snapshot = activeSnapshots.get(selected.id);
      if (snapshot) startFollowing(snapshot);
    }
  }

  function pointerDistance() {
    const values = [...pointers.values()];
    return values.length >= 2 ? Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y) : 0;
  }

  function pointerMidpoint() {
    const values = [...pointers.values()];
    return values.length >= 2 ? { x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 } : null;
  }

  function onPointerDown(event) {
    if (event.target.closest('.live-map-station, .live-map-train')) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    svg.setPointerCapture?.(event.pointerId);
    if (pointers.size === 2) {
      const midpoint = pointerMidpoint();
      pinchStart = { distance: pointerDistance(), zoom: currentZoom(), midpoint };
      dragStart = null;
      return;
    }
    dragStart = { x: event.clientX, y: event.clientY, viewX: viewBox.x, viewY: viewBox.y };
    svg.classList.add('is-panning');
  }

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2 && pinchStart) {
      event.preventDefault();
      const midpoint = pointerMidpoint();
      const factor = pointerDistance() / Math.max(1, pinchStart.distance);
      const desiredZoom = Math.min(MAX_ZOOM, Math.max(1, pinchStart.zoom * factor));
      const current = currentZoom();
      zoomAt(desiredZoom / current, midpoint.x, midpoint.y);
      return;
    }
    if (!dragStart || pointers.size !== 1) return;
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    viewBox.x = dragStart.viewX - (event.clientX - dragStart.x) / rect.width * viewBox.width;
    viewBox.y = dragStart.viewY - (event.clientY - dragStart.y) / rect.height * viewBox.height;
    applyViewBox();
  }

  function onPointerEnd(event) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0) {
      dragStart = null;
      svg.classList.remove('is-panning');
    }
  }

  function toggleExpandedMap() {
    const enabled = document.body.classList.toggle('live-map-focus-mode');
    expandButton.textContent = enabled ? '×' : '⛶';
    expandButton.setAttribute('aria-label', enabled ? 'Exit expanded live map' : 'Expand the live map');
    expandButton.title = enabled ? 'Exit expanded map' : 'Expand map';
  }

  function animationLoop(timestamp) {
    if (mapActive && document.visibilityState !== 'hidden' && timestamp - lastRefresh >= REFRESH_INTERVAL_MS) {
      refreshTrains(BORAIL_CLOCK.now());
      lastRefresh = timestamp;
    }
    frameId = requestAnimationFrame(animationLoop);
  }

  function initializeEvents() {
    document.addEventListener('borail:viewchange', event => {
      mapActive = event.detail?.view === 'map';
      if (mapActive) requestAnimationFrame(() => refreshTrains(BORAIL_CLOCK.now(), true));
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && mapActive) refreshTrains(BORAIL_CLOCK.now(), true);
    });
    filtersPanel.addEventListener('change', () => refreshTrains(BORAIL_CLOCK.now(), true));
    filterToggle.addEventListener('click', () => {
      filtersPanel.hidden = !filtersPanel.hidden;
      filterToggle.setAttribute('aria-expanded', String(!filtersPanel.hidden));
    });
    resetFilters.addEventListener('click', () => {
      filtersPanel.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = true; });
      refreshTrains(BORAIL_CLOCK.now(), true);
    });
    detailsClose.addEventListener('click', closeDetails);
    stopFollowingButton.addEventListener('click', stopFollowing);
    zoomInButton.addEventListener('click', () => zoomAt(1.35));
    zoomOutButton.addEventListener('click', () => zoomAt(1 / 1.35));
    fitButton.addEventListener('click', fitMap);
    focusSelectionButton.addEventListener('click', focusSelection);
    expandButton.addEventListener('click', toggleExpandedMap);
    svg.addEventListener('wheel', event => {
      event.preventDefault();
      zoomAt(event.deltaY < 0 ? 1.18 : 1 / 1.18, event.clientX, event.clientY);
    }, { passive: false });
    svg.addEventListener('dblclick', event => {
      event.preventDefault();
      zoomAt(1.5, event.clientX, event.clientY);
    });
    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerEnd);
    svg.addEventListener('pointercancel', onPointerEnd);
    svg.addEventListener('click', event => {
      const train = event.target.closest('.live-map-train');
      const station = event.target.closest('.live-map-station');
      if (train) selectTrain(train.dataset.trainId);
      else if (station) selectStation(station.dataset.stationId);
    });
    svg.addEventListener('keydown', event => {
      if (!['Enter', ' '].includes(event.key)) return;
      const train = event.target.closest('.live-map-train');
      const station = event.target.closest('.live-map-station');
      if (!train && !station) return;
      event.preventDefault();
      if (train) selectTrain(train.dataset.trainId);
      else selectStation(station.dataset.stationId);
    });
    document.addEventListener('keydown', event => {
      if (!mapActive) return;
      if (event.key === 'Escape') {
        if (document.body.classList.contains('live-map-focus-mode')) toggleExpandedMap();
        else closeDetails();
      } else if ((event.key === '+' || event.key === '=') && document.activeElement?.closest('#liveMapView')) {
        zoomAt(1.25);
      } else if (event.key === '-' && document.activeElement?.closest('#liveMapView')) {
        zoomAt(1 / 1.25);
      }
    });
  }

  function initialize() {
    const missingStations = STATIONS.filter(station => !STATION_COORDS[station.id]);
    if (missingStations.length) {
      console.warn('Live Map is missing station coordinates:', missingStations.map(station => station.id));
    }
    renderGeography();
    renderTracks();
    renderStations();
    initializeLineFilters();
    initializeEvents();
    applyViewBox();
    refreshTrains(BORAIL_CLOCK.now(), true);
    frameId = requestAnimationFrame(animationLoop);
  }

  window.BORailLiveMapDebug = Object.freeze({
    getActiveTrainSnapshots,
    findServicePath,
    getTrackEdges: () => physicalEdges.map(edge => ({ ...edge, services: [...edge.services] })),
    getLaneOffset: (edge, snapshot) => laneOffsetFor(snapshot, edge),
    getPathPoints: (serviceId, direction, path, isExpress = false) => pointsForPath(path, {
      serviceId,
      direction,
      isExpress
    }).map(point => ({ ...point })),
    getStationCoordinates: () => ({ ...STATION_COORDS }),
    getState: () => ({
      active: mapActive,
      activeTrainCount: activeSnapshots.size,
      renderedTrainCount: trainElements.size,
      selected: selected ? { ...selected } : null,
      viewBox: { ...viewBox },
      expanded: document.body.classList.contains('live-map-focus-mode')
    }),
    selectStation,
    selectTrain,
    refresh: date => refreshTrains(date || BORAIL_CLOCK.now(), true),
    destroy() {
      if (frameId) cancelAnimationFrame(frameId);
    }
  });

  initialize();
})();
