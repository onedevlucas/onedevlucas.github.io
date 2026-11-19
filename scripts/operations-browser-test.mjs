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
  const file = path.join(root, new URL(request.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
  try {
    const content = await readFile(file);
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
    sessionStorage.setItem('borailSplashSeen', 'true');
    const realFetch = window.fetch;
    const closure = { id: 'newkirk', kind: 'station', target: 'Newkirk', reason: 'Closed for construction',
      startsAt: Date.now() - 30000, endsAt: null };
    const snapshot = { revision: 1, publishedAt: Date.now(), changes: [closure] };
    window.fetch = (input, init) => {
      const url = new URL(input, location.href);
      if (!url.hostname.endsWith('.workers.dev')) return realFetch(input, init);
      if (url.pathname === '/operations') return Promise.resolve(Response.json(snapshot));
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
  await until('document.querySelector("[data-service-id=F-local]")?.textContent.includes("Rerouted Service")');
  await send('Page.navigate', { url: `${origin}/index.html` });
  await until('window.BORailLiveMapDebug && window.BORailOperationsClient?.synced === true');
  assert.equal(await evaluate(`BORailLiveMapDebug.getPathPoints('B', 'Northbound', ['Groveton','Madisonboro','Hutchinson Point','Vanwood']).length > 4`), true);
  assert.deepEqual(exceptions, []);
  console.log('Checked mouse and touch reordering, drag scrolling and cancellation, keyboard controls, insert/remove/append, draft order, and existing operations flows.');
} finally {
  socket?.close();
  chrome.kill();
  www.closeAllConnections();
  www.close();
}
