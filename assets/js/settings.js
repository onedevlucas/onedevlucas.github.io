(function initializeBORailSettings(root) {
  'use strict';

  const DATA = root.BORailSettingsData;
  const CONFIG = root.BORailNotificationConfig || { apiBase: '' };
  if (!DATA) throw new Error('BORailSettingsData must load before settings.js');

  const STORAGE_KEY = 'borail_notification_preferences_v1';
  const DEVICE_KEY = 'borail_notification_device_v1';
  const DEFAULT_ALERTS = Object.freeze({
    lineNoService: true,
    lineMinor: true,
    lineMajor: true,
    lineNormalResumed: true,
    stationElevatorOutage: true,
    stationElevatorFixed: true,
    winterEmergency: true
  });

  const elements = {
    statePill: document.getElementById('notificationStatePill'),
    stateMessage: document.getElementById('notificationStateMessage'),
    syncNote: document.getElementById('notificationSyncNote'),
    enable: document.getElementById('enableNotifications'),
    disable: document.getElementById('disableNotifications'),
    installHelpButton: document.getElementById('installHelpButton'),
    installHelp: document.getElementById('installHelp'),
    linePicker: document.getElementById('linePicker'),
    stationSearch: document.getElementById('stationSearch'),
    stationPicker: document.getElementById('stationPicker'),
    selectedStations: document.getElementById('selectedStations'),
    selectAllLines: document.getElementById('selectAllLines'),
    clearLines: document.getElementById('clearLines'),
    clearStations: document.getElementById('clearStations'),
    deleteData: document.getElementById('deleteNotificationData')
  };

  const safeJson = (value, fallback) => {
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const loadJson = (key, fallback) => safeJson(localStorage.getItem(key), fallback);
  const saveJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const uniqueAllowed = (items, allowed) => Array.from(new Set(Array.isArray(items) ? items : [])).filter(item => allowed.has(item));

  const serviceIds = new Set(DATA.services.map(service => service.id));
  const stationNames = new Set(DATA.stations.map(station => station.name));
  const storedValue = loadJson(STORAGE_KEY, {});
  const stored = storedValue && typeof storedValue === 'object' ? storedValue : {};
  let preferences = {
    services: uniqueAllowed(stored.services, serviceIds),
    stations: uniqueAllowed(stored.stations, stationNames),
    alerts: { ...DEFAULT_ALERTS, ...(stored.alerts || {}) }
  };
  let device = loadJson(DEVICE_KEY, null);
  let syncTimer = 0;

  function apiBase() {
    return String(CONFIG.apiBase || '').replace(/\/$/, '');
  }

  function persistPreferences() {
    saveJson(STORAGE_KEY, preferences);
  }

  function setSyncNote(message = '', error = false) {
    elements.syncNote.textContent = message;
    elements.syncNote.classList.toggle('error', error);
  }

  function setState(label, message, className = '') {
    elements.statePill.textContent = label;
    elements.statePill.className = `state-pill ${className}`.trim();
    elements.stateMessage.textContent = message;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return root.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  }

  function supportsPush() {
    return 'serviceWorker' in navigator && 'PushManager' in root && 'Notification' in root;
  }

  async function registration() {
    await navigator.serviceWorker.register('sw.js');
    return navigator.serviceWorker.ready;
  }

  async function currentSubscription() {
    if (!supportsPush()) return null;
    try { return (await registration()).pushManager.getSubscription(); }
    catch { return null; }
  }

  function base64UrlToUint8Array(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from(raw, character => character.charCodeAt(0));
  }

  async function apiRequest(path, options = {}) {
    const base = apiBase();
    if (!base) throw new Error('The BORail notification server still needs its one-time Cloudflare connection.');
    const response = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Notification server returned ${response.status}.`);
    return payload;
  }

  async function updateState() {
    elements.enable.hidden = false;
    elements.disable.hidden = true;
    if (!supportsPush()) {
      setState('Unsupported', 'This browser does not support BORail push notifications.', 'blocked');
      elements.enable.disabled = true;
      return;
    }
    if (Notification.permission === 'denied') {
      setState('Blocked', 'Notifications are blocked in this browser’s settings. Allow BORail notifications there, then return to this page.', 'blocked');
      elements.enable.disabled = true;
      return;
    }
    if (isIos() && !isStandalone()) {
      setState('Install BORail First - iPhone', 'Apple requires web push to be enabled from the BORail Home Screen app.', 'blocked');
      elements.enable.disabled = true;
      elements.installHelp.hidden = false;
      return;
    }
    const subscription = await currentSubscription();
    if (subscription && device?.id && device?.manageToken) {
      setState('Enabled', 'This device is subscribed. Favorite and alert changes save automatically.', 'enabled');
      elements.enable.hidden = true;
      elements.disable.hidden = false;
      elements.enable.disabled = false;
      return;
    }
    setState('Not Enabled', 'Enable notifications after choosing your favorite lines, stations, and alert types.');
    elements.enable.disabled = false;
    if (!apiBase()) setSyncNote('The page is ready; the one-time notification server connection must be completed before enabling.');
  }

  function renderLines() {
    elements.linePicker.innerHTML = DATA.services.map(service => {
      const selected = preferences.services.includes(service.id);
      return `<button class="line-choice" type="button" data-service-id="${service.id}" aria-pressed="${selected}">
        <img src="${service.icon}" alt="" />
        <span>${service.label}</span>
      </button>`;
    }).join('');
  }

  function renderSelectedStations() {
    if (!preferences.stations.length) {
      elements.selectedStations.innerHTML = '<span class="station-empty">No favorite stations selected.</span>';
      return;
    }
    elements.selectedStations.innerHTML = preferences.stations
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .map(name => `<button type="button" class="station-chip" data-remove-station="${name.replace(/"/g, '&quot;')}">${name}</button>`)
      .join('');
  }

  function renderStations() {
    const query = elements.stationSearch.value.trim().toLocaleLowerCase();
    const stations = DATA.stations.filter(station => station.name.toLocaleLowerCase().includes(query));
    if (!stations.length) {
      elements.stationPicker.innerHTML = '<div class="station-empty">No stations match that search.</div>';
      return;
    }
    elements.stationPicker.innerHTML = stations.map(station => {
      const selected = preferences.stations.includes(station.name);
      return `<button class="station-choice" type="button" data-station-name="${station.name.replace(/"/g, '&quot;')}" aria-pressed="${selected}">
        <span class="check" aria-hidden="true">✓</span>
        <span>${station.name}</span>
        ${station.accessible ? '<img src="assets/images/ui/accessibility.png" alt="Accessible station" />' : ''}
      </button>`;
    }).join('');
  }

  function renderAlerts() {
    document.querySelectorAll('[data-preference]').forEach(input => {
      input.checked = preferences.alerts[input.dataset.preference] !== false;
    });
  }

  function renderPreferences() {
    renderLines();
    renderSelectedStations();
    renderStations();
    renderAlerts();
  }

  async function syncPreferences() {
    if (!device?.id || !device?.manageToken || !apiBase()) return;
    setSyncNote('Saving notification choices…');
    try {
      await apiRequest(`/subscriptions/${encodeURIComponent(device.id)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${device.manageToken}` },
        body: JSON.stringify({ preferences })
      });
      setSyncNote('Notification choices saved.');
    } catch (error) {
      setSyncNote(error.message, true);
    }
  }

  function scheduleSync() {
    persistPreferences();
    root.clearTimeout(syncTimer);
    syncTimer = root.setTimeout(syncPreferences, 450);
  }

  async function enableNotifications() {
    elements.enable.disabled = true;
    setSyncNote('Connecting this device…');
    try {
      if (isIos() && !isStandalone()) throw new Error('Install BORail on your Home Screen before enabling notifications on iPhone.');
      if (!apiBase()) throw new Error('The one-time notification server connection has not been completed yet.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Notification permission was blocked.' : 'Notification permission was not granted.');

      const config = await apiRequest('/config');
      const serviceWorker = await registration();
      let subscription = await serviceWorker.pushManager.getSubscription();
      if (!subscription) {
        subscription = await serviceWorker.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(config.vapidPublicKey)
        });
      }
      const created = await apiRequest('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ subscription: subscription.toJSON(), preferences })
      });
      device = { id: created.id, manageToken: created.manageToken };
      saveJson(DEVICE_KEY, device);
      navigator.serviceWorker.controller?.postMessage({
        type: 'BORAIL_PUSH_CONFIG',
        apiBase: apiBase(),
        id: device.id,
        manageToken: device.manageToken
      });
      setSyncNote('Notifications enabled on this device.');
    } catch (error) {
      setSyncNote(error.message, true);
    } finally {
      elements.enable.disabled = false;
      await updateState();
    }
  }

  async function disableNotifications({ clearPreferences = false } = {}) {
    elements.disable.disabled = true;
    setSyncNote('Removing this device’s notification subscription…');
    try {
      if (device?.id && device?.manageToken && apiBase()) {
        await apiRequest(`/subscriptions/${encodeURIComponent(device.id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${device.manageToken}` }
        });
      }
      const subscription = await currentSubscription();
      if (subscription) await subscription.unsubscribe();
    } catch (error) {
      setSyncNote(`Local notifications were removed. Server cleanup can be retried later: ${error.message}`, true);
    } finally {
      device = null;
      localStorage.removeItem(DEVICE_KEY);
      if (clearPreferences) {
        preferences = { services: [], stations: [], alerts: { ...DEFAULT_ALERTS } };
        localStorage.removeItem(STORAGE_KEY);
        renderPreferences();
      }
      elements.disable.disabled = false;
      await updateState();
      if (!elements.syncNote.classList.contains('error')) setSyncNote(clearPreferences ? 'All notification data on this device was deleted.' : 'Notifications disabled. Your favorites remain saved on this device.');
    }
  }

  elements.linePicker.addEventListener('click', event => {
    const button = event.target.closest('[data-service-id]');
    if (!button) return;
    const id = button.dataset.serviceId;
    preferences.services = preferences.services.includes(id)
      ? preferences.services.filter(item => item !== id)
      : [...preferences.services, id];
    renderLines();
    scheduleSync();
  });

  elements.stationPicker.addEventListener('click', event => {
    const button = event.target.closest('[data-station-name]');
    if (!button) return;
    const name = button.dataset.stationName;
    preferences.stations = preferences.stations.includes(name)
      ? preferences.stations.filter(item => item !== name)
      : [...preferences.stations, name];
    renderSelectedStations();
    renderStations();
    scheduleSync();
  });

  elements.selectedStations.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-station]');
    if (!button) return;
    preferences.stations = preferences.stations.filter(item => item !== button.dataset.removeStation);
    renderSelectedStations();
    renderStations();
    scheduleSync();
  });

  document.querySelectorAll('[data-preference]').forEach(input => {
    input.addEventListener('change', () => {
      preferences.alerts[input.dataset.preference] = input.checked;
      scheduleSync();
    });
  });

  elements.stationSearch.addEventListener('input', renderStations);
  elements.selectAllLines.addEventListener('click', () => {
    preferences.services = DATA.services.map(service => service.id);
    renderLines();
    scheduleSync();
  });
  elements.clearLines.addEventListener('click', () => {
    preferences.services = [];
    renderLines();
    scheduleSync();
  });
  elements.clearStations.addEventListener('click', () => {
    preferences.stations = [];
    renderSelectedStations();
    renderStations();
    scheduleSync();
  });
  elements.installHelpButton.addEventListener('click', () => {
    elements.installHelp.hidden = !elements.installHelp.hidden;
  });
  elements.enable.addEventListener('click', enableNotifications);
  elements.disable.addEventListener('click', () => disableNotifications());
  elements.deleteData.addEventListener('click', () => {
    if (root.confirm('Delete this device’s BORail notification subscription, favorites, and alert preferences?')) {
      disableNotifications({ clearPreferences: true });
    }
  });

  renderPreferences();
  updateState();
})(globalThis);
