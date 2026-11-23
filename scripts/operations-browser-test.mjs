import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const www = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const file = path.join(root, url.pathname.replace(/^\/$/, '/index.html'));
  try {
    let content = await readFile(file);
    if (url.pathname === '/index.html' && url.searchParams.has('test-arrivals-error')) {
      content = content.toString().replace('<script src="assets/js/timetable.js', `<script>
        arrivalsForStation = () => { throw new Error('Simulated arrival data failure'); };
      </script><script src="assets/js/timetable.js`);
    }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    response.end(content);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => www.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${www.address().port}`;
const temp = await mkdtemp(path.join(tmpdir(), 'borail-operations-'));
const chrome = spawn(process.env.BORAIL_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${temp}`, 'about:blank'],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
const wait = time => new Promise(resolve => setTimeout(resolve, time));
let socket;
try {
  let endpoint;
  for (let attempt = 0; attempt < 80 && !endpoint; attempt++) {
    try {
      const [port] = (await readFile(path.join(temp, 'DevToolsActivePort'), 'utf8')).trim().split('\n');
      const pages = await fetch(`http://127.0.0.1:${port.trim()}/json/list`).then(response => response.json());
      endpoint = pages.find(item => item.type === 'page')?.webSocketDebuggerUrl;
    } catch { await wait(100); }
  }
  assert.ok(endpoint, 'Chrome did not start');
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let counter = 0;
  const pending = new Map();
  const exceptions = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    const callback = pending.get(message.id);
    if (!callback) return;
    pending.delete(message.id);
    callback(message);
  });
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = ++counter;
    pending.set(id, message => message.error ? reject(Error(message.error.message)) : resolve(message.result));
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async expression => {
    for (let attempt = 0; attempt < 80; attempt++) {
      if (await evaluate(expression)) return;
      await wait(100);
    }
    assert.fail(`Timed out waiting for ${expression}`);
  };
  const stopNames = () => evaluate(`Array.from(document.querySelectorAll('#opsTrainStops > li'), row => row.dataset.station)`);
  const handlePosition = index => evaluate(`(() => {
    const rect = document.querySelectorAll('.ops-stop-handle')[${index}].getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  })()`);
  const dragStop = async (from, to, mobile) => {
    const start = await handlePosition(from);
    const end = await handlePosition(to);
    end.y += from < to ? 8 : -8;
    assert.equal(await evaluate(`document.elementFromPoint(${start.x}, ${start.y})?.classList.contains('ops-stop-handle')`),
      true, `Handle must be visible at ${JSON.stringify(start)} on ${mobile ? 'mobile' : 'desktop'}`);
    if (mobile) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      await until('!!document.querySelector(".ops-stop-row.is-dragging")');
      await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
      await until('!!document.querySelector(".ops-stop-row[data-drop]")');
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...start });
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, ...end });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, ...end });
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Seoul' });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const testParams = new URLSearchParams(location.search);
    if (testParams.has('test-splash')) sessionStorage.removeItem('borailSplashSeen');
    else sessionStorage.setItem('borailSplashSeen', 'true');
    if (testParams.has('test-arrivals-error')) {
      const originalGet = Storage.prototype.getItem;
      const originalSet = Storage.prototype.setItem;
      Storage.prototype.getItem = function(key) {
        if (key === 'borailTimetableView') throw new Error('Simulated blocked choice storage');
        return originalGet.call(this, key);
      };
      Storage.prototype.setItem = function(key, value) {
        if (key === 'borailTimetableView') throw new Error('Simulated blocked choice storage');
        return originalSet.call(this, key, value);
      };
    }
    const realFetch = window.fetch;
    const closure = { id: 'newkirk', kind: 'station', target: 'Newkirk', reason: 'Closed for construction',
      startsAt: Date.now() - 30000, endsAt: null };
    const snapshot = { revision: 1, publishedAt: Date.now(), changes: [closure] };
    if (testParams.has('test-stations')) {
      localStorage.removeItem('borail-operations-snapshot-v1');
      const airportClosure = { ...closure, id: 'airport', target: 'Oakville City Airport', endsAt: Date.now() + 60000 };
      const reopened = { ...closure, id: 'reopened', target: 'Alpherst', endsAt: Date.now() - 10000 };
      const scheduled = { ...closure, id: 'scheduled', target: 'Westpoint', startsAt: Date.now() + 60000 };
      snapshot.changes = testParams.get('test-stations') === 'empty' ? [] : [airportClosure, reopened, scheduled];
    }
    window.fetch = (input, init) => {
      const url = new URL(input, location.href);
      if (!url.hostname.endsWith('.workers.dev')) return realFetch(input, init);
      if (url.pathname === '/operations') {
        if (testParams.get('test-stations') === 'late') {
          return new Promise(resolve => { window.releaseOperations = () => resolve(Response.json(snapshot)); });
        }
        return Promise.resolve(Response.json(snapshot));
      }
      if (url.pathname.endsWith('/login')) return Promise.resolve(Response.json({ token: 'test', expiresAt: Date.now() + 60000 }));
      if (url.pathname.endsWith('/overview')) return Promise.resolve(Response.json({ ...snapshot, history: [] }));
      if (url.pathname.endsWith('/runs')) return Promise.resolve(Response.json({ total: 1, runs: [{
        id: 'test-run-' + url.searchParams.get('date'), serviceId: 'F', isExpress: true,
        origin: 'Newkirk', destination: 'Whitebranch', locked: 2, departureMin: 500,
        stops: ['Newkirk', 'Newkirk - Oak Street', 'Hoganville', 'Berwick Hall', 'Atkinson Junction', 'La Vista',
          'Brookfield Lawn', 'Foxton', 'New Cottage', 'Whitebranch'].map(name => ({ name }))
      }] }));
      if (url.pathname.endsWith('/preview')) {
        window.previewActions = JSON.parse(init.body).actions;
        return Promise.resolve(Response.json({ summary: [{ ...closure, restore: true }] }));
      }
      if (url.pathname.endsWith('/publish')) return Promise.resolve(Response.json({ revision: 2 }));
      return Promise.resolve(Response.json({}));
    };
    window.confirm = () => true;
  ` });
  for (const width of [390, 1360]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 700 });
    await send('Page.navigate', { url: `${origin}/settings.html` });
    await until('window.BORailOperationsClient?.synced === true');
    await evaluate(`document.getElementById('adminSignIn').click();
      document.getElementById('adminPassword').value = 'test';
      document.getElementById('adminLogin').requestSubmit(); true`);
    await until('!document.getElementById("operationsDashboard").hidden');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
    await evaluate(`document.querySelector('#trainSearch').closest('details').open = true;
      document.querySelector('#trainSearch').requestSubmit(); true`);
    await until('!!document.querySelector("#opsTrainResults button")');
    await evaluate(`document.querySelector('#opsTrainResults button').click();
      document.querySelector('#opsTrainStops').scrollIntoView({ block: 'center' }); true`);
    assert.deepEqual((await stopNames()).slice(0, 3), ['Hoganville', 'Berwick Hall', 'Atkinson Junction']);
    assert.match(await evaluate('document.querySelector("#opsTrainLocked").textContent'), /Newkirk - Oak Street/);
    await dragStop(0, 2, width < 700);
    assert.deepEqual((await stopNames()).slice(0, 3), ['Berwick Hall', 'Atkinson Junction', 'Hoganville']);
    await dragStop(2, 0, width < 700);
    assert.deepEqual((await stopNames()).slice(0, 3), ['Hoganville', 'Berwick Hall', 'Atkinson Junction']);
    if (width >= 700) {
      const start = await handlePosition(0);
      const end = await evaluate(`(() => {
        const rect = document.querySelector('#opsTrainStops').getBoundingClientRect();
        return { x: ${start.x}, y: Math.floor(rect.bottom - 4) };
      })()`);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...start });
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, ...end });
      await until('document.querySelector("#opsTrainStops").scrollTop > 0');
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, ...end });
      assert.equal((await stopNames())[0], 'Hoganville');
    }
    await evaluate(`document.querySelector('[data-station="Berwick Hall"] [data-stop-action="up"]').focus(); true`);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', text: ' ', windowsVirtualKeyCode: 32 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    assert.equal((await stopNames())[0], 'Berwick Hall');
    await evaluate(`document.querySelector('[data-station="Hoganville"] [data-stop-action="remove"]').click();
      const station = document.querySelector('#opsTrainStation');
      station.value = 'Hoganville';
      document.querySelector('#opsAppendStation').click();
      station.value = 'Cannon View';
      const after = document.querySelector('#opsInsertAfter');
      after.value = document.querySelector('[data-station="Berwick Hall"]').id;
      after.dispatchEvent(new Event('change'));
      document.querySelector('#opsInsertStation').click(); true`);
    const editedStops = ['Berwick Hall', 'Cannon View', 'Atkinson Junction', 'La Vista', 'Brookfield Lawn', 'Foxton',
      'New Cottage', 'Whitebranch', 'Hoganville'];
    assert.deepEqual(await stopNames(), editedStops);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
    await evaluate(`document.querySelector('#opsAdvanced').checked = true;
      document.querySelector('#trainEdit button[value="edit"]').click();
      document.querySelector('#opsPreview').click(); true`);
    await until('!document.querySelector("#opsPublish").disabled');
    assert.deepEqual(await evaluate('window.previewActions[0].stops'), editedStops);
    assert.equal(await evaluate('window.previewActions[0].anchor'), 2);
    assert.equal(await evaluate('window.previewActions[0].advanced'), true);
    await evaluate('document.querySelector("#opsDiscard").click(); true');
    await evaluate(`const action = document.getElementById('opsAction'); action.value = 'restore';
      action.dispatchEvent(new Event('change')); document.getElementById('operationsAction').requestSubmit();
      document.getElementById('opsPreview').click(); true`);
    await until('!document.getElementById("opsPublish").disabled');
    await evaluate('document.getElementById("opsPublish").click(); true');
    await until('document.getElementById("adminMessage").textContent.includes("Revision 2 published")');
  }
  await send('Page.navigate', { url: `${origin}/status.html?closedStation=Newkirk` });
  await until('document.querySelector("[data-closed-station=Newkirk]")?.textContent.includes("Closed for construction")');
  await until('document.querySelector("#stationStatusList [data-closed-station=Newkirk]")?.open');
  await until('document.querySelector("[data-service-id=F-local]")?.textContent.includes("Rerouted Service")');
  await send('Page.navigate', { url: `${origin}/status.html?test-stations=empty` });
  await until('document.querySelector(".station-status-empty")?.textContent.includes("No stations are currently closed")');
  for (const width of [390, 1360]) {
    const scenario = width < 700 ? 'late' : 'early';
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 700 });
    await send('Page.navigate', { url: `${origin}/status.html?closedStation=Oakville%20City%20Airport&test-splash&test-stations=${scenario}` });
    await until('!!document.querySelector("#splash-screen")');
    assert.equal(await evaluate('document.querySelector("#splash-version").textContent'), 'V83 - 11/22/26');
    const airport = `document.querySelector('[data-notice-id="airport"]')`;
    if (scenario === 'late') {
      await until('!document.querySelector("#splash-screen") && !!window.releaseOperations');
      assert.equal(await evaluate(`!!${airport}`), false);
      await evaluate('window.releaseOperations()');
    } else {
      await until(`!!${airport}`);
      assert.equal(await evaluate(`${airport}.open`), false);
      assert.equal(await evaluate(`getComputedStyle(${airport}.querySelector('.station-notice-details')).display !== 'none' && ${airport}.querySelector('.station-notice-details').checkVisibility()`), false);
    }
    await until(`!document.querySelector('#splash-screen') && ${airport}?.open`);
    assert.deepEqual(await evaluate(`Array.from(${airport}.querySelectorAll('summary img'), image => image.alt)`), ['(A)', '<A>', '(D)', '(C)']);
    assert.match(await evaluate(`${airport}.querySelector('.station-notice-details').textContent`), /Reason: Closed for construction/);
    assert.ok(await evaluate(`${airport}.getAnimations().length > 0`), 'Notification target should highlight');
    await evaluate(`${airport}.querySelector('summary').click(); window.dispatchEvent(new Event('borail:operations'));`);
    assert.equal(await evaluate(`${airport}.open`), false, 'A refresh should respect a manually collapsed row');
    await evaluate(`${airport}.querySelector('summary').click()`);
    assert.equal(await evaluate(`${airport}.open`), true);
    assert.match(await evaluate('document.querySelector("#stationStatusList").textContent'), /Scheduled Closures.*Recently Reopened/s);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);

    await send('Page.navigate', { url: `${origin}/index.html?test-arrivals-error` });
    await until('document.querySelector("#arrivals")?.textContent.includes("temporarily unavailable")');
    for (const [tab, panel] of [['tripPlannerTab', 'tripPlannerView'], ['liveMapTab', 'liveMapView'], ['upcomingTab', 'upcomingView']]) {
      const point = await evaluate(`(() => {
        const rect = document.getElementById('${tab}').getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      })()`);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...point });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
      assert.equal(await evaluate(`!document.getElementById('${panel}').hidden && document.getElementById('${tab}').getAttribute('aria-selected') === 'true'`), true);
    }
    await send('Page.navigate', { url: `${origin}/index.html` });
    await until('!!document.querySelector(".stops-list")');
    assert.deepEqual(await evaluate(`(() => {
      const fixtures = [['stops-list', 'stop-item'], ['trip-stop-timeline', 'trip-stop'], ['live-map-stop-timeline', 'live-map-stop-item']];
      return fixtures.map(([timelineClass, rowClass]) => {
        const timeline = Object.assign(document.createElement('div'), { className: timelineClass });
        const row = Object.assign(document.createElement('div'), { className: rowClass, textContent: 'Station' });
        timeline.append(row);
        document.body.append(timeline);
        const dot = getComputedStyle(row, '::before');
        const stroke = timeline.getBoundingClientRect().left + parseFloat(getComputedStyle(timeline).borderLeftWidth) / 2;
        const center = row.getBoundingClientRect().left + parseFloat(dot.left) + new DOMMatrixReadOnly(dot.transform).m41 + parseFloat(dot.width) / 2;
        timeline.remove();
        return Math.abs(center - stroke) < 0.5;
      });
    })()`), [true, true, true]);
  }
  await send('Page.navigate', { url: `${origin}/index.html` });
  await until('window.BORailLiveMapDebug && window.BORailOperationsClient?.synced === true');
  assert.equal(await evaluate(`BORailLiveMapDebug.getPathPoints('B', 'Northbound', ['Groveton','Madisonboro','Hutchinson Point','Vanwood']).length > 4`), true);
  assert.equal(await evaluate(`(() => {
    const date = BORailTime.fromWallTime('2026-11-23', '01:00');
    const trains = BORailLiveMapDebug.getActiveTrainSnapshots(date);
    return trains.length > 0 && trains.every(train => !train.isExpress) &&
      BORailTripDebug.arrivalsForStation('Alpherst', date).length > 0;
  })()`), true);
  await send('Page.navigate', { url: `${origin}/map.html` });
  await until('document.querySelector(\'a[href="map-viewer.html?map=regular"] + .map-caption\')?.textContent === "7:30PM - 6:00AM & 9:30AM - 5:00PM Service Hours"');
  await until('!!navigator.serviceWorker.controller');
  assert.equal(await evaluate(`(async () => {
    const cache = await caches.open('borail-v83');
    const assets = ['assets/js/time.js', 'assets/js/schedule.js', 'assets/js/timetable.js', 'assets/js/status.js',
      'assets/css/timetable.css', 'assets/css/status.css', 'assets/js/pwa.js'];
    const results = await Promise.all(assets.map(asset => cache.match(asset + '?v=83')));
    return results.every(Boolean);
  })()`), true, 'Release-specific assets should be available offline');
  assert.deepEqual(exceptions, []);
  console.log('Verified operations, station alert expansion, timetable failure recovery, and timeline alignment at mobile and desktop widths.');
} finally {
  socket?.close();
  chrome.kill();
  www.closeAllConnections();
  www.close();
}
