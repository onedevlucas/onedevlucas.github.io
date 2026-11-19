(function initializeOperationsClient(root) {
  'use strict';
  const ops = root.BORailOperations;
  const api = root.BORailNotificationConfig?.apiBase;
  const storageKey = 'borail-operations-snapshot-v1';
  let snapshot = ops.empty;
  let syncing = false;
  let synced = false;
  let activeSignature = '';

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Number.isInteger(saved?.revision) && Array.isArray(saved.changes)) snapshot = saved;
  } catch { /* Storage may be unavailable. */ }

  function timeLabel(value) {
    return root.BORailTime.formatDateTime(value, {
      month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    });
  }

  function text(change) {
    return change?.reason ? `${change.reason}${change.endsAt ? ` · Expected end: ${timeLabel(change.endsAt)}` : ''}` : '';
  }

  function notify() {
    const active = snapshot.changes.filter(change => ops.active(change, Date.now())).map(change => change.id);
    const signature = JSON.stringify([snapshot.revision, active, synced]);
    if (signature === activeSignature) return;
    activeSignature = signature;
    root.dispatchEvent(new Event('borail:operations'));
  }

  async function refresh() {
    if (!api || syncing || document.hidden) return;
    syncing = true;
    try {
      const response = await fetch(`${api}/operations`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Operations unavailable');
      const next = await response.json();
      if (!Number.isInteger(next.revision) || next.revision < snapshot.revision || !Array.isArray(next.changes)) return;
      snapshot = next;
      synced = true;
      try { localStorage.setItem(storageKey, JSON.stringify(snapshot)); } catch { /* Optional offline copy. */ }
    } catch {
      synced = false;
    } finally {
      syncing = false;
      notify();
    }
  }

  root.BORailOperationsClient = Object.freeze({
    get snapshot() { return snapshot; },
    get synced() { return synced; },
    state(date = Date.now()) { return ops.atTime(snapshot, Number(date)); },
    refresh, timeLabel, text
  });
  setInterval(refresh, 15000);
  setInterval(() => { if (!document.hidden) notify(); }, 1000);
  document.addEventListener('visibilitychange', refresh);
  root.addEventListener('online', refresh);
  refresh();
})(globalThis);
