import assert from 'node:assert/strict';

const endpoint = process.env.BORAIL_CDP_URL || 'http://127.0.0.1:9223/json/list';
const targets = await fetch(endpoint).then(response => response.json());
const target = targets.find(item => item.type === 'page' && item.url.includes('workbench.html'));
assert.ok(target, 'A headless Chrome tab with workbench.html must be running.');

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
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed.');
  return result.result.value;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

await send('Runtime.enable');
assert.equal(await evaluate('document.title'), 'BoRail Architect Workbench');
assert.equal(await evaluate(`document.querySelectorAll('.station-group').length`), 10);
assert.equal(await evaluate(`document.querySelectorAll('.rail-hit').length`), 9);
assert.equal(await evaluate(`getComputedStyle(document.querySelector('.search-control')).display`), 'none');
assert.equal(await evaluate(`document.querySelectorAll('.severity.error').length`), 0);

await evaluate(`document.querySelector('[data-object-id="station_newkirk"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
await wait(50);
assert.equal(await evaluate(`document.querySelector('[data-field="name"]').value`), 'Newkirk');

await evaluate(`(() => { const input=document.querySelector('[data-field="name"]'); input.value='Newkirk Central'; input.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
await wait(50);
assert.equal(await evaluate(`document.querySelector('[data-field="name"]').value`), 'Newkirk Central');
await evaluate(`document.getElementById('undoButton').click()`);
await wait(50);
assert.equal(await evaluate(`document.querySelector('[data-object-id="station_newkirk"] .station-name').textContent`), 'Newkirk');

await evaluate(`document.querySelector('[data-mode="preview"]').click()`);
await wait(50);
assert.equal(await evaluate(`getComputedStyle(document.querySelector('.toolbar')).display`), 'none');
assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.search-control')).display`), 'none');
await evaluate(`document.querySelector('[data-object-id="station_mount_river"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
await wait(50);
assert.equal(await evaluate(`document.getElementById('inspectorHeading').textContent`), 'Station information');

await evaluate(`document.querySelector('[data-mode="architect"]').click()`);
await evaluate(`document.querySelector('[data-tool="station"]').click()`);
await evaluate(`(() => { const svg=document.getElementById('mapCanvas'); const r=svg.getBoundingClientRect(); svg.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+r.width*.78,clientY:r.top+r.height*.24})); return true; })()`);
await wait(50);
assert.equal(await evaluate(`document.querySelectorAll('.station-group').length`), 11);
await evaluate(`document.getElementById('undoButton').click()`);
await wait(50);
assert.equal(await evaluate(`document.querySelectorAll('.station-group').length`), 10);

await evaluate(`document.querySelector('[data-tool="rail"]').click()`);
await evaluate(`(() => { const svg=document.getElementById('mapCanvas'); const r=svg.getBoundingClientRect(); const click=(x,y)=>svg.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+r.width*x,clientY:r.top+r.height*y})); click(.15,.75); click(.30,.68); document.getElementById('finishDrawingButton').click(); return true; })()`);
await wait(50);
assert.equal(await evaluate(`document.querySelectorAll('.rail-hit').length`), 10);
await evaluate(`document.getElementById('undoButton').click()`);
await wait(50);
assert.equal(await evaluate(`document.querySelectorAll('.rail-hit').length`), 9);

socket.close();
console.log('Workbench browser interaction tests passed.');
