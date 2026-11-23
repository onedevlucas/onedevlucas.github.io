(function initializeOperations(root) {
  'use strict';

  const airport = 'Oakville City Airport';
  const burlington = 'Burlington - University of NCU';
  const rules = {
    Newkirk: { 'F-local': 'Hoganville', 'F-express': 'Hoganville', 'S-express': burlington, 'A-local': burlington },
    'Berwick Hall': { 'G-local': 'Westpoint' },
    'Bradford Bay': { 'G-local': 'Bradford Square' },
    Kenilworth: { 'F-local': 'Atkinson Junction' },
    Boylston: { 'F-local': 'Brookfield Lawn' },
    Whitebranch: { 'F-express': 'New Cottage' },
    [burlington]: { 'S-local': 'Newkirk' },
    'Port Williamson': { 'A-express': 'Willow Springs' },
    'Ralston-Finch East': { 'S-local': 'Vanderburg', 'S-express': 'Vanderburg' },
    'Veridia Nexus': { 'D-local': null },
    [airport]: { 'D-local': null, 'C-local': 'Fernwood' },
    'Leighton Castle': { 'B-local': 'Oakville Plaza', 'B-express': 'Oakville Plaza' },
    'Mount River': { 'A-local': 'Talmedge Hill', 'A-express': 'Talmedge Hill' },
    Fernwood: { 'C-local': 'Joplin' },
    'East Heights': { 'C-local': 'Roxbury Landing', 'E-local': 'Alpherst' },
    'Santa Mora': { 'E-local': 'Brandywine' },
    'Harrington City': { 'B-local': 'South Harrington' },
    Hadleigh: { 'B-express': 'Carrollton', 'B-local': 'Carrollton' }
  };

  const empty = Object.freeze({ revision: 0, changes: [] });
  const active = (change, at) => change.startsAt <= at && (change.endsAt == null || at < change.endsAt);
  const serviceKey = route => `${route.serviceId}-${route.isExpress ? 'express' : 'local'}`;
  const stationName = value => /^wychwood(?:\s*[-–]?\s*oakville city airport)?$/i.test(value) ? airport : value;
  const publicReason = value => value.replace(/\bWychwood(?:\s*[-–]?\s*Oakville City Airport)?\b/gi, airport);
  const affectsService = (change, key) => change.kind === 'system' ||
    (change.kind === 'service' && (change.target === key || change.target === key[0]));
  const serviceDayStart = date => root.BORailTime.serviceDay(date).anchor;

  function atTime(snapshot, at) {
    const changes = (snapshot?.changes || []).filter(change => active(change, at));
    return {
      stations: new Map(changes.filter(change => change.kind === 'station').map(change => [change.target, change])),
      shutdowns: changes.filter(change => change.kind === 'service' || change.kind === 'system')
    };
  }

  let geometryIdentity;
  let graph;
  function railGraph() {
    const geometry = root.BORAIL_ID_ROUTE_GEOMETRY;
    if (graph && geometry === geometryIdentity) return graph;
    geometryIdentity = geometry;
    graph = new Map();
    for (const [key, points] of Object.entries(geometry || {})) {
      const [service, from, to] = key.split('|');
      const length = points.slice(1).reduce((total, point, index) =>
        total + Math.hypot(point[0] - points[index][0], point[1] - points[index][1]), 0);
      if (!graph.has(from)) graph.set(from, []);
      graph.get(from).push({ key, service, to, length, start: points[0], end: points.at(-1) });
    }
    return graph;
  }

  function railPath(from, to, service, options = {}) {
    if (from === to) return null;
    const connections = railGraph();
    const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const queue = [{ station: from, edge: options.incoming, cost: 0, length: 0, keys: [] }];
    const best = new Map();
    while (queue.length) {
      queue.sort((a, b) => b.cost - a.cost);
      const current = queue.pop();
      if (current.station === to) return current;
      for (const edge of connections.get(current.station) || []) {
        const prior = current.edge;
        if (prior && distance(prior.end, edge.start) > 14) continue;
        if (prior && !options.reverse && prior.key.split('|')[1] === edge.to) continue;
        if (options.forbidden?.has(edge.to) && edge.to !== to) continue;
        const cost = current.cost + Math.max(1, edge.length) + (edge.service === service ? 0 : 90);
        if (cost >= (best.get(edge.key) ?? Infinity)) continue;
        best.set(edge.key, cost);
        queue.push({ station: edge.to, edge, cost, length: current.length + edge.length, keys: [...current.keys, edge.key] });
      }
    }
    return null;
  }

  function basePath(from, to, service) {
    const key = `${service}|${from}|${to}`;
    if (root.BORAIL_ID_ROUTE_GEOMETRY?.[key]) return [key];
    return railPath(from, to, service)?.keys || [];
  }

  function closurePattern(route, pattern, state, allRoutes, effectivePattern) {
    if (!state.stations.size) return pattern;
    const key = serviceKey(route);
    const closed = state.stations;
    if (key === 'D-local' && (closed.has(airport) || closed.has('Veridia Nexus'))) return null;
    if (key === 'F-local' && ['Newkirk', 'Kenilworth', 'Boylston'].every(name => closed.has(name))) return null;

    let { stops, segmentTimes } = pattern;
    let changed = stops.some(name => closed.has(name));
    let usesNewkirkBranch = false;
    if (key === 'A-express' && closed.has('Mount River')) {
      // The Mount River closure explicitly sends A Express onto the
      // Newkirk branch. Retain the express stops on the common corridor.
      const replacement = stops[0] === 'Port Williamson'
        ? ['Newkirk', burlington] : [burlington, 'Newkirk'];
      const atStart = stops[0] === 'Port Williamson';
      stops = atStart ? [...replacement, ...stops.slice(1)] : [...stops.slice(0, -1), ...replacement];
      segmentTimes = atStart ? [1.5, ...segmentTimes] : [...segmentTimes, 1.5];
      usesNewkirkBranch = true;
      changed = true;
    }
    if (key === 'C-local' && closed.has(airport) && [stops[0], stops.at(-1)].includes(airport)) {
      const alternate = allRoutes.find(candidate => candidate.serviceId === 'C' && candidate.dir === route.dir &&
        [candidate.origin, candidate.destination].includes('Fernwood'));
      if (!alternate) return null;
      ({ stops, segmentTimes } = effectivePattern(alternate));
      changed = true;
    }
    if (!changed) return pattern;

    const trackStops = [...stops];
    const times = [...segmentTimes];
    const nativeService = key === 'S-express' ? 'S-local' : usesNewkirkBranch ? 'A-local' : key;
    const start = trackStops[0];
    const end = trackStops.at(-1);
    for (const [terminal, atStart] of [[start, true], [end, false]]) {
      if (!closed.has(terminal)) continue;
      const replacement = rules[terminal]?.[key];
      if (replacement === null) return null;
      if (!replacement || trackStops.includes(replacement)) continue;
      if (key === 'S-local' && terminal === burlington) {
        const extension = ['Newkirk - Oak Street', 'Newkirk'];
        if (atStart) {
          trackStops.unshift(...extension.reverse());
          times.unshift(1.5, 1.5);
        } else {
          trackStops.push(...extension);
          times.push(1.5, 1.5);
        }
      } else if (key === 'S-express' && terminal === 'Ralston-Finch East') {
        if (atStart) {
          trackStops.splice(1, 0, replacement);
          times.splice(0, 1, 1.5, 1.5);
        } else {
          trackStops.splice(-1, 0, replacement);
          times.splice(-1, 1, 1.5, 1.5);
        }
      } else if (key === 'A-express' && terminal === 'Port Williamson' && atStart) {
        trackStops.splice(1, 0, replacement);
        times.splice(0, 1, 1.5, 1.5);
      }
    }

    const endpoint = terminal => usesNewkirkBranch && terminal === 'Newkirk' && closed.has(terminal)
      ? burlington : closed.has(terminal) ? rules[terminal]?.[key] : terminal;
    const from = endpoint(start);
    const to = endpoint(end);
    let first = trackStops.indexOf(from);
    let last = trackStops.lastIndexOf(to);
    if (first < 0) first = 0;
    if (last < 0) last = trackStops.length - 1;
    const keep = [];
    for (let index = first; index <= last; index++) {
      if (!closed.has(trackStops[index])) keep.push(index);
    }
    if (keep.length < 2) return null;

    const legs = [];
    const travelTimes = [];
    for (let index = 1; index < keep.length; index++) {
      const left = keep[index - 1];
      const right = keep[index];
      const keys = [];
      for (let step = left; step < right; step++) {
        const branch = usesNewkirkBranch && [trackStops[step], trackStops[step + 1]]
          .some(name => name === burlington || name === 'Newkirk');
        let path = basePath(trackStops[step], trackStops[step + 1], branch ? 'A-local' : key);
        if (!path.length) path = basePath(trackStops[step], trackStops[step + 1], nativeService);
        keys.push(...path);
      }
      legs.push(keys);
      travelTimes.push(times.slice(left, right).reduce((sum, time) => sum + time, 0));
    }
    return { stops: keep.map(index => trackStops[index]), segmentTimes: travelTimes, legs,
      customDwellSeconds: pattern.customDwellSeconds && keep.map(index => pattern.customDwellSeconds[index]),
      rerouted: trackStops[keep[0]] !== start || trackStops[keep.at(-1)] !== end ||
        (key === 'C-local' && [route.origin, route.destination].includes(airport)) };
  }

  function describeService(service, routes, time, snapshot, effectivePattern) {
    const state = atTime(snapshot, time);
    const shutdown = state.shutdowns.find(change => change.kind === 'system') ||
      state.shutdowns.find(change => affectsService(change, service));
    if (shutdown) return {
      type: shutdown.kind === 'system' ? 'system-closed' : 'admin-noservice', reason: shutdown.reason, endsAt: shutdown.endsAt
    };
    if (!state.stations.size) return null;
    const relevant = routes.filter(route => serviceKey(route) === service);
    const affected = relevant.filter(route => route.stops.some(name => state.stations.has(name)));
    if (!affected.length) return null;
    const patterns = relevant.map(route => closurePattern(route, effectivePattern(route), state, routes, effectivePattern));
    const reason = [...new Set(affected.flatMap(route => route.stops
      .filter(name => state.stations.has(name))
      .map(name => `${name}: ${state.stations.get(name).reason}`)))].join(' · ');
    if (patterns.every(pattern => !pattern)) return { type: 'closure-noservice', reason };
    const altered = patterns.some(pattern => !pattern || pattern.rerouted);
    const terminals = [...new Set(patterns.filter(pattern => pattern?.rerouted).map(pattern =>
      [pattern.stops[0], pattern.stops.at(-1)].sort().join(' ↔ ')))];
    return { type: altered ? 'rerouted' : 'bypassed', reason: terminals.length ? `${reason} · Temporary routes: ${terminals.join(', ')}` : reason };
  }

  function recoverySeconds(runId, departure, snapshot) {
    const shutdown = (snapshot?.changes || []).findLast(change => change.kind === 'system' && change.endsAt != null &&
      departure >= change.endsAt && departure < change.endsAt + (change.recoveryMinutes || 0) * 60000);
    if (!shutdown) return 0;
    const progress = (departure - shutdown.endsAt) / (shutdown.recoveryMinutes * 60000);
    let hash = 2166136261;
    for (const character of runId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return (hash >>> 0) / 4294967296 < 0.5 * (1 - progress) ? (2 + Math.abs(hash % 4)) * 60 : 0;
  }

  function editAnchor(run, seconds) {
    if (seconds < run.stops[0].actualDepartureSec) return -1;
    return run.stops.findIndex(stop => stop.actualDepartureSec > seconds);
  }

  function applyTrainEdit(run, change, dayStart) {
    const seconds = (change.startsAt - dayStart) / 1000;
    if (seconds >= run.stops.at(-1).actualDepartureSec) return run;
    const anchor = editAnchor(run, seconds);
    if (change.cancel && anchor < 0) return null;
    const prefix = anchor < 0 ? [] : run.stops.slice(0, anchor + 1);
    const key = serviceKey(run);
    const oldLegs = run.legs || run.stops.slice(1).map((stop, index) => basePath(run.stops[index].name, stop.name, key));
    const legs = oldLegs.slice(0, Math.max(0, prefix.length - 1));
    if (change.cancel) return { ...run, stops: prefix, legs, destination: prefix.at(-1).name, editId: change.id };
    const stops = [...prefix];
    const oldFirst = run.stops[0];
    if (!stops.length) stops.push({ ...oldFirst, name: change.stops[0] });
    const remaining = anchor < 0 ? change.stops.slice(1) : change.stops;
    let originalIndex = run.stops.findIndex(stop => stop.name === stops.at(-1).name);
    for (const station of remaining) {
      const previous = stops.at(-1);
      const targetIndex = run.stops.findIndex((stop, index) => index > originalIndex && stop.name === station);
      const nativeKeys = originalIndex >= 0 && targetIndex > originalIndex
        ? oldLegs.slice(originalIndex, targetIndex).flat() : [];
      const lastKey = legs.at(-1)?.at(-1);
      const from = previous.name;
      const lastFrom = lastKey?.split('|')[1];
      const incoming = railGraph().get(lastFrom)?.find(edge => edge.key === lastKey);
      const path = nativeKeys.length
        ? { keys: nativeKeys }
        : railPath(from, station, key, { incoming, reverse: change.advanced });
      if (!path) throw new Error(`No connected rail path from ${from} to ${station}.`);
      const knownFrom = nativeKeys.length ? run.stops[originalIndex] : null;
      const knownTo = nativeKeys.length ? run.stops[targetIndex] : null;
      const travelSeconds = knownTo
        ? knownTo.scheduledArrivalSec - knownFrom.scheduledDepartureSec
        : Math.max(30, Math.round((path.length || 65) * 1.35));
      const arrival = previous.scheduledDepartureSec + travelSeconds;
      const actual = previous.actualDepartureSec + (knownTo
        ? knownTo.actualArrivalSec - knownFrom.actualDepartureSec : travelSeconds);
      const dwell = knownTo ? knownTo.scheduledDepartureSec - knownTo.scheduledArrivalSec : 15;
      const delaySeconds = knownTo ? Math.max(previous.delaySeconds, knownTo.delaySeconds) : previous.delaySeconds;
      stops.push({
        name: station, stopIndex: stops.length, scheduledArrivalSec: arrival, scheduledDepartureSec: arrival + dwell,
        actualArrivalSec: actual, actualDepartureSec: actual + dwell, isDelayed: delaySeconds > 0, delaySeconds
      });
      legs.push(path.keys);
      originalIndex = run.stops.findIndex(stop => stop.name === station);
    }
    if (stops.length < 2) throw new Error('Select at least two stops for the revised run.');
    const delayStartStop = stops.findIndex(stop => stop.isDelayed);
    return { ...run, stops, legs, origin: stops[0].name, destination: stops.at(-1).name, editId: change.id,
      hasDelay: delayStartStop > 0, delayStartStop, delaySeconds: stops.at(-1).delaySeconds,
      delayStartSec: delayStartStop > 0 ? stops[delayStartStop - 1].scheduledDepartureSec : null };
  }

  root.BORailOperations = Object.freeze({
    empty, atTime, active, serviceKey, serviceDayStart, affectsService, stationName, publicReason, railPath, basePath,
    closurePattern, describeService, recoverySeconds, editAnchor, applyTrainEdit
  });
})(globalThis);
