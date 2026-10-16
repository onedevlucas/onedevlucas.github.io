(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MAP_WIDTH = 1200;
  const MAP_HEIGHT = 860;
  const MAX_ZOOM = 5;
  const REFRESH_INTERVAL_MS = 1000;
  const LINE_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'S'];

  const view = document.getElementById('liveMapView');
  if (!view) return;

  const svg = document.getElementById('liveMapSvg');
  const geographyLayer = document.getElementById('liveMapGeography');
  const tracksLayer = document.getElementById('liveMapTracks');
  const stationsLayer = document.getElementById('liveMapStations');
  const trainsLayer = document.getElementById('liveMapTrains');
  const stationSearch = document.getElementById('liveMapStationSearch');
  const filterToggle = document.getElementById('liveMapFilterToggle');
  const filtersPanel = document.getElementById('liveMapFilters');
  const filterCount = document.getElementById('liveMapFilterCount');
  const lineFilters = document.getElementById('liveMapLineFilters');
  const resetFilters = document.getElementById('liveMapResetFilters');
  const serviceState = document.getElementById('liveMapServiceState');
  const trainCount = document.getElementById('liveMapTrainCount');
  const clock = document.getElementById('liveMapClock');
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
    'Newkirk': [210, 90],
    'Newkirk - Oak Street': [160, 135],
    'Hoganville': [160, 230],
    'Bayview Park': [160, 310],
    'Chelsea Bay': [160, 365],
    'Berwick Hall': [160, 430],
    'Westpoint': [205, 480],
    'Bradford Square': [105, 480],
    'Bradford Bay': [55, 480],
    'Cambridge Central': [145, 535],
    'Atkinson Junction': [170, 610],
    'Garner': [155, 690],
    'Kenilworth': [65, 730],
    'La Vista': [285, 650],
    'Brookfield Lawn': [375, 650],
    'Boylston': [420, 610],
    'Foxston': [475, 680],
    'New Cottage': [565, 720],
    'Whitebranch': [680, 760],
    'Burlington - University of NCU': [300, 225],
    'Port Williamson': [405, 235],
    'Willow Springs': [370, 350],
    'Rockcastle': [380, 430],
    'Cannon View': [395, 520],
    'Ivory Knolls': [350, 580],
    'Djimar': [440, 600],
    'Vanderburg': [520, 610],
    'Ralston-Finch East': [610, 660],
    'Atkins Bridge': [450, 550],
    'Radcliff Fields': [520, 550],
    'Oakville City Airport': [610, 550],
    'Veridia Nexus': [530, 495],
    'Oakville Exchange': [750, 545],
    'Oakville City Center': [805, 590],
    'Oakville Plaza': [865, 545],
    'Talmedge Hill': [925, 610],
    'Mount River': [940, 700],
    'Perry Road': [700, 510],
    'Mount Hindsboro': [700, 455],
    'Wood-by-Hike': [770, 455],
    'New Salemview': [830, 430],
    'Millford Heights': [875, 390],
    'Roxbury Landing': [875, 340],
    'East Heights': [995, 320],
    'Leighton Castle': [940, 510],
    'Fort Meadow': [1060, 530],
    'Yoakum': [1115, 580],
    'Joplin': [1115, 645],
    'Fernwood': [1115, 710],
    'Greens Corner': [690, 400],
    'Doverville': [700, 350],
    'Orchard Ridge': [760, 325],
    'Groveton': [790, 285],
    'Madisonboro': [690, 285],
    'Hutchinson Point': [610, 285],
    'Vanwood': [520, 285],
    'South Harrington': [510, 225],
    'Harrington City': [510, 180],
    'Carrollton': [510, 135],
    'Hadleigh': [555, 90],
    'Alpherst': [865, 300],
    'New Halifax': [865, 255],
    'Tyford Farms': [865, 210],
    'Scottsbury': [865, 165],
    'Ameryville': [925, 130],
    'Scottsdale': [990, 130],
    'Grant Park': [1040, 130],
    'Cherrywood': [1090, 115],
    'Brandywine': [1090, 75],
    'Santa Mora': [1090, 35]
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
      ['Newkirk', 'Burlington - University of NCU', 'Cannon View', 'Atkins Bridge', 'Radcliff Fields', 'Oakville City Airport', 'Oakville Exchange', 'Oakville Plaza', 'Talmedge Hill', 'Mount River'],
      ['Port Williamson', 'Willow Springs', 'Cannon View', 'Atkins Bridge', 'Oakville City Airport']
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
      ['Leighton Castle', 'Oakville Plaza', 'Oakville City Center', 'Oakville Exchange', 'Perry Road', 'Mount Hindsboro', 'Greens Corner', 'Doverville', 'Orchard Ridge', 'Groveton', 'Madisonboro', 'Hutchinson Point', 'Vanwood', 'South Harrington', 'Harrington City'],
      ['Harrington City', 'Carrollton', 'Hadleigh']
    ]
  });

  const MAJOR_STATIONS = new Set([
    'Newkirk', 'Berwick Hall', 'Atkinson Junction', 'Burlington - University of NCU', 'Cannon View',
    'Oakville City Airport', 'Oakville Exchange', 'Leighton Castle', 'Perry Road', 'East Heights',
    'Harrington City', 'Santa Mora', 'Mount River', 'Kenilworth', 'Whitebranch', 'Hadleigh'
  ]);

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
    edgeKey('Newkirk - Oak Street', 'Newkirk'), edgeKey('Newkirk', 'Burlington - University of NCU'),
    edgeKey('Burlington - University of NCU', 'Cannon View'), edgeKey('Port Williamson', 'Willow Springs'),
    edgeKey('Willow Springs', 'Cannon View')
  ]);

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
    return [...edges.values()].map(edge => ({
      ...edge,
      services: [...edge.services],
      count: trackCountForEdge(edge.key, [...edge.services])
    }));
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

  function pointsForPath(path) {
    return path.map(station => ({ station, x: STATION_COORDS[station]?.[0] ?? MAP_WIDTH / 2, y: STATION_COORDS[station]?.[1] ?? MAP_HEIGHT / 2 }));
  }

  function pointAlongPolyline(points, progress) {
    if (points.length < 2) return { ...points[0], angle: 0, edge: null };
    const segments = [];
    let total = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
      const left = points[index];
      const right = points[index + 1];
      const length = Math.hypot(right.x - left.x, right.y - left.y);
      segments.push({ left, right, length });
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
          edge: edgeKey(segment.left.station, segment.right.station)
        };
      }
      distance -= segment.length;
    }
    return { ...points[points.length - 1], angle: 0, edge: null };
  }

  function laneOffsetFor(snapshot, edge) {
    const physical = physicalEdges.find(item => item.key === edge);
    const count = physical?.count || 2;
    const forward = snapshot.direction === 'Northbound' || snapshot.direction === 'Eastbound';
    if (count === 1) return 0;
    if (count === 2) return forward ? -3.2 : 3.2;
    if (count === 3) return snapshot.isExpress ? 0 : (forward ? -5.2 : 5.2);
    const inner = snapshot.isExpress ? 2.5 : 7.2;
    return forward ? -inner : inner;
  }

  function offsetPosition(position, snapshot) {
    const amount = laneOffsetFor(snapshot, position.edge);
    const radians = position.angle * Math.PI / 180;
    return {
      ...position,
      x: position.x - Math.sin(radians) * amount,
      y: position.y + Math.cos(radians) * amount
    };
  }

  function renderGeography() {
    geographyLayer.innerHTML = `
      <rect class="live-map-land" x="14" y="14" width="1172" height="832" rx="30"></rect>
      <path class="live-map-water" d="M0 0H150L105 95 92 206 38 304 0 320Z"></path>
      <path class="live-map-water" d="M405 0H585L568 84 604 156 566 245 587 340 548 438 573 532 536 620 611 720 720 860H505L438 768 412 665 447 563 420 460 454 365 426 259 458 165 420 82Z"></path>
      <path class="live-map-water" d="M760 0H1200V185L1125 176 1070 205 1013 184 949 218 890 192 827 229 783 180 810 115Z"></path>
    `;
  }

  function trackOffsets(count) {
    if (count === 1) return [0];
    if (count === 2) return [-3.2, 3.2];
    if (count === 3) return [-5.2, 0, 5.2];
    return [-7.2, -2.5, 2.5, 7.2];
  }

  function offsetLine(left, right, amount) {
    const dx = right[0] - left[0];
    const dy = right[1] - left[1];
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length * amount;
    const ny = dx / length * amount;
    return { x1: left[0] + nx, y1: left[1] + ny, x2: right[0] + nx, y2: right[1] + ny };
  }

  function renderTracks() {
    tracksLayer.innerHTML = '';
    physicalEdges.forEach(edge => {
      const left = STATION_COORDS[edge.left];
      const right = STATION_COORDS[edge.right];
      if (!left || !right) return;
      trackOffsets(edge.count).forEach(offset => {
        const line = offsetLine(left, right, offset);
        tracksLayer.appendChild(createSvgElement('line', { ...line, class: 'live-map-track-bed' }));
        tracksLayer.appendChild(createSvgElement('line', { ...line, class: 'live-map-rail' }));
      });
      edge.services.forEach((serviceId, index) => {
        const amount = edge.services.length === 1 ? 0 : (index - (edge.services.length - 1) / 2) * 2.2;
        const line = offsetLine(left, right, amount);
        const overlay = createSvgElement('line', {
          ...line,
          class: 'live-map-route-overlay',
          stroke: SERVICE_META[serviceId]?.color || '#9aa0aa'
        });
        if (edge.services.length > 1) overlay.setAttribute('stroke-dasharray', '8 5');
        tracksLayer.appendChild(overlay);
      });
    });
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
      group.appendChild(createSvgElement('circle', { class: 'live-map-station-hit', cx: point[0], cy: point[1], r: 15 }));
      group.appendChild(createSvgElement('circle', { class: 'live-map-station-dot', cx: point[0], cy: point[1], r: MAJOR_STATIONS.has(station.id) ? 5.4 : 4.1 }));
      const label = createSvgElement('text', {
        class: `live-map-station-label${MAJOR_STATIONS.has(station.id) ? '' : ' secondary'}`,
        x: point[0] > 1010 ? point[0] - 8 : point[0] + 8,
        y: point[1] - 8,
        'text-anchor': point[0] > 1010 ? 'end' : 'start'
      });
      label.textContent = station.name;
      group.appendChild(label);
      stationsLayer.appendChild(group);
      stationElements.set(station.id, group);
    });
  }

  function initializeSearch() {
    stationSearch.innerHTML = '<option value="">Choose a station…</option>' + [...STATIONS]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(station => `<option value="${escapeHtml(station.id)}">${escapeHtml(station.name)}</option>`)
      .join('');
  }

  function initializeLineFilters() {
    lineFilters.innerHTML = LINE_ORDER.map(serviceId => `
      <label class="live-map-line-filter" style="background:${SERVICE_META[serviceId].color}" title="${serviceId} line">
        <input type="checkbox" name="liveMapLine" value="${serviceId}" checked aria-label="Show ${serviceId} line trains">
        <span>${serviceId}</span>
      </label>
    `).join('');
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
        const adjacent = stops[index + 1] || stops[index - 1] || stop;
        const path = pointsForPath(findServicePath(run.serviceId, stop.name, adjacent.name));
        const endpoint = index < stops.length - 1 ? pointAlongPolyline(path, 0) : pointAlongPolyline(path, 1);
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
          const path = pointsForPath(findServicePath(run.serviceId, stop.name, next.name));
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

  function getActiveTrainSnapshots(date = new Date()) {
    const nowSeconds = BORAIL_CLOCK.clockSeconds(date);
    return getRunsForDate(date).map(run => snapshotForRun(run, nowSeconds)).filter(Boolean);
  }

  function selectedFilterValues(name) {
    return new Set([...document.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value));
  }

  function snapshotMatchesFilters(snapshot) {
    const serviceTypes = selectedFilterValues('liveMapServiceType');
    const statuses = selectedFilterValues('liveMapRunningStatus');
    const lines = selectedFilterValues('liveMapLine');
    const type = snapshot.isExpress ? 'express' : 'local';
    const runningStatus = snapshot.currentDelayed ? 'delayed' : 'on-time';
    return serviceTypes.has(type) && statuses.has(runningStatus) && lines.has(snapshot.serviceId);
  }

  function createTrainElement(snapshot) {
    const group = createSvgElement('g', {
      class: `live-map-train ${snapshot.isExpress ? 'express' : 'local'}${snapshot.currentDelayed ? ' delayed' : ''}`,
      'data-train-id': snapshot.id,
      tabindex: '0',
      role: 'button'
    });
    const center = -((snapshot.consist.cars - 1) * 7) / 2;
    const consistGroup = createSvgElement('g', { class: 'live-map-train-consist' });
    consistGroup.appendChild(createSvgElement('circle', { class: 'train-selection-ring', cx: center, cy: 0, r: 15 }));
    for (let index = 0; index < snapshot.consist.cars; index += 1) {
      consistGroup.appendChild(createSvgElement('rect', {
        class: `live-map-train-car${index === 0 ? ' live-map-train-front' : ''}`,
        x: -4 - index * 7,
        y: -3.2,
        width: 6,
        height: 6.4,
        rx: 1.4,
        fill: SERVICE_META[snapshot.serviceId].color
      }));
    }
    group.appendChild(consistGroup);
    const badge = createSvgElement(snapshot.isExpress ? 'polygon' : 'circle', snapshot.isExpress
      ? { class: 'live-map-train-badge', points: '10,-8 18,0 10,8 2,0' }
      : { class: 'live-map-train-badge', cx: 10, cy: 0, r: 7 });
    group.appendChild(badge);
    const badgeText = createSvgElement('text', { class: 'live-map-train-badge-text', x: 10, y: .4 });
    badgeText.textContent = snapshot.serviceId;
    group.appendChild(badgeText);
    group.appendChild(createSvgElement('circle', { class: 'live-map-delay-dot', cx: 18, cy: -7, r: snapshot.currentDelayed ? 3.2 : 0 }));
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

  function refreshTrains(date = new Date(), force = false) {
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
      } else {
        renderTrainDetails(snapshot);
        if (followingSelectedTrain) centerOn(snapshot.x, snapshot.y, Math.max(2.2, currentZoom()));
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
    detailsContent.innerHTML = `
      <div class="live-map-detail-kicker">Active train</div>
      <h3>${escapeHtml(serviceLabel(run.serviceId, run.isExpress))} Line to ${escapeHtml(run.destination)}</h3>
      <div class="live-map-detail-subtitle">${escapeHtml(snapshot.status)}</div>
      <div class="live-map-detail-badges">${lineBadgeHtml(run.serviceId, run.isExpress)}</div>
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
        ${followingSelectedTrain ? 'Stop following train' : 'Follow this train'}
      </button>
    `;
    details.hidden = false;
    focusSelectionButton.disabled = false;
    document.getElementById('liveMapFollowTrain')?.addEventListener('click', () => {
      followingSelectedTrain = !followingSelectedTrain;
      renderTrainDetails(snapshot);
    });
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

  function arrivalRowsForStation(stationId, date = new Date()) {
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

  function renderStationDetails(stationId, date = new Date()) {
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
    selected = { type: 'station', id: stationId };
    followingSelectedTrain = false;
    stationElements.get(stationId)?.classList.add('selected');
    stationSearch.value = stationId;
    renderStationDetails(stationId, new Date());
    if (focus) centerOn(STATION_COORDS[stationId][0], STATION_COORDS[stationId][1], Math.max(2.1, currentZoom()));
  }

  function selectTrain(trainId, focus = false) {
    const snapshot = activeSnapshots.get(trainId);
    if (!snapshot) return;
    clearSelections();
    selected = { type: 'train', id: trainId };
    followingSelectedTrain = false;
    trainElements.get(trainId)?.classList.add('selected');
    renderTrainDetails(snapshot);
    if (focus) centerOn(snapshot.x, snapshot.y, Math.max(2.25, currentZoom()));
  }

  function closeDetails() {
    selected = null;
    followingSelectedTrain = false;
    clearSelections();
    details.hidden = true;
    detailsContent.innerHTML = '';
    focusSelectionButton.disabled = true;
    stationSearch.value = '';
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
      if (snapshot) centerOn(snapshot.x, snapshot.y, Math.max(2.25, currentZoom()));
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
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    svg.setPointerCapture?.(event.pointerId);
    if (pointers.size === 2) {
      const midpoint = pointerMidpoint();
      pinchStart = { distance: pointerDistance(), zoom: currentZoom(), midpoint };
      dragStart = null;
      return;
    }
    if (event.target.closest('.live-map-station, .live-map-train')) return;
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
      refreshTrains(new Date());
      lastRefresh = timestamp;
    }
    frameId = requestAnimationFrame(animationLoop);
  }

  function initializeEvents() {
    document.addEventListener('borail:viewchange', event => {
      mapActive = event.detail?.view === 'map';
      if (mapActive) requestAnimationFrame(() => refreshTrains(new Date(), true));
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && mapActive) refreshTrains(new Date(), true);
    });
    filtersPanel.addEventListener('change', () => refreshTrains(new Date(), true));
    filterToggle.addEventListener('click', () => {
      filtersPanel.hidden = !filtersPanel.hidden;
      filterToggle.setAttribute('aria-expanded', String(!filtersPanel.hidden));
    });
    resetFilters.addEventListener('click', () => {
      filtersPanel.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = true; });
      refreshTrains(new Date(), true);
    });
    stationSearch.addEventListener('change', () => {
      if (stationSearch.value) selectStation(stationSearch.value, true);
    });
    detailsClose.addEventListener('click', closeDetails);
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
    initializeSearch();
    initializeLineFilters();
    initializeEvents();
    applyViewBox();
    refreshTrains(new Date(), true);
    frameId = requestAnimationFrame(animationLoop);
  }

  window.BORailLiveMapDebug = Object.freeze({
    getActiveTrainSnapshots,
    findServicePath,
    getTrackEdges: () => physicalEdges.map(edge => ({ ...edge, services: [...edge.services] })),
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
    refresh: date => refreshTrains(date || new Date(), true),
    destroy() {
      if (frameId) cancelAnimationFrame(frameId);
    }
  });

  initialize();
})();
