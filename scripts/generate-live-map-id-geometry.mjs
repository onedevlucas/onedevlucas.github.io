import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(root, 'assets', 'maps', 'engineering', 'registry.json');
const outputPath = path.join(root, 'assets', 'js', 'live-map-id-geometry.js');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const suffixExceptions = {
  'Burlington - University of NCU': 'BurlingtonUnivOfNCU',
  'Oakville City Airport': 'WychwoodOakvilleCityAirport',
  'Wood-by-Hike': 'Woodbyhike'
};
const suffixFor = station => suffixExceptions[station] || station.replace(/[^A-Za-z0-9]/g, '');

for (const entry of registry) {
  const sourcePath = path.join(root, 'assets', 'maps', 'engineering', entry.file);
  assert.ok(fs.existsSync(sourcePath), `Missing registered engineering SVG: ${entry.file}`);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, `${entry.file} contains duplicate SVG IDs.`);
  for (const [direction, routes] of Object.entries(entry.routes)) {
    const routePattern = new RegExp(`^${entry.prefix}-${direction}-(\\d+)$`);
    const numbers = ids.map(id => routePattern.exec(id)).filter(Boolean).map(match => Number(match[1])).sort((a, b) => a - b);
    assert.ok(numbers.length, `${entry.file} has no ${direction} route sections.`);
    assert.deepEqual(numbers, Array.from({ length: numbers.at(-1) }, (_, index) => index + 1),
      `${entry.file} ${direction} section numbers must run continuously from 01.`);
    assert.equal(ids.filter(id => routePattern.test(id) && !/-\d{2}$/.test(id)).length, 0,
      `${entry.file} ${direction} section IDs must use two-digit numbers.`);
    for (const station of new Set(routes.flat())) {
      const stopId = `stop-${entry.prefix}-${direction}-${suffixFor(station)}`;
      assert.ok(ids.includes(stopId), `${entry.file} is missing #${stopId}.`);
    }
  }
}
const endpoint = process.env.BORAIL_CDP_URL || 'http://127.0.0.1:9223/json/list';
const targets = await fetch(endpoint).then(response => response.json());
const target = targets.find(item => item.type === 'page');
assert.ok(target, 'A Chrome page must be available through BORAIL_CDP_URL.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const request = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:8766/index.html' });
await new Promise(resolve => setTimeout(resolve, 500));

const expression = `(async () => {
  const registry = ${JSON.stringify(registry)};
  const width = 1200;
  const height = 1200;
  const exceptions = ${JSON.stringify(suffixExceptions)};
  const suffixFor = station => exceptions[station] || station.replace(/[^A-Za-z0-9]/g, '');
  const pointKey = (x, y) => y * width + x;
  const pointFromKey = key => [key % width, Math.floor(key / width)];
  // Canva/Inkscape exports adjacent colored pieces with seams at station
  // furniture and clipping boundaries. The mask contains only one direction,
  // so a modest jump radius can reconnect those authored joins without ever
  // reaching the opposite directional rail.
  const neighbors = [];
  for (let dy = -24; dy <= 24; dy += 1) {
    for (let dx = -24; dx <= 24; dx += 1) {
      if ((!dx && !dy) || Math.hypot(dx, dy) > 24.01) continue;
      neighbors.push([dx, dy, Math.hypot(dx, dy)]);
    }
  }

  function skeletonize(mask) {
    const pixels = new Uint8Array(mask);
    let changed = true;
    const remove = [];
    const value = (x, y) => pixels[pointKey(x, y)];
    while (changed) {
      changed = false;
      for (let pass = 0; pass < 2; pass += 1) {
        remove.length = 0;
        for (let y = 1; y < height - 1; y += 1) {
          for (let x = 1; x < width - 1; x += 1) {
            const index = pointKey(x, y);
            if (!pixels[index]) continue;
            const p2 = value(x, y - 1), p3 = value(x + 1, y - 1);
            const p4 = value(x + 1, y), p5 = value(x + 1, y + 1);
            const p6 = value(x, y + 1), p7 = value(x - 1, y + 1);
            const p8 = value(x - 1, y), p9 = value(x - 1, y - 1);
            const count = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
            if (count < 2 || count > 6) continue;
            const transitions = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) +
              (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
            if (transitions !== 1) continue;
            const first = pass === 0 ? p2 * p4 * p6 : p2 * p4 * p8;
            const second = pass === 0 ? p4 * p6 * p8 : p2 * p6 * p8;
            if (!first && !second) remove.push(index);
          }
        }
        if (remove.length) {
          changed = true;
          for (const index of remove) pixels[index] = 0;
        }
      }
    }
    return pixels;
  }

  function nearestSkeletonPoint(skeleton, target, radius = 28) {
    const centerX = Math.round(target[0]);
    const centerY = Math.round(target[1]);
    let best = null;
    for (let y = Math.max(0, centerY - radius); y <= Math.min(height - 1, centerY + radius); y += 1) {
      for (let x = Math.max(0, centerX - radius); x <= Math.min(width - 1, centerX + radius); x += 1) {
        const key = pointKey(x, y);
        if (!skeleton[key]) continue;
        const distance = Math.hypot(x - target[0], y - target[1]);
        if (!best || distance < best.distance) best = { key, distance };
      }
    }
    if (!best) throw new Error('No engineering rail found near stop ' + target.join(','));
    return best.key;
  }

  class MinHeap {
    constructor() { this.items = []; }
    push(key, distance) {
      const item = { key, distance };
      this.items.push(item);
      let index = this.items.length - 1;
      while (index) {
        const parent = Math.floor((index - 1) / 2);
        if (this.items[parent].distance <= distance) break;
        this.items[index] = this.items[parent];
        index = parent;
      }
      this.items[index] = item;
    }
    pop() {
      if (!this.items.length) return null;
      const root = this.items[0];
      const tail = this.items.pop();
      if (!this.items.length) return root;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.items.length) break;
        const child = right < this.items.length && this.items[right].distance < this.items[left].distance ? right : left;
        if (this.items[child].distance >= tail.distance) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = tail;
      return root;
    }
  }

  function shortestPath(skeleton, start, goal) {
    if (start === goal) return [pointFromKey(start)];
    const distances = new Float64Array(width * height);
    distances.fill(Infinity);
    const previous = new Int32Array(width * height);
    previous.fill(-1);
    const heap = new MinHeap();
    distances[start] = 0;
    heap.push(start, 0);
    while (heap.items.length) {
      const current = heap.pop();
      if (current.distance !== distances[current.key]) continue;
      if (current.key === goal) break;
      const [x, y] = pointFromKey(current.key);
      for (const [dx, dy, cost] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = pointKey(nx, ny);
        if (!skeleton[next]) continue;
        const distance = current.distance + cost;
        if (distance >= distances[next]) continue;
        distances[next] = distance;
        previous[next] = current.key;
        heap.push(next, distance);
      }
    }
    if (previous[goal] < 0) throw new Error('Identified engineering sections are not connected.');
    const path = [];
    for (let current = goal; current >= 0; current = previous[current]) {
      path.push(pointFromKey(current));
      if (current === start) break;
    }
    return path.reverse();
  }

  function simplify(points, tolerance = 0.42) {
    if (points.length < 3) return points;
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
      const [start, end] = stack.pop();
      const [ax, ay] = points[start];
      const [bx, by] = points[end];
      const dx = bx - ax, dy = by - ay;
      const lengthSquared = dx * dx + dy * dy;
      let bestDistance = -1;
      let bestIndex = -1;
      for (let index = start + 1; index < end; index += 1) {
        const [px, py] = points[index];
        const ratio = lengthSquared ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0;
        const distance = Math.hypot(px - (ax + dx * ratio), py - (ay + dy * ratio));
        if (distance > bestDistance) { bestDistance = distance; bestIndex = index; }
      }
      if (bestDistance > tolerance) {
        keep[bestIndex] = 1;
        stack.push([start, bestIndex], [bestIndex, end]);
      }
    }
    return points.filter((_, index) => keep[index]);
  }

  async function imageDataForDirection(source, prefix, direction) {
    const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
    const root = parsed.documentElement;
    root.setAttribute('width', String(width));
    root.setAttribute('height', String(height));
    root.setAttribute('preserveAspectRatio', 'none');
    for (const element of root.querySelectorAll('*')) {
      if (element.closest('defs')) continue;
      element.setAttribute('visibility', 'hidden');
    }
    const routePattern = new RegExp('^' + prefix + '-' + direction + '-\\\\d+$');
    const routeElements = [...root.querySelectorAll('[id]')].filter(element => routePattern.test(element.id));
    if (!routeElements.length) throw new Error('No route IDs found for ' + prefix + ' ' + direction);
    const nestedRoute = routeElements.find(element => {
      const ancestor = element.parentElement?.closest('[id]');
      return ancestor && routePattern.test(ancestor.id);
    });
    if (nestedRoute) throw new Error('Nested route ID #' + nestedRoute.id + ' is not allowed.');
    for (const routeElement of routeElements) {
      for (const element of [routeElement, ...routeElement.querySelectorAll('*')]) {
        element.setAttribute('visibility', 'visible');
        element.setAttribute('opacity', '1');
        if (['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'].includes(element.localName)) {
          if (element.getAttribute('fill') !== 'none') element.setAttribute('fill', '#ffffff');
          if (element.getAttribute('stroke') && element.getAttribute('stroke') !== 'none') element.setAttribute('stroke', '#ffffff');
        }
      }
    }
    const serialized = new XMLSerializer().serializeToString(root);
    const image = new Image();
    const url = URL.createObjectURL(new Blob([serialized], { type: 'image/svg+xml' }));
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, width, height);
      return context.getImageData(0, 0, width, height);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function stopPositions(source, prefix, direction, stations) {
    const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
    const imported = document.importNode(parsed.documentElement, true);
    imported.setAttribute('width', String(width));
    imported.setAttribute('height', String(height));
    imported.setAttribute('preserveAspectRatio', 'none');
    imported.style.cssText = 'position:absolute;left:-10000px;top:0;width:1200px;height:1200px;';
    document.body.appendChild(imported);
    try {
      return Object.fromEntries(stations.map(station => {
        const id = 'stop-' + prefix + '-' + direction + '-' + suffixFor(station);
        const element = imported.querySelector('#' + CSS.escape(id));
        if (!element) throw new Error('Missing stop marker #' + id);
        const box = element.getBBox();
        const point = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(element.getCTM());
        return [station, [Number(point.x.toFixed(3)), Number(point.y.toFixed(3))]];
      }));
    } finally {
      imported.remove();
    }
  }

  const geometry = {};
  const diagnostics = {};
  for (const entry of registry) {
    const source = await fetch('assets/maps/engineering/' + entry.file).then(response => {
      if (!response.ok) throw new Error('Unable to load ' + entry.file);
      return response.text();
    });
    diagnostics[entry.key] = {};
    for (const [direction, routes] of Object.entries(entry.routes)) {
      const stations = [...new Set(routes.flat())];
      const stops = stopPositions(source, entry.prefix, direction, stations);
      const imageData = await imageDataForDirection(source, entry.prefix, direction);
      const mask = new Uint8Array(width * height);
      for (let index = 0; index < mask.length; index += 1) mask[index] = imageData.data[index * 4 + 3] > 36 ? 1 : 0;
      const skeleton = skeletonize(mask);
      const stopPixels = Object.fromEntries(Object.entries(stops).map(([station, point]) => [station, nearestSkeletonPoint(skeleton, point)]));
      const seenEdges = new Set();
      for (const route of routes) {
        for (let index = 0; index < route.length - 1; index += 1) {
          const from = route[index];
          const to = route[index + 1];
          const edge = from + '|' + to;
          if (seenEdges.has(edge)) continue;
          seenEdges.add(edge);
          let points;
          try {
            points = shortestPath(skeleton, stopPixels[from], stopPixels[to]);
          } catch (error) {
            const verticalRows = [];
            for (let y = Math.floor(Math.min(stops[from][1], stops[to][1])) - 5; y <= Math.ceil(Math.max(stops[from][1], stops[to][1])) + 5; y += 1) {
              let present = false;
              for (let x = 185; x <= 230; x += 1) present ||= Boolean(skeleton[pointKey(x, y)]);
              if (present) verticalRows.push(y);
            }
            const gaps = [];
            for (let index = 1; index < verticalRows.length; index += 1) {
              if (verticalRows[index] - verticalRows[index - 1] > 1) gaps.push([verticalRows[index - 1], verticalRows[index]]);
            }
            throw new Error(entry.key + ' ' + direction + ' ' + from + ' ' + JSON.stringify(stops[from]) +
              ' [' + pointFromKey(stopPixels[from]).join(',') + '] -> ' + to + ' ' + JSON.stringify(stops[to]) +
              ' [' + pointFromKey(stopPixels[to]).join(',') + '] gaps=' + JSON.stringify(gaps) + ': ' + error.message);
          }
          points[0] = stops[from];
          points[points.length - 1] = stops[to];
          points = simplify(points);
          geometry[entry.key + '|' + from + '|' + to] = points.map(([x, y]) => [Number(x.toFixed(3)), Number(y.toFixed(3))]);
        }
      }
      diagnostics[entry.key][direction] = { sections: seenEdges.size, stops: stations.length };
    }
  }
  return { geometry, diagnostics };
})()`;

const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
if (response.exceptionDetails) {
  throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
}
const result = response.result.value;
const source = `// Generated from ID-tagged engineering SVGs. Run scripts/generate-live-map-id-geometry.mjs after registry updates.\n` +
  `window.BORAIL_ID_ROUTE_GEOMETRY=Object.freeze(${JSON.stringify(result.geometry)});\n` +
  `window.BORAIL_ID_GEOMETRY_META=Object.freeze(${JSON.stringify({ generatedFrom: registry.map(entry => entry.file), diagnostics: result.diagnostics })});\n`;
fs.writeFileSync(outputPath, source);
console.log(JSON.stringify(result.diagnostics, null, 2));
console.log(`Wrote ${Object.keys(result.geometry).length} exact route edges to ${outputPath}.`);
socket.close();
