(function initializeAdmin(root) {
  'use strict';

  const byId = id => document.getElementById(id);
  const data = root.BORailSettingsData;
  const clock = root.BORailTime;
  const client = root.BORailOperationsClient;
  const login = byId('adminLogin');
  const password = byId('adminPassword');
  const dashboard = byId('operationsDashboard');
  const message = byId('adminMessage');
  const kind = byId('opsKind');
  const actionSelect = byId('opsAction');
  const publish = byId('opsPublish');
  const trainEditor = byId('trainEdit');
  const stopList = byId('opsTrainStops');
  const stationSelect = byId('opsTrainStation');
  const insertAfter = byId('opsInsertAfter');
  const insertStation = byId('opsInsertStation');
  const base = root.BORailNotificationConfig.apiBase;
  const families = [...new Set(data.services.filter(item => item.id.endsWith('express')).map(item => item.id[0]))]
    .map(id => ({ id, label: `All ${id} services` }));
  const stationOptions = data.stations.map(item => ({ id: item.name, label: item.name }));
  let token = '';
  let revision = 0;
  let draft = [];
  let selectedRun = null;
  let sessionTimer;
  let nextStopId = 0;
  let drag = null;

  function choices(select, options, placeholder) {
    select.replaceChildren(...(placeholder ? [new Option(placeholder, '')] : []),
      ...options.map(option => new Option(option.label, option.id)));
  }

  function signOut() {
    root.clearTimeout(sessionTimer);
    token = '';
    dashboard.hidden = true;
    byId('adminSignIn').hidden = false;
    byId('adminSignIn').setAttribute('aria-expanded', 'false');
    login.hidden = true;
    draft = [];
    closeTrainEditor();
    byId('opsTrainResults').replaceChildren();
  }

  async function api(path, body) {
    const url = new URL(`${base}/admin/operations/${path}`);
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000)
    });
    const result = await response.json();
    if (response.status === 401 && token) signOut();
    if (!response.ok) throw Error(result.error || 'The operations service could not complete the request.');
    return result;
  }

  const present = item => item.kind === 'system' ? 'Entire system' :
    [...data.services, ...families].find(option => option.id === item.target)?.label || item.target;

  function line(container, value, tag = 'p') {
    const element = document.createElement(tag);
    element.textContent = value;
    container.append(element);
    return element;
  }

  const describe = item => `${item.restore ? 'Restore' : item.cancel ? 'Cancel' : item.kind === 'train' ? 'Edit' : 'Close'} ${present(item)}`;

  function redrawDraft() {
    const list = byId('adminDraft');
    list.replaceChildren();
    byId('opsPreviewResults').replaceChildren();
    publish.disabled = true;
    if (!draft.length) line(list, 'No draft changes.');
    draft.forEach((item, index) => {
      const row = line(list, describe(item));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        draft.splice(index, 1);
        redrawDraft();
      });
      row.append(' ', remove);
    });
  }

  async function loadOverview() {
    const state = await api('overview');
    revision = state.revision;
    const host = byId('adminOverview');
    host.replaceChildren();
    line(host, `Revision ${revision}${state.publishedAt ? ` · Published ${client.timeLabel(state.publishedAt)}` : ''}`);
    const now = Date.now();
    line(host, state.changes.some(item => item.kind === 'system' && root.BORailOperations.active(item, now))
      ? 'System Closed' : 'System operating on its current schedule');
    state.changes.filter(item => item.endsAt == null || item.endsAt > now)
      .forEach(item => line(host, `${present(item)} · ${item.startsAt > now ? `Starts ${client.timeLabel(item.startsAt)}` : 'Effective'}${item.reason ? ` · ${item.reason}` : ''}${item.endsAt && item.kind !== 'train' ? ` · Ends ${client.timeLabel(item.endsAt)}` : ''}`));
    const history = byId('adminHistory');
    history.replaceChildren();
    if (!state.history.length) line(history, 'No published changes yet.');
    state.history.forEach(entry => entry.actions.forEach(item => line(history,
      `${client.timeLabel(entry.publishedAt)} · ${describe(item)}${item.reason ? ` · ${item.reason}` : ''}`)));
    state.changes.filter(item => item.kind !== 'train' && item.endsAt && item.endsAt <= now && item.endsAt > item.startsAt)
      .forEach(item => line(history, `${client.timeLabel(item.endsAt)} · ${present(item)} reopened or reactivated`));
  }

  function runAction(button, operation) {
    return async event => {
      event.preventDefault();
      button.disabled = true;
      message.textContent = '';
      try { await operation(event); }
      catch (error) { message.textContent = error.message; }
      finally { button.disabled = false; }
    };
  }

  function optionalDate(id) {
    const value = byId(id).value;
    if (!value) return null;
    const [day, time] = value.split('T');
    const date = clock.fromWallTime(day, time);
    if (!date) throw Error('Choose a valid Eastern date and time.');
    return +date;
  }

  function updateActionFields() {
    const restoring = actionSelect.value === 'restore';
    byId('opsTargetLabel').hidden = kind.value === 'system';
    byId('opsReasonLabel').hidden = restoring;
    byId('opsEndLabel').hidden = restoring;
    byId('opsRecoveryLabel').hidden = kind.value !== 'system';
    byId('opsReason').required = !restoring;
  }

  function updateTargets() {
    choices(byId('opsTarget'), kind.value === 'station' ? stationOptions : [...data.services, ...families]);
    updateActionFields();
  }

  function renderStopControls() {
    const rows = Array.from(stopList.children);
    const previous = insertAfter.value;
    rows.forEach((row, index) => {
      row.querySelector('.ops-stop-number').textContent = index + 1;
      row.querySelector('[data-stop-action="up"]').disabled = index === 0;
      row.querySelector('[data-stop-action="down"]').disabled = index === rows.length - 1;
    });
    choices(insertAfter, rows.map((row, index) => ({ id: row.id, label: `${index + 1}. ${row.dataset.station}` })), 'Choose a stop');
    insertAfter.value = rows.some(row => row.id === previous) ? previous : '';
    insertAfter.disabled = !rows.length;
    insertStation.disabled = !insertAfter.value;
    stopList.hidden = !rows.length;
    byId('opsStopEmpty').hidden = !!rows.length;
  }

  function makeStop(station) {
    const row = document.createElement('li');
    row.className = 'ops-stop-row';
    row.id = `ops-stop-${++nextStopId}`;
    row.dataset.station = station;
    const handle = line(row, '⠿', 'span');
    handle.className = 'ops-stop-handle';
    handle.setAttribute('aria-hidden', 'true');
    const number = line(row, '', 'span');
    number.className = 'ops-stop-number';
    number.setAttribute('aria-hidden', 'true');
    line(row, station, 'span').className = 'ops-stop-name';
    const actions = line(row, '', 'div');
    actions.className = 'ops-stop-actions';
    for (const [action, symbol, label] of [['up', '↑', 'Move up'], ['down', '↓', 'Move down'], ['remove', '×', 'Remove']]) {
      const button = line(actions, symbol, 'button');
      button.type = 'button';
      button.dataset.stopAction = action;
      button.title = `${label} ${station}`;
      button.setAttribute('aria-label', button.title);
    }
    return row;
  }

  function revealStop(row) {
    const bounds = stopList.getBoundingClientRect();
    const rect = row.getBoundingClientRect();
    if (rect.top < bounds.top + 4) stopList.scrollTop += rect.top - bounds.top - 4;
    else if (rect.bottom > bounds.bottom - 4) stopList.scrollTop += rect.bottom - bounds.bottom + 4;
  }

  function announceStop(row, verb) {
    const position = Array.from(stopList.children).indexOf(row) + 1;
    byId('opsStopStatus').textContent = `${row.dataset.station} ${verb} at stop ${position} of ${stopList.children.length}.`;
  }

  function addStop(after) {
    if (!stationSelect.value) return;
    const row = makeStop(stationSelect.value);
    stopList.insertBefore(row, after?.nextElementSibling ?? null);
    renderStopControls();
    revealStop(row);
    announceStop(row, 'added');
  }

  stopList.addEventListener('click', event => {
    const button = event.target.closest('[data-stop-action]');
    if (!button) return;
    const row = button.closest('.ops-stop-row');
    const { stopAction } = button.dataset;
    if (stopAction === 'remove') {
      const sibling = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      renderStopControls();
      (sibling?.querySelector('[data-stop-action="remove"]') || stationSelect).focus();
      byId('opsStopStatus').textContent = `${row.dataset.station} removed.`;
    } else {
      const before = stopAction === 'up' ? row.previousElementSibling : row.nextElementSibling?.nextElementSibling;
      stopList.insertBefore(row, before ?? null);
      renderStopControls();
      (button.disabled ? row.querySelector('button:not(:disabled)') : button).focus({ preventScroll: true });
      revealStop(row);
      announceStop(row, 'now');
    }
  });

  function updateDropTarget() {
    const bounds = stopList.getBoundingClientRect();
    const inside = drag.x >= bounds.left && drag.x <= bounds.right && drag.y >= bounds.top && drag.y <= bounds.bottom;
    const before = inside ? Array.from(stopList.children).find(row => {
      const rect = row.getBoundingClientRect();
      return drag.y < rect.top + rect.height / 2;
    }) || null : null;
    const canDrop = inside && before !== drag.row && before !== drag.row.nextElementSibling;
    const marker = canDrop ? before || stopList.lastElementChild : null;
    if (marker !== drag.marker) drag.marker?.removeAttribute('data-drop');
    if (marker) marker.dataset.drop = before ? 'before' : 'after';
    Object.assign(drag, { before, canDrop, marker });
  }

  function scrollWhileDragging() {
    const bounds = stopList.getBoundingClientRect();
    if (drag.x >= bounds.left && drag.x <= bounds.right && drag.y >= bounds.top && drag.y <= bounds.bottom) {
      const edge = Math.min(40, bounds.height / 3);
      const speed = (Math.max(0, drag.y - bounds.bottom + edge) - Math.max(0, bounds.top + edge - drag.y)) / 3;
      const previous = stopList.scrollTop;
      if (speed) stopList.scrollTop += speed;
      if (stopList.scrollTop !== previous) updateDropTarget();
    }
    drag.frame = root.requestAnimationFrame(scrollWhileDragging);
  }

  function finishStopDrag(commit = false) {
    if (!drag) return;
    const { row, handle, pointerId, before, canDrop, marker, frame } = drag;
    drag = null;
    root.cancelAnimationFrame(frame);
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    marker?.removeAttribute('data-drop');
    row.classList.remove('is-dragging');
    stopList.classList.remove('is-dragging');
    if (commit && canDrop) {
      stopList.insertBefore(row, before);
      renderStopControls();
      announceStop(row, 'now');
    }
  }

  stopList.addEventListener('pointerdown', event => {
    const handle = event.target.closest('.ops-stop-handle');
    if (!handle || drag || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    const row = handle.closest('.ops-stop-row');
    handle.setPointerCapture(event.pointerId);
    drag = { row, handle, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    row.classList.add('is-dragging');
    stopList.classList.add('is-dragging');
    updateDropTarget();
    drag.frame = root.requestAnimationFrame(scrollWhileDragging);
  });

  for (const type of ['pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
    stopList.addEventListener(type, event => {
      if (drag?.pointerId !== event.pointerId) return;
      if (type === 'pointermove' || type === 'pointerup') {
        drag.x = event.clientX;
        drag.y = event.clientY;
        updateDropTarget();
      }
      if (type !== 'pointermove') finishStopDrag(type === 'pointerup');
    });
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') finishStopDrag();
  });

  function closeTrainEditor() {
    finishStopDrag();
    trainEditor.hidden = true;
    selectedRun = null;
  }

  byId('adminSignIn').addEventListener('click', event => {
    login.hidden = !login.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!login.hidden));
    if (!login.hidden) {
      login.animate?.([{ opacity: 0, transform: 'translateY(-5px)' }, { opacity: 1, transform: 'translateY(0)' }], 180);
      password.focus();
    }
  });
  byId('showAdminPassword').addEventListener('click', event => {
    password.type = password.type === 'password' ? 'text' : 'password';
    event.currentTarget.textContent = password.type === 'password' ? 'Show password' : 'Hide password';
  });
  login.addEventListener('submit', runAction(login.querySelector('[type=submit]'), async () => {
    const entered = password.value;
    password.value = '';
    const session = await api('login', { password: entered });
    token = session.token;
    await loadOverview();
    byId('adminSignIn').hidden = true;
    login.hidden = true;
    dashboard.hidden = false;
    redrawDraft();
    sessionTimer = root.setTimeout(() => {
      signOut();
      message.textContent = 'Session expired. Sign in again to make changes.';
    }, Math.max(0, session.expiresAt - Date.now()));
  }));
  byId('adminLogout').addEventListener('click', runAction(byId('adminLogout'), async () => {
    try { await api('logout', {}); }
    finally { signOut(); }
  }));

  kind.addEventListener('change', updateTargets);
  actionSelect.addEventListener('change', updateActionFields);
  byId('operationsAction').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const restore = actionSelect.value === 'restore';
      draft.push({ kind: kind.value, target: byId('opsTarget').value, restore,
        startsAt: optionalDate('opsStart'), endsAt: restore ? null : optionalDate('opsEnd'),
        reason: restore ? '' : byId('opsReason').value, recoveryMinutes: Number(byId('opsRecovery').value) });
      redrawDraft();
      message.textContent = 'Added to draft.';
    } catch (error) { message.textContent = error.message; }
  });

  choices(byId('opsTrainService'), data.services, 'All services');
  choices(byId('opsTrainOrigin'), stationOptions, 'Any origin');
  choices(byId('opsTrainDestination'), stationOptions, 'Any destination');
  choices(stationSelect, stationOptions);
  byId('opsTrainDate').value = clock.dateKey();
  const search = byId('trainSearch');
  search.addEventListener('submit', runAction(search.querySelector('button'), async () => {
    const query = new URLSearchParams({
      date: byId('opsTrainDate').value, after: byId('opsTrainTime').value, service: byId('opsTrainService').value,
      direction: byId('opsTrainDirection').value, origin: byId('opsTrainOrigin').value, destination: byId('opsTrainDestination').value
    });
    const { runs, total } = await api(`runs?${query}`);
    const results = byId('opsTrainResults');
    results.replaceChildren();
    closeTrainEditor();
    if (!runs.length) line(results, 'No matching active or upcoming trains.');
    if (total > runs.length) line(results, `Showing ${runs.length} of ${total}. Narrow the search for later results.`);
    runs.forEach(run => {
      const button = line(results, `${run.canceled ? 'Canceled' : run.locked ? 'Active' : 'Upcoming'} · ${present({ target: root.BORailOperations.serviceKey(run) })} · ${run.origin} → ${run.destination} · ${client.timeLabel(
        root.BORailOperations.serviceDayStart(clock.fromWallTime(query.get('date'), '12:00')) + run.departureMin * 60000)}`, 'button');
      button.type = 'button';
      button.addEventListener('click', () => {
        finishStopDrag();
        selectedRun = run;
        const locked = run.stops.slice(0, run.locked).map(stop => stop.name);
        byId('opsTrainLocked').textContent = locked.length ? `Route locked through ${locked.at(-1)}.` : 'This train has yet to depart.';
        stopList.replaceChildren(...run.stops.slice(run.locked).map(stop => makeStop(stop.name)));
        byId('opsStopStatus').textContent = '';
        renderStopControls();
        trainEditor.hidden = false;
        stopList.scrollTop = 0;
        (stopList.hidden ? stationSelect : stopList).focus();
      });
    });
  }));
  byId('opsAppendStation').addEventListener('click', () => addStop());
  insertAfter.addEventListener('change', () => { insertStation.disabled = !insertAfter.value; });
  insertStation.addEventListener('click', () => {
    const after = byId(insertAfter.value);
    if (after) addStop(after);
  });
  trainEditor.addEventListener('submit', event => {
    event.preventDefault();
    if (!selectedRun) return;
    const advanced = byId('opsAdvanced').checked;
    if (advanced && !root.confirm('Allow this train to detour or reverse on connected rails?')) return;
    draft.push({
      kind: 'train', target: selectedRun.id, anchor: selectedRun.locked, advanced,
      restore: event.submitter?.value === 'restore', cancel: event.submitter?.value === 'cancel',
      stops: Array.from(stopList.children, row => row.dataset.station)
    });
    redrawDraft();
    message.textContent = 'Added train to draft.';
  });

  byId('opsDiscard').addEventListener('click', () => { draft = []; redrawDraft(); });
  byId('opsPreview').addEventListener('click', runAction(byId('opsPreview'), async () => {
    publish.disabled = true;
    await loadOverview();
    const { summary, notices = [] } = await api('preview', { revision, actions: draft });
    const results = byId('opsPreviewResults');
    results.replaceChildren();
    for (const item of summary) {
      line(results, `${describe(item)} · ${client.timeLabel(item.startsAt)}${item.reason ? ` · ${item.reason}` : ''}`);
      item.impacts?.forEach(([id, impact]) => line(results, `${present({ target: id })} · ${impact.type.replaceAll('-', ' ')} · ${impact.reason}`));
      if (item.run) {
        const date = clock.fromWallTime(item.target.slice(-10), '12:00');
        const day = root.BORailOperations.serviceDayStart(date);
        line(results, item.run.stops.map(stop => `${stop.name} (${client.timeLabel(day + stop.scheduledArrivalSec * 1000)})`).join(' → '));
      } else if (item.cancel && item.locked?.length) {
        line(results, `Active train will end at ${item.locked.at(-1)}.`);
      }
    }
    if (notices.length) line(results, 'Notification Preview', 'h3');
    notices.forEach(notice => {
      line(results, notice.title, 'strong');
      line(results, notice.body);
    });
    publish.disabled = false;
  }));
  publish.addEventListener('click', async () => {
    if (!root.confirm('Publish these service changes to BORail?')) return;
    publish.disabled = true;
    try {
      const result = await api('publish', { revision, actions: draft });
      draft = [];
      redrawDraft();
      message.textContent = `Revision ${result.revision} published.`;
      await Promise.all([loadOverview(), client.refresh()]);
    } catch (error) {
      message.textContent = `${error.message} Preview the draft again before publishing.`;
    }
  });
  updateTargets();
})(globalThis);
