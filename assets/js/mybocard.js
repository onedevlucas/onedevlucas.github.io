(function () {
  'use strict';

  const STORAGE_KEY = 'borail_mybocard_v1';
  const FARE = 2.50;
  const MAX_BALANCE = 500;
  const INITIAL_BALANCE = 12.50;
  const AMOUNTS = [2.5, 5, 10, 20, 50, 100];

  const LINE_META = {
    A: { localIcon: 'assets/images/line-icons/a-local.png', expressIcon: 'assets/images/line-icons/a-express.png', order: 20 },
    B: { localIcon: 'assets/images/line-icons/b-local.png', expressIcon: 'assets/images/line-icons/b-express.png', order: 40 },
    C: { localIcon: 'assets/images/line-icons/c-local.png', expressIcon: null, order: 50 },
    D: { localIcon: 'assets/images/line-icons/d-local.png', expressIcon: null, order: 60 },
    E: { localIcon: 'assets/images/line-icons/e-local.png', expressIcon: null, order: 70 },
    F: { localIcon: 'assets/images/line-icons/f-local.png', expressIcon: 'assets/images/line-icons/f-express.png', order: 10 },
    G: { localIcon: 'assets/images/line-icons/g-local.png', expressIcon: null, order: 80 },
    S: { localIcon: 'assets/images/line-icons/s-local.png', expressIcon: 'assets/images/line-icons/s-express.png', order: 30 }
  };

  const ROUTE_STOPS = [
    { service: 'F', express: false, stops: ['Kenilworth','Garner','Atkinson Junction','Cambridge Central','Berwick Hall','Chelsea Bay','Bayview Park','Hoganville','Newkirk - Oak Street','Newkirk'] },
    { service: 'F', express: false, stops: ['Boylston','Brookfield Lawn','La Vista','Atkinson Junction','Cambridge Central','Berwick Hall','Chelsea Bay','Bayview Park','Hoganville','Newkirk - Oak Street','Newkirk'] },
    { service: 'F', express: true, stops: ['Whitebranch','New Cottage','Foxston','Brookfield Lawn','La Vista','Atkinson Junction','Berwick Hall','Hoganville','Newkirk - Oak Street','Newkirk'] },
    { service: 'G', express: false, stops: ['Bradford Bay','Bradford Square','Westpoint','Berwick Hall'] },
    { service: 'S', express: false, stops: ['Ralston-Finch East','Vanderburg','Djimar','Ivory Knolls','Cannon View','Rockcastle','Willow Springs','Burlington - University of NCU'] },
    { service: 'S', express: true, stops: ['Ralston-Finch East','Cannon View','Rockcastle','Willow Springs','Burlington - University of NCU','Newkirk - Oak Street','Newkirk'] },
    { service: 'A', express: false, stops: ['Mount River','Talmedge Hill','Oakville Plaza','Oakville Exchange','Oakville City Airport','Radcliff Fields','Atkins Bridge','Cannon View','Burlington - University of NCU','Newkirk'] },
    { service: 'A', express: true, stops: ['Mount River','Talmedge Hill','Oakville Plaza','Oakville Exchange','Oakville City Airport','Atkins Bridge','Cannon View','Willow Springs','Port Williamson'] },
    { service: 'D', express: false, stops: ['Oakville City Airport','Veridia Nexus'] },
    { service: 'C', express: false, stops: ['East Heights','Roxbury Landing','Millford Heights','New Salemview','Wood-by-Hike','Mount Hindsboro','Perry Road','Oakville City Airport'] },
    { service: 'C', express: false, stops: ['East Heights','Roxbury Landing','Millford Heights','New Salemview','Wood-by-Hike','Mount Hindsboro','Perry Road','Oakville Exchange','Oakville City Center','Oakville Plaza','Leighton Castle','Fort Meadow','Yoakum','Joplin','Fernwood'] },
    { service: 'E', express: false, stops: ['Santa Mora','Brandywine','Cherrywood','Grant Park','Scottsdale','Ameryville','Scottsbury','Tyford Farms','New Halifax','Alpherst','Roxbury Landing','East Heights'] },
    { service: 'B', express: false, stops: ['Leighton Castle','Oakville Plaza','Oakville City Center','Oakville Exchange','Perry Road','Mount Hindsboro','Greens Corner','Doverville','Orchard Ridge','Groveton','Madisonboro','Hutchinson Point','Vanwood','South Harrington','Harrington City'] },
    { service: 'B', express: true, stops: ['Hadleigh','Carrollton','Harrington City','Madisonboro','Greens Corner','Oakville Exchange','Oakville City Center','Oakville Plaza','Leighton Castle'] }
  ];

  const STATIONS = [
    'Newkirk','Newkirk - Oak Street','Hoganville','Bayview Park','Chelsea Bay','Berwick Hall',
    'Westpoint','Bradford Square','Bradford Bay','Cambridge Central','Atkinson Junction','Garner',
    'Kenilworth','La Vista','Brookfield Lawn','Boylston','Foxston','New Cottage','Whitebranch',
    'Burlington - University of NCU','Port Williamson','Willow Springs','Rockcastle','Cannon View',
    'Ivory Knolls','Djimar','Vanderburg','Ralston-Finch East','Atkins Bridge','Radcliff Fields',
    'Oakville City Airport','Veridia Nexus','Oakville Exchange','Oakville City Center','Oakville Plaza',
    'Leighton Castle','Fort Meadow','Yoakum','Joplin','Fernwood','Talmedge Hill','Mount River','Perry Road','Mount Hindsboro','Wood-by-Hike',
    'New Salemview','Millford Heights','Roxbury Landing','East Heights','Alpherst','New Halifax',
    'Tyford Farms','Scottsbury','Ameryville','Scottsdale','Grant Park','Cherrywood','Brandywine',
    'Santa Mora','Greens Corner','Doverville','Orchard Ridge','Groveton','Madisonboro','Hutchinson Point',
    'Vanwood','South Harrington','Harrington City','Carrollton','Hadleigh'
  ];

  const stationBadges = buildStationBadges();
  const els = {};
  let state = loadState();
  let selectedAmount = null;
  let busy = false;
  let cardTapEnabled = true;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheElements();
    bindEvents();
    render();
    exposeDebugApi();
  }

  function cacheElements() {
    els.walletShell = document.getElementById('walletShell');
    els.tapCardButton = document.getElementById('tapCardButton');
    els.tapStatus = document.getElementById('tapStatus');
    els.cardBalanceText = document.getElementById('cardBalanceText');
    els.balanceValue = document.getElementById('balanceValue');
    els.balanceMeter = document.getElementById('balanceMeter');
    els.lastStation = document.getElementById('lastStation');
    els.lastTapTime = document.getElementById('lastTapTime');
    els.amountGrid = document.getElementById('amountGrid');
    els.confirmPaymentButton = document.getElementById('confirmPaymentButton');
    els.reloadAlert = document.getElementById('reloadAlert');
    els.historyList = document.getElementById('historyList');
    els.historyCount = document.getElementById('historyCount');
    els.paymentModal = document.getElementById('paymentModal');
    els.paymentSpinner = document.getElementById('paymentSpinner');
    els.paymentCheck = document.getElementById('paymentCheck');
    els.paymentTitle = document.getElementById('paymentTitle');
    els.paymentMessage = document.getElementById('paymentMessage');
  }

  function bindEvents() {
    els.tapCardButton.addEventListener('click', handleTapToPay);
    window.addEventListener('resize', updateTapAvailability);

    els.amountGrid.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-amount]');
      if (!button || busy) return;
      selectAmount(Number(button.dataset.amount));
    });

    els.confirmPaymentButton.addEventListener('click', handleReload);
  }

  function buildStationBadges() {
    const map = new Map();

    for (const route of ROUTE_STOPS) {
      for (const stop of route.stops) {
        if (!map.has(stop)) map.set(stop, new Map());
        const key = `${route.service}-${route.express ? 'express' : 'local'}`;
        map.get(stop).set(key, {
          service: route.service,
          express: route.express,
          icon: route.express ? LINE_META[route.service].expressIcon : LINE_META[route.service].localIcon,
          order: LINE_META[route.service].order + (route.express ? 1 : 0)
        });
      }
    }

    return map;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalizeState(JSON.parse(raw));
    } catch {
      // Local storage can be blocked in private browsing; the page still works for the session.
    }

    return createInitialState();
  }

  function createInitialState() {
    const now = Date.now();
    return normalizeState({
      balance: INITIAL_BALANCE,
      history: [
        createHistoryEntry(now - 46 * 60 * 1000, 'Oakville Exchange', INITIAL_BALANCE),
        createHistoryEntry(now - 7 * 60 * 60 * 1000, 'Newkirk', INITIAL_BALANCE + FARE),
        createHistoryEntry(now - 30 * 60 * 60 * 1000, 'Harrington City', INITIAL_BALANCE + FARE * 2)
      ]
    });
  }

  function normalizeState(next) {
    const balance = clampMoney(Number(next?.balance ?? INITIAL_BALANCE));
    const history = Array.isArray(next?.history)
      ? next.history
        .filter((entry) => entry && typeof entry.station === 'string' && Number.isFinite(Number(entry.timestamp)))
        .slice(0, 20)
        .map((entry) => ({
          id: String(entry.id || `tap-${entry.timestamp}-${entry.station}`),
          station: entry.station,
          timestamp: Number(entry.timestamp),
          amount: -FARE,
          balanceAfter: clampMoney(Number(entry.balanceAfter ?? balance))
        }))
      : [];

    return { balance, history };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore persistence failures; the UI should never break because storage is full.
    }
  }

  function render() {
    const balanceText = formatMoney(state.balance);
    els.balanceValue.textContent = balanceText;
    els.cardBalanceText.textContent = balanceText;
    els.balanceMeter.style.width = `${Math.min(100, (state.balance / MAX_BALANCE) * 100)}%`;

    const latest = state.history[0];
    if (latest) {
      els.lastStation.textContent = latest.station;
      els.lastTapTime.textContent = `${formatDateTime(latest.timestamp)} - ${formatMoney(FARE)} fare paid`;
    } else {
      els.lastStation.textContent = 'No taps yet';
      els.lastTapTime.textContent = 'Tap the card to begin.';
    }

    els.historyCount.textContent = `${state.history.length} ${state.history.length === 1 ? 'tap' : 'taps'}`;
    renderHistory();
    updateTapAvailability();
  }

  function renderHistory() {
    if (!state.history.length) {
      els.historyList.innerHTML = '<div class="empty-history">No BOCard activity yet.</div>';
      return;
    }

    els.historyList.innerHTML = state.history.slice(0, 8).map((entry) => `
      <div class="history-row">
        <div>
          <div class="station-line">
            <span class="station-name">${escapeHtml(entry.station)}</span>
            ${renderBadges(entry.station)}
          </div>
          <div class="history-time">${formatDateTime(entry.timestamp)}</div>
        </div>
        <div class="fare-pill">-${formatMoney(FARE)}</div>
      </div>
    `).join('');
  }

  function renderBadges(station) {
    const badges = Array.from(stationBadges.get(station)?.values() || [])
      .filter((badge) => badge.icon)
      .sort((a, b) => a.order - b.order);

    if (!badges.length) return '';

    return `
      <span class="line-badges" aria-label="Services at ${escapeHtml(station)}">
        ${badges.map((badge) => `<img src="${badge.icon}" alt="${badge.service} ${badge.express ? 'express' : 'local'}">`).join('')}
      </span>
    `;
  }

  function selectAmount(amount) {
    selectedAmount = AMOUNTS.includes(amount) ? amount : null;

    for (const button of els.amountGrid.querySelectorAll('button[data-amount]')) {
      button.classList.toggle('active', Number(button.dataset.amount) === selectedAmount);
    }

    els.confirmPaymentButton.disabled = selectedAmount === null;
    setReloadAlert('');
  }

  function handleReload() {
    if (busy || selectedAmount === null) return;

    if (state.balance + selectedAmount > MAX_BALANCE) {
      setReloadAlert(`That reload would pass the ${formatMoney(MAX_BALANCE)} card limit.`, true);
      els.confirmPaymentButton.classList.remove('shake');
      void els.confirmPaymentButton.offsetWidth;
      els.confirmPaymentButton.classList.add('shake');
      return;
    }

    busy = true;
    setReloadAlert('');
    showPaymentModal('Authorizing payment', 'Contacting BOCard payment network...', false);

    window.setTimeout(() => {
      state.balance = clampMoney(state.balance + selectedAmount);
      saveState();
      render();
      showPaymentModal('Payment approved', `${formatMoney(selectedAmount)} added to your MyBOCard.`, true);
      selectedAmount = null;
      selectAmount(null);

      window.setTimeout(() => {
        hidePaymentModal();
        busy = false;
      }, 1050);
    }, 1250);
  }

  function handleTapToPay() {
    if (busy || !cardTapEnabled) return;

    busy = true;
    els.walletShell.classList.add('is-tapping');
    setTapStatus('Waiting for Tap...', 'pending');

    window.setTimeout(() => {
      if (state.balance < FARE) {
        els.tapCardButton.classList.add('denied');
        setTapStatus('Insufficient funds', 'error');

        window.setTimeout(() => {
          els.tapCardButton.classList.remove('denied');
          els.walletShell.classList.remove('is-tapping');
          setTapStatus('Add money before tapping again', 'error');
          busy = false;
        }, 1400);
        return;
      }

      state.balance = clampMoney(state.balance - FARE);
      state.history.unshift(createHistoryEntry(Date.now(), randomStation(), state.balance));
      state.history = state.history.slice(0, 20);
      saveState();
      render();
      els.tapCardButton.classList.add('paid');
      setTapStatus('Fare paid', 'ok');
      playDing();

      window.setTimeout(() => {
        els.tapCardButton.classList.remove('paid');
        els.walletShell.classList.remove('is-tapping');
        setTapStatus('Tap card to pay fare', 'neutral');
        busy = false;
      }, 1450);
    }, 2000);
  }

  function createHistoryEntry(timestamp, station = randomStation(), balanceAfter = state?.balance ?? INITIAL_BALANCE) {
    return {
      id: `tap-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
      station,
      timestamp,
      amount: -FARE,
      balanceAfter: clampMoney(balanceAfter)
    };
  }

  function randomStation() {
    return STATIONS[Math.floor(Math.random() * STATIONS.length)];
  }

  function setTapStatus(message, type) {
    const icon = type === 'ok' ? '✓' : (type === 'error' ? '!' : '+');
    els.tapStatus.classList.toggle('ok', type === 'ok');
    els.tapStatus.classList.toggle('error', type === 'error');
    els.tapStatus.innerHTML = `<span class="tap-icon" aria-hidden="true">${icon}</span><span>${escapeHtml(message)}</span>`;
  }

  function isTapCapableDevice() {
    return Boolean(navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches);
  }

  function updateTapAvailability() {
    if (!els.tapCardButton) return;
    cardTapEnabled = isTapCapableDevice();
    els.tapCardButton.disabled = !cardTapEnabled;
    els.tapCardButton.setAttribute('aria-disabled', String(!cardTapEnabled));
    els.walletShell.classList.toggle('tap-disabled', !cardTapEnabled);
    if (!busy && !cardTapEnabled) {
      setTapStatus('Tap-to-pay is available on mobile devices', 'neutral');
    } else if (!busy && cardTapEnabled && !els.tapStatus.classList.contains('error')) {
      setTapStatus('Tap card to pay fare', 'neutral');
    }
  }

  function setReloadAlert(message, isError = false) {
    els.reloadAlert.textContent = message;
    els.reloadAlert.classList.toggle('error', Boolean(isError));
  }

  function showPaymentModal(title, message, success) {
    els.paymentModal.hidden = false;
    els.paymentSpinner.hidden = Boolean(success);
    els.paymentCheck.hidden = !success;
    els.paymentTitle.textContent = title;
    els.paymentMessage.textContent = message;
  }

  function hidePaymentModal() {
    els.paymentModal.hidden = true;
  }

  function playDing() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    try {
      const context = new AudioContext();
      const gain = context.createGain();
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1320, context.currentTime + 0.08);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.24);
      window.setTimeout(() => context.close(), 420);
    } catch {
      // Browsers may block audio until user activation; the visual approval still completes.
    }
  }

  function clampMoney(value) {
    const maxCents = MAX_BALANCE * 100;
    const cents = Math.max(0, Math.min(maxCents, Math.round(Number(value || 0) * 100)));
    return cents / 100;
  }

  function formatMoney(value) {
    return `$${Number(value).toFixed(2)}`;
  }

  function formatDateTime(timestamp) {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(timestamp));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function exposeDebugApi() {
    window.MyBOCardDebug = {
      getState: () => JSON.parse(JSON.stringify(state)),
      setState(next) {
        state = normalizeState(next);
        saveState();
        render();
      },
      reset() {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        state = createInitialState();
        saveState();
        render();
      },
      constants: { FARE, MAX_BALANCE, STATIONS: [...STATIONS] }
    };
  }
})();
