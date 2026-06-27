import assert from 'node:assert/strict';

const endpoint = process.env.BORAIL_CDP_URL || 'http://127.0.0.1:9223/json/list';
const targets = await fetch(endpoint).then(response => response.json());
const target = targets.find(item => item.type === 'page');
assert.ok(target, 'A headless Chrome page must be running.');

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

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

await send('Runtime.enable');
await send('Page.enable');
await send('Storage.clearDataForOrigin', {
  origin: 'http://127.0.0.1:8766',
  storageTypes: 'all'
});
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: 'http://127.0.0.1:8766/mybocard.html' });
await wait(900);
await evaluate(`MyBOCardDebug.reset()`);
await wait(100);

assert.equal(await evaluate('document.title'), 'MyBOCard');
assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.tabbar span')).map(span => span.textContent.trim())`), [
  'Timetable',
  'MyBOCard',
  'Map',
  'Information',
  'Status'
]);
assert.equal(await evaluate(`document.querySelector('.tabbar a.active span').textContent.trim()`), 'MyBOCard');
assert.equal(await evaluate(`getComputedStyle(document.getElementById('paymentModal')).display`), 'none');
assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.tabbar a.active img')).filter`), 'none');
assert.equal(await evaluate(`MyBOCardDebug.constants.STATIONS.length`), 70);
assert.equal(await evaluate(`MyBOCardDebug.getState().balance`), 12.5);
assert.equal(await evaluate(`MyBOCardDebug.getState().history.length`), 3);

await evaluate(`(() => {
  MyBOCardDebug.setState({
    balance: 12.5,
    history: [{ station: 'Newkirk', timestamp: Date.now(), balanceAfter: 12.5 }]
  });
  return true;
})()`);
assert.ok(await evaluate(`document.querySelectorAll('.history-row .line-badges img').length`) >= 4);

await evaluate(`document.querySelector('[data-amount="10"]').click()`);
await evaluate(`document.getElementById('confirmPaymentButton').click()`);
await wait(2600);
assert.equal(await evaluate(`MyBOCardDebug.getState().balance`), 22.5);
assert.equal(await evaluate(`document.getElementById('paymentModal').hidden`), true);
assert.equal(await evaluate(`getComputedStyle(document.getElementById('paymentModal')).display`), 'none');
await send('Page.reload', { ignoreCache: true });
await wait(800);
assert.equal(await evaluate(`MyBOCardDebug.getState().balance`), 22.5);

await evaluate(`document.getElementById('tapCardButton').click()`);
await wait(3900);
const postTap = await evaluate(`MyBOCardDebug.getState()`);
assert.equal(postTap.balance, 20);
assert.equal(postTap.history.length, 2);
assert.equal(await evaluate(`document.getElementById('cardBalanceText').textContent`), '$20.00');

await evaluate(`(() => {
  MyBOCardDebug.setState({ balance: 1, history: [] });
  document.getElementById('tapCardButton').click();
  return true;
})()`);
await wait(3600);
assert.equal(await evaluate(`MyBOCardDebug.getState().balance`), 1);
assert.equal(await evaluate(`MyBOCardDebug.getState().history.length`), 0);
assert.match(await evaluate(`document.getElementById('tapStatus').textContent`), /Add money|Insufficient/);

await evaluate(`(() => {
  MyBOCardDebug.setState({ balance: 499, history: [] });
  document.querySelector('[data-amount="100"]').click();
  document.getElementById('confirmPaymentButton').click();
  return true;
})()`);
await wait(300);
assert.equal(await evaluate(`MyBOCardDebug.getState().balance`), 499);
assert.match(await evaluate(`document.getElementById('reloadAlert').textContent`), /card limit/);

await send('Emulation.setTouchEmulationEnabled', { enabled: false });
await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 820, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:8766/mybocard.html?desktop=1' });
await wait(900);
await evaluate(`MyBOCardDebug.setState({ balance: 10, history: [] })`);
assert.equal(await evaluate(`document.getElementById('tapCardButton').disabled`), true);
assert.match(await evaluate(`document.getElementById('tapStatus').textContent`), /mobile devices/);
await evaluate(`document.getElementById('tapCardButton').click()`);
await wait(2600);
assert.equal(await evaluate(`MyBOCardDebug.getState().balance`), 10);

socket.close();
console.log('MyBOCard browser smoke test passed.');
