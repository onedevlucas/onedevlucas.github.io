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
const temp = await mkdtemp(path.join(tmpdir(), 'borail-v81-'));
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
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Seoul' });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    sessionStorage.setItem('borailAppSplashSeen', '1');
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
      if (url.pathname.endsWith('/preview')) return Promise.resolve(Response.json({ summary: [{ ...closure, restore: true }] }));
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
  console.log('Checked admin sign-in, preview and publish flows at mobile and desktop widths, Status and B Live Map geometry.');
} finally {
  socket?.close();
  chrome.kill();
  www.closeAllConnections();
  www.close();
}
