
const dropdownContainer = document.getElementById('stationDropdownContainer');
const dropdownTrigger = document.getElementById('stationDropdownTrigger');
const dropdownTriggerContent = document.getElementById('stationTriggerContent');
const dropdownOptionsPanel = document.getElementById('stationDropdownOptions');

const arrivalsEl = document.getElementById('arrivals');
const nowText = document.getElementById('nowText');
const limitSelect = document.getElementById('limitSelect');
const dirFilterSelect = document.getElementById('dirFilterSelect');
const serviceTypeFilterSelect = document.getElementById('serviceTypeFilterSelect');
const refreshBtn = document.getElementById('refreshBtn');
const upcomingTab = document.getElementById('upcomingTab');
const tripPlannerTab = document.getElementById('tripPlannerTab');
const liveMapTab = document.getElementById('liveMapTab');
const upcomingView = document.getElementById('upcomingView');
const tripPlannerView = document.getElementById('tripPlannerView');
const liveMapView = document.getElementById('liveMapView');
const upcomingHeaderControls = document.getElementById('upcomingHeaderControls');
const plannerServiceState = document.getElementById('plannerServiceState');
const tripOriginSelect = document.getElementById('tripOriginSelect');
const tripDestinationSelect = document.getElementById('tripDestinationSelect');
const tripOriginDropdownContainer = document.getElementById('tripOriginDropdownContainer');
const tripOriginDropdownTrigger = document.getElementById('tripOriginDropdownTrigger');
const tripOriginTriggerContent = document.getElementById('tripOriginTriggerContent');
const tripOriginDropdownOptions = document.getElementById('tripOriginDropdownOptions');
const tripDestinationDropdownContainer = document.getElementById('tripDestinationDropdownContainer');
const tripDestinationDropdownTrigger = document.getElementById('tripDestinationDropdownTrigger');
const tripDestinationTriggerContent = document.getElementById('tripDestinationTriggerContent');
const tripDestinationDropdownOptions = document.getElementById('tripDestinationDropdownOptions');
const swapTripStations = document.getElementById('swapTripStations');
const departNowButton = document.getElementById('departNowButton');
const departLaterButton = document.getElementById('departLaterButton');
const futureDepartureFields = document.getElementById('futureDepartureFields');
const tripDateInput = document.getElementById('tripDateInput');
const tripTimeInput = document.getElementById('tripTimeInput');
const findTripsButton = document.getElementById('findTripsButton');
const tripPlannerResults = document.getElementById('tripPlannerResults');

const openDetails = new Set();
const expandedStops = new Set();
let activeStationId = '';
let activeTimetableView = 'upcoming';
let tripDepartureMode = 'now';
let renderedTripSearch = null;
let plannerServiceDay = localDateKey(BORAIL_CLOCK.now());
let tripOriginDropdown;
let tripDestinationDropdown;

function getBadgesForStation(stationId, { serviceOrder = null, expressFirst = false } = {}) {
  const linesMap = {};
  passengerRoutesForDate().forEach(route => {
    if (route.stops.includes(stationId)) {
      if (!linesMap[route.serviceId]) {
        linesMap[route.serviceId] = { local: false, express: false };
      }
      if (route.isExpress) {
        linesMap[route.serviceId].express = true;
      } else {
        linesMap[route.serviceId].local = true;
      }
    }
  });

  let htmlString = '';
  const sortedServiceIds = Object.keys(linesMap).sort((left, right) => {
    if (!serviceOrder) return left.localeCompare(right);
    const leftIndex = serviceOrder.indexOf(left);
    const rightIndex = serviceOrder.indexOf(right);
    return (leftIndex < 0 ? serviceOrder.length : leftIndex) - (rightIndex < 0 ? serviceOrder.length : rightIndex);
  });
  sortedServiceIds.forEach(serviceId => {
    const meta = SERVICE_META[serviceId];
    if (!meta) return;
    const localBadge = linesMap[serviceId].local && meta.localIcon
      ? `<img class="dropdown-badge-img" src="${meta.localIcon}" alt="(${serviceId})">`
      : '';
    const expressBadge = linesMap[serviceId].express && meta.expressIcon
      ? `<img class="dropdown-badge-img" src="${meta.expressIcon}" alt="<${serviceId}>">`
      : '';
    htmlString += expressFirst ? expressBadge + localBadge : localBadge + expressBadge;
  });
  return htmlString;
}

function getPlannerBadgesForStation(stationId) {
  return getBadgesForStation(stationId, {
    serviceOrder: ['F', 'A', 'S', 'B', 'C', 'D', 'E', 'G'],
    expressFirst: true
  });
}

function closeStationDropdowns(except = null) {
  document.querySelectorAll('.custom-select-container.open').forEach(container => {
    if (container === except) return;
    container.classList.remove('open');
    container.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
  });
  syncTripDropdownLayer();
}

function syncTripDropdownLayer() {
  document.body.classList.toggle('trip-dropdown-open', Boolean(document.querySelector('.trip-custom-select.open')));
}

function createTripStationDropdown({ container, trigger, triggerContent, optionsPanel, input, initialValue }) {
  const sortedStations = [...STATIONS].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  );

  const controller = {
    get value() {
      return input.value;
    },
    setValue(value) {
      const station = sortedStations.find(item => item.id === value);
      if (!station) return false;
      input.value = station.id;
      render();
      return true;
    }
  };

  function render() {
    const selected = sortedStations.find(station => station.id === input.value) || sortedStations[0];
    input.value = selected.id;
    triggerContent.innerHTML = `
      <span class="station-trigger-name">${tripEscape(selected.name)}</span>
      <span class="station-item-badges">${getPlannerBadgesForStation(selected.id)}</span>
    `;
    optionsPanel.innerHTML = sortedStations.map(station => `
      <button type="button" class="custom-option-item ${station.id === selected.id ? 'selected' : ''}"
        data-value="${tripEscape(station.id)}" role="option" aria-selected="${station.id === selected.id}">
        <span class="station-item-name">${tripEscape(station.name)}</span>
        <span class="station-item-badges">${getPlannerBadgesForStation(station.id)}</span>
      </button>
    `).join('');

    optionsPanel.querySelectorAll('.custom-option-item').forEach(option => {
      option.addEventListener('click', event => {
        event.stopPropagation();
        controller.setValue(option.dataset.value);
        container.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        syncTripDropdownLayer();
        trigger.focus();
      });
    });
  }

  trigger.addEventListener('click', event => {
    event.stopPropagation();
    const shouldOpen = !container.classList.contains('open');
    closeStationDropdowns(container);
    container.classList.toggle('open', shouldOpen);
    trigger.setAttribute('aria-expanded', String(shouldOpen));
    syncTripDropdownLayer();
    if (shouldOpen) {
      requestAnimationFrame(() => {
        const selectedOption = optionsPanel.querySelector('.custom-option-item.selected');
        if (!selectedOption) return;
        optionsPanel.scrollTop = Math.max(0, selectedOption.offsetTop - (optionsPanel.clientHeight - selectedOption.offsetHeight) / 2);
      });
    }
  });

  trigger.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    container.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    syncTripDropdownLayer();
  });

  controller.setValue(initialValue);
  return controller;
}

function renderCustomStationsDropdown() {
  const sorted = [...STATIONS].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  );

  if (!activeStationId) {
    activeStationId = sorted[0].id;
  }

  let optionsHtml = '';
  sorted.forEach(s => {
    const badgeImages = getBadgesForStation(s.id);
    const isSelectedClass = (s.id === activeStationId) ? 'selected' : '';
    optionsHtml += `
      <div class="custom-option-item ${isSelectedClass}" data-value="${s.id}">
        <span class="station-item-name">${s.name}</span>
        <div class="station-item-badges">${badgeImages}</div>
      </div>
    `;
  });
  dropdownOptionsPanel.innerHTML = optionsHtml;

  const activeStationObj = sorted.find(s => s.id === activeStationId) || sorted[0];
  dropdownTriggerContent.innerHTML = `
    <span class="station-trigger-name">${activeStationObj.name}</span>
    <div class="station-item-badges">${getBadgesForStation(activeStationObj.id)}</div>
  `;

  dropdownOptionsPanel.querySelectorAll('.custom-option-item').forEach(item => {
    item.addEventListener('click', (e) => {
      activeStationId = item.dataset.value;
      const selectedName = item.querySelector('.station-item-name').textContent;
      const selectedBadgesHtml = item.querySelector('.station-item-badges').innerHTML;
      dropdownTriggerContent.innerHTML = `
        <span class="station-trigger-name">${selectedName}</span>
        <div class="station-item-badges">${selectedBadgesHtml}</div>
      `;
      dropdownContainer.classList.remove('open');
      openDetails.clear();
      expandedStops.clear();
      renderCustomStationsDropdown();
      renderArrivals();
    });
  });
}

dropdownTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  const shouldOpen = !dropdownContainer.classList.contains('open');
  closeStationDropdowns(dropdownContainer);
  dropdownContainer.classList.toggle('open', shouldOpen);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select-container')) closeStationDropdowns();
});

function renderClock() {
  const now = BORAIL_CLOCK.now();
  const nowParts = BORAIL_CLOCK.parts(now);
  nowText.textContent = `${formatTime24Full(BORAIL_CLOCK.clockSeconds(now))} ${nowParts.zoneName}`;
  const mode = timeMode(now);
  serviceState.textContent = (mode === 'rushAM' || mode === 'rushPM') ? 'Service: Rush (LCL+EXP)' :
                             (mode === 'local') ? 'Service: Local only' :
                             (mode === 'winterEmergency') ? 'Service: Winter Emergency' :
                             'Service: No Service';
  serviceState.classList.toggle('late-night', mode === 'closed');
  serviceState.classList.toggle('winter-emergency', mode === 'winterEmergency');
}

function iconFor(serviceId, isExpress) {
  const meta = SERVICE_META[serviceId];
  if (isExpress && meta.expressIcon) return meta.expressIcon;
  return meta.localIcon;
}

function serviceLabel(serviceId, isExpress) {
  return isExpress ? `<${serviceId}>` : `(${serviceId})`;
}

function lineBadgeHtml(serviceId, isExpress) {
  const src = iconFor(serviceId, isExpress);
  return `<img src="${src}" alt="${serviceId} ${isExpress?'Express':'Local'}" style="width:22px;height:22px;border-radius:6px;object-fit:contain;"/>`;
}

function slideDown(el) {
  el.classList.add('open');
  el.style.maxHeight = el.scrollHeight + 'px';
  el.style.opacity = '1';
}

function setTimetableView(view) {
  if (!['upcoming', 'planner', 'map'].includes(view)) view = 'upcoming';
  activeTimetableView = view;
  const plannerActive = view === 'planner';
  const mapActive = view === 'map';
  const upcomingActive = view === 'upcoming';
  upcomingView.hidden = !upcomingActive;
  tripPlannerView.hidden = !plannerActive;
  liveMapView.hidden = !mapActive;
  upcomingHeaderControls.hidden = !upcomingActive;
  upcomingTab.classList.toggle('active', upcomingActive);
  tripPlannerTab.classList.toggle('active', plannerActive);
  liveMapTab.classList.toggle('active', mapActive);
  upcomingTab.setAttribute('aria-selected', String(upcomingActive));
  tripPlannerTab.setAttribute('aria-selected', String(plannerActive));
  liveMapTab.setAttribute('aria-selected', String(mapActive));
  sessionStorage.setItem('borailTimetableView', view);
  if (plannerActive) updatePlannerServiceState(getTripPlanningDate(false) || BORAIL_CLOCK.now());
  document.dispatchEvent(new CustomEvent('borail:viewchange', { detail: { view } }));
}

function inputDateValue(date) {
  return BORAIL_CLOCK.dateKey(date);
}

function inputTimeValue(date) {
  return BORAIL_CLOCK.inputTimeValue(date);
}

function initializeTripPlanner() {
  tripOriginDropdown = createTripStationDropdown({
    container: tripOriginDropdownContainer,
    trigger: tripOriginDropdownTrigger,
    triggerContent: tripOriginTriggerContent,
    optionsPanel: tripOriginDropdownOptions,
    input: tripOriginSelect,
    initialValue: 'Newkirk'
  });
  tripDestinationDropdown = createTripStationDropdown({
    container: tripDestinationDropdownContainer,
    trigger: tripDestinationDropdownTrigger,
    triggerContent: tripDestinationTriggerContent,
    optionsPanel: tripDestinationDropdownOptions,
    input: tripDestinationSelect,
    initialValue: 'New Halifax'
  });

  const now = BORAIL_CLOCK.now();
  tripDateInput.value = inputDateValue(now);
  tripDateInput.min = inputDateValue(now);
  tripTimeInput.value = inputTimeValue(new Date(now.getTime() + 15 * 60000));
  updatePlannerServiceState(now);
}

function setTripDepartureMode(mode) {
  tripDepartureMode = mode;
  const leaveLater = mode === 'later';
  departNowButton.classList.toggle('active', !leaveLater);
  departLaterButton.classList.toggle('active', leaveLater);
  futureDepartureFields.hidden = !leaveLater;
  updatePlannerServiceState(getTripPlanningDate(false) || BORAIL_CLOCK.now());
}

function getTripPlanningDate(showError = true) {
  if (tripDepartureMode === 'now') return BORAIL_CLOCK.now();
  if (!tripDateInput.value || !tripTimeInput.value) {
    if (showError) renderTripPlannerMessage('Choose a departure date and time.', 'The planner needs both fields before it can search.');
    return null;
  }
  const date = BORAIL_CLOCK.fromWallTime(tripDateInput.value, tripTimeInput.value);
  if (!date) {
    if (showError) renderTripPlannerMessage('That departure time is invalid.', 'Please choose another EST/EDT date and time. Daylight-saving clock changes can skip some times.');
    return null;
  }
  if (date.getTime() < BORAIL_CLOCK.now().getTime() - 60000) {
    if (showError) renderTripPlannerMessage('That departure time has already passed.', 'Choose Depart Now or a future time.');
    return null;
  }
  return date;
}

function updatePlannerServiceState(date) {
  const mode = BORAIL_SERVICE.context(date, planningOptions(date)).mode;
  plannerServiceState.textContent = `Service: ${plannerModeLabel(mode)}`;
  plannerServiceState.classList.toggle('late-night', mode === 'closed');
  plannerServiceState.classList.toggle('winter-emergency', mode === 'winterEmergency');
}

function routePillHtml(leg) {
  const meta = SERVICE_META[leg.serviceId];
  return `<span class="route-pill" style="--route-color:${meta.color}">
    <img src="${iconFor(leg.serviceId, leg.isExpress)}" alt="${tripEscape(serviceLabel(leg.serviceId, leg.isExpress))}">
    <span>${tripEscape(leg.destination)}</span>
  </span>`;
}

function fallbackNoticeHtml(result) {
  const notices = [];
  if (result.origin.fallback) {
    notices.push(`<div class="fallback-notice"><span>↗</span><span>No active trains depart ${tripEscape(result.origin.requested)} during ${tripEscape(plannerModeLabel(result.mode))}. Begin at ${tripEscape(result.origin.effective)} by walking/alternate transportation.</span></div>`);
  }
  if (result.destination.fallback) {
    notices.push(`<div class="fallback-notice"><span>↗</span><span>No active trains reach ${tripEscape(result.destination.requested)} during ${tripEscape(plannerModeLabel(result.mode))}. Rail service ends at ${tripEscape(result.destination.effective)}; continue by walking/alternate transportation.</span></div>`);
  }
  return notices.join('');
}

function transferSummaryHtml(journey) {
  if (!journey.transfers) return 'Direct train';
  const stations = journey.legs.slice(0, -1).map(leg => leg.alightStation);
  return `Transfer at ${stations.map(tripEscape).join(', then ')}`;
}

function renderTripLeg(leg, nextLeg) {
  const meta = SERVICE_META[leg.serviceId];
  const consist = getTrainConsist(leg.trainSeed, leg.serviceId, leg.isExpress);
  if (leg.isSingleShuttle || SINGLE_TRAIN_SHUTTLES.has(leg.serviceId)) {
    consist.model = 'MTC-T 110';
    consist.cars = 2;
    const fixed = FIXED_SHUTTLE_LEAD_CARS[leg.serviceId] && FIXED_SHUTTLE_LEAD_CARS[leg.serviceId][leg.destination];
    if (typeof fixed === 'number') consist.leadCar = fixed;
  }

  const stopsHtml = leg.stops.map((stop, index) => {
    const endpoint = index === 0 || index === leg.stops.length - 1;
    const delayed = stop.isDelayed && stop.actualArrivalSec !== stop.scheduledArrivalSec;
    const accessIconHtml = ACCESSIBLE_STATIONS.has(stop.name)
      ? `<img class="accessible-icon-tiny trip-accessible-icon" src="${ACCESSIBLE_ICON_URL}" alt="Accessible station" />`
      : '';
    return `<div class="trip-stop ${endpoint ? 'endpoint' : ''}">
      <span class="trip-stop-time">${formatTripClock(index === 0 ? stop.actualDepartureSec : stop.actualArrivalSec)}</span>
      <span class="trip-stop-name">${tripEscape(stop.name)}${accessIconHtml}${delayed ? ` <small style="color:var(--warning)">+${Math.round(stop.delaySeconds / 60)}m</small>` : ''}</span>
    </div>`;
  }).join('');

  let transferHtml = '';
  if (nextLeg) {
    const waitSeconds = nextLeg.actualDepartureSec - leg.actualArrivalSec;
    const tight = waitSeconds <= 4 * 60;
    transferHtml = `<div class="transfer-block ${tight ? 'tight' : ''}">
      <span class="transfer-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h4.2c3.8 0 3.8 10 7.6 10H20m-3-3 3 3-3 3M4 17h4.2c3.8 0 3.8-10 7.6-10H20m-3-3 3 3-3 3"/></svg></span>
      <div class="transfer-block-copy"><strong>Transfer at ${tripEscape(leg.alightStation)} • ${formatTripDuration(waitSeconds)}</strong>
      <span>${tight ? 'Train may not wait' : `Next train departs at ${formatTripClock(nextLeg.actualDepartureSec)}`}</span></div>
    </div>`;
  }

  return `<div class="trip-leg">
    <div class="trip-leg-card">
      <img src="${iconFor(leg.serviceId, leg.isExpress)}" alt="${tripEscape(serviceLabel(leg.serviceId, leg.isExpress))}">
      <div><strong>Train toward ${tripEscape(leg.destination)}</strong><span>${tripEscape(consist.model)} • ${consist.cars} cars • Lead car ${consist.leadCar}</span></div>
      <div class="trip-leg-time"><strong>${formatTripClock(leg.actualDepartureSec)}</strong><span>${tripEscape(leg.boardStation)}</span></div>
    </div>
    <div class="trip-stop-timeline" style="--leg-color:${meta.color}">${stopsHtml}</div>
    ${transferHtml}
  </div>`;
}

function renderJourneyCard(journey, index, result) {
  const first = journey.legs[0];
  const waitSeconds = journey.departureSec - journey.requestedDepartureSec;
  const tightTransfer = journey.legs.slice(1).some(leg => leg.transferWaitSec <= 4 * 60);
  const pills = journey.legs.map((leg, legIndex) => `${legIndex ? '<span class="route-pill-arrow">›</span>' : ''}${routePillHtml(leg)}`).join('');
  const details = journey.legs.map((leg, legIndex) => renderTripLeg(leg, journey.legs[legIndex + 1])).join('');
  const rush = result.mode === 'rushAM' || result.mode === 'rushPM';

  const isFastest = index === 0;

  return `<details class="trip-option ${isFastest ? 'fastest' : ''}" ${index === 0 ? 'open' : ''}>
    <summary>
      <div class="trip-option-top">
        <div>
          <div class="trip-time-range">${formatTripClock(journey.departureSec)} <span>–</span> ${formatTripClock(journey.arrivalSec)}</div>
          <div class="trip-badges">
            ${isFastest ? '<span class="trip-badge fastest">Fastest</span>' : ''}
            ${journey.hasDelay ? '<span class="trip-badge delay">Delay included</span>' : ''}
            ${rush ? `<span class="trip-badge rush">${plannerModeLabel(result.mode)}</span>` : ''}
          </div>
        </div>
        <div class="trip-departs-in">${waitSeconds < 60 ? 'departing now' : `in ${Math.max(1, Math.round(waitSeconds / 60))} min`}</div>
      </div>
      <div class="trip-pill-chain">${pills}</div>
      <div class="trip-transfer-summary">${transferSummaryHtml(journey)}</div>
      <div class="trip-meta"><span>${formatTripDuration(journey.rideDurationSec)} total</span><span>${journey.transfers} transfer${journey.transfers === 1 ? '' : 's'}</span><span>${journey.legs.reduce((sum, leg) => sum + leg.stops.length - 1, 0)} stops</span></div>
      ${tightTransfer ? '<div class="journey-warning"><span>⇄</span><span>One connection is tight. Train may not wait, so be ready to transfer.</span></div>' : ''}
      ${journey.hasDelay ? '<div class="journey-warning delay-warning"><span>!</span><span>Delay is included in this estimate. The shown connections remain catchable, but conditions can change.</span></div>' : ''}
      ${fallbackNoticeHtml(result)}
    </summary>
    <div class="trip-details">
      <div class="trip-notifications">
        <button type="button" data-save-trip="${index}">Notify me about this trip</button>
        <span role="status"></span>
        <a href="settings.html#savedTrips" hidden>Notification settings</a>
      </div>
      ${result.origin.fallback ? `<div class="alternate-final-step"><strong>Before boarding:</strong> Continue from ${tripEscape(result.origin.requested)} to ${tripEscape(result.origin.effective)} by walking/alternate transportation.</div>` : ''}
      ${details}
      ${result.destination.fallback ? `<div class="alternate-final-step"><strong>After the train:</strong> Continue from ${tripEscape(result.destination.effective)} to ${tripEscape(result.destination.requested)} by walking/alternate transportation.</div>` : ''}
    </div>
  </details>`;
}

function renderTripPlannerMessage(title, message) {
  renderedTripSearch = null;
  tripPlannerResults.innerHTML = `<div class="trip-no-results"><strong>${tripEscape(title)}</strong><span>${tripEscape(message)}</span></div>`;
}

function findAndRenderTrips() {
  const origin = tripOriginSelect.value;
  const destination = tripDestinationSelect.value;
  if (!origin || !destination) {
    renderTripPlannerMessage('Choose both stations.', 'Select where you are leaving from and where you want to go.');
    return;
  }
  if (origin === destination) {
    renderTripPlannerMessage('You are already there.', 'Choose two different stations to plan a trip.');
    return;
  }
  const planningDate = getTripPlanningDate(true);
  if (!planningDate) return;
  updatePlannerServiceState(planningDate);
  findTripsButton.disabled = true;
  findTripsButton.textContent = 'Planning…';

  requestAnimationFrame(() => {
    const result = planBORailTrip(origin, destination, planningDate);
    findTripsButton.disabled = false;
    findTripsButton.textContent = 'Find Trips';

    if (result.closure || result.shutdown) {
      renderTripPlannerMessage(result.closure ? `${result.closure.target} is closed` : 'System Closed',
        globalThis.BORailOperationsClient.text(result.closure || result.shutdown));
      return;
    }

    if (result.origin.unavailable || result.destination.unavailable) {
      renderTripPlannerMessage('No active service found.', 'BORail could not find an active station or approved fallback for this trip.');
      return;
    }
    if (result.sameEffectiveStation) {
      renderTripPlannerMessage('Use alternate transportation.', `${result.origin.requested} and ${result.destination.requested} use the same active fallback station: ${result.origin.effective}.`);
      return;
    }
    if (!result.journeys.length) {
      renderTripPlannerMessage('No catchable trip found.', 'No trains can complete this journey within the next eight hours. Try a different departure time.');
      return;
    }
    renderedTripSearch = result;
    tripPlannerResults.innerHTML = result.journeys.map((journey, index) => renderJourneyCard(journey, index, result)).join('');
  });
}

function renderArrivals() {
  const now = BORAIL_CLOCK.now();
  const station = activeStationId;
  const limit = Number(limitSelect.value || 8);
  const operations = globalThis.BORailOperationsClient;
  const state = operations?.state(now);
  const closure = state?.stations.get(station);
  const shutdown = state?.shutdowns.find(change => change.kind === 'system');
  if (closure || shutdown) {
    const heading = closure ? 'No Upcoming Trains' : 'System Closed';
    arrivalsEl.innerHTML = `<div class="subtle"><strong>${heading}</strong><br>Reason Provided: ${tripEscape(operations.text(closure || shutdown))}</div>`;
    return;
  }

  const allRawRows = arrivalsForStation(station, now);
  const nowSeconds = BORAIL_CLOCK.clockSeconds(now);

  if (allRawRows.length === 0) {
    dirFilterSelect.innerHTML = '<option value="ALL">All</option>';
    arrivalsEl.innerHTML = `<div class="subtle">No upcoming trains in the next 6 hours.</div>`;
    return;
  }

  const availableDirections = new Set();
  allRawRows.forEach(r => {
    const bound = getTrainDirection(r.serviceId, r.destination);
    availableDirections.add(bound);
  });

  const currentFilterValue = dirFilterSelect.value || 'ALL';
  let filterHtml = '<option value="ALL">All Directions</option>';
  [...availableDirections].sort().forEach(dir => {
    filterHtml += `<option value="${dir}">${dir}</option>`;
  });
  dirFilterSelect.innerHTML = filterHtml;

  if (availableDirections.has(currentFilterValue) || currentFilterValue === 'ALL') {
    dirFilterSelect.value = currentFilterValue;
  } else {
    dirFilterSelect.value = 'ALL';
  }

  const activeFilter = dirFilterSelect.value;
  const activeServiceType = serviceTypeFilterSelect.value;

  const filteredRows = allRawRows.filter(r => {
    let matchDir = true;
    if (activeFilter !== 'ALL') {
      matchDir = (getTrainDirection(r.serviceId, r.destination) === activeFilter);
    }
    let matchService = true;
    if (activeServiceType === 'LOCAL') {
      matchService = !r.isExpress;
    } else if (activeServiceType === 'EXPRESS') {
      matchService = r.isExpress;
    }
    return matchDir && matchService;
  });

  const rows = filteredRows.slice(0, limit);

  if (rows.length === 0) {
    arrivalsEl.innerHTML = `<div class="subtle">No upcoming ${activeFilter} trains found.</div>`;
    return;
  }

  const directionsMap = {
    'Northbound': [],
    'Southbound': [],
    'Eastbound': [],
    'Westbound': []
  };

  rows.forEach((r, idx) => {
    const bound = getTrainDirection(r.serviceId, r.destination);
    directionsMap[bound].push({ r, idx });
  });

  let fullContainerHtml = '';
  for (const [directionName, arrivalsList] of Object.entries(directionsMap)) {
    if (arrivalsList.length === 0) continue;

    let directionCardsHtml = arrivalsList.map(({ r, idx }) => {
      const trainSeed = `${r.serviceId}-${r.tag}-${r.departureMin}-${r.origin}-${r.destination}`;
      const consist = getTrainConsist(trainSeed, r.serviceId, r.isExpress);

      if (r.isSingleShuttle || SINGLE_TRAIN_SHUTTLES.has(r.serviceId)) {
        consist.model = 'MTC-T 110';
        consist.cars = 2;
        const fixed = FIXED_SHUTTLE_LEAD_CARS[r.serviceId] && FIXED_SHUTTLE_LEAD_CARS[r.serviceId][r.destination];
        if (typeof fixed === 'number') consist.leadCar = fixed;
      }

      const stopTimes = r.precomputedStopTimes
        || calculateStopTimes(trainSeed, r.stops, r.departureMin, r.segmentTimes, r.mode, r.customDwellSeconds);
      const pos = getTrainPosition(stopTimes, nowSeconds);
      const minsText = (r.minsAway <= 0) ? 'Now' : `${Math.round(r.minsAway)} min`;
      const trainId = `${r.serviceId}-${r.tag}-${r.departureMin}-${idx}`.replace(/[^a-zA-Z0-9_-]/g,'');
      const isOpen = openDetails.has(trainId);
      const isExpanded = expandedStops.has(trainId);

      const stopsHtml = stopTimes.stops.map((st, i) => {
        let cls = 'stop-item';
        let icon = ICONS.pinGray;

        if (pos.status === 'at-station' && pos.currentIndex === i) {
          cls += ' current' + (st.isDelayed ? ' delayed' : '');
          icon = st.isDelayed ? ICONS.pinOrange : ICONS.pinGreen;
        } else if (pos.status === 'en-route' && i === pos.toIndex) {
          cls += ' en-route';
          icon = ICONS.pinDim;
        } else if ((pos.status === 'at-station' && i < pos.currentIndex) ||
                   (pos.status === 'en-route' && i < pos.fromIndex)) {
          cls += ' past';
          icon = ICONS.pinDim;
        }

        const sched = formatTime24Full(st.scheduledArrivalSec);
        const actual = formatTime24Full(st.actualArrivalSec);
        const delayed = st.isDelayed && (actual !== sched);
        const timeHtml = delayed
          ? `<span class="scheduled">${sched}</span><span class="new-time">${actual}</span>`
          : `<span>${actual}</span>`;

        // Check if current item station qualifies for accessibility layout injection
        const accessIconHtml = ACCESSIBLE_STATIONS.has(st.name)
          ? `<img class="accessible-icon-tiny" src="${ACCESSIBLE_ICON_URL}" alt="Accessible station" />`
          : '';

        return `<li class="${cls}">
          <span class="stop-icon">${icon}</span>
          <div class="stop-time-main ${delayed ? 'delayed' : ''}">${timeHtml}</div>
          <div class="stop-copy">
            <div class="stop-name">${st.name} ${accessIconHtml}</div>
            <div class="stop-details">
              <span class="detail-item">${ICONS.clock}<span>${st.isDelayed ? `Delayed ${Math.round(st.delaySeconds/60)}m` : 'On time'}</span></span>
            </div>
          </div>
        </li>`;
      }).join('');

      const originStop = stopTimes.stops[0];
      const destStop = stopTimes.stops[stopTimes.stops.length - 1];

      let statusBanner = '';
      if (pos.status === 'at-station') {
        statusBanner = `<div class="en-route-banner">${ICONS.clock} At ${pos.currentStop}${pos.isDelayed ? ' (delayed)' : ''}</div>`;
      } else if (pos.status === 'en-route') {
        statusBanner = `<div class="en-route-banner">${ICONS.clock} En route: ${pos.fromStop} → ${pos.toStop}</div>`;
      } else if (pos.status === 'not-started') {
        statusBanner = `<div class="en-route-banner">${ICONS.clock} Not started yet</div>`;
      }

      const badge = lineBadgeHtml(r.serviceId, r.isExpress);
      return `<details class="row" data-train-id="${trainId}" ${isOpen ? 'open' : ''}>
        <summary style="list-style:none; cursor:pointer;">
          <div>
            <div class="lineTag" style="display:flex; align-items:center; gap:8px;">
              ${badge} <span>Line</span>
            </div>
            <div class="dest">to ${r.destination}</div>
          </div>
          <div class="mins">${minsText}</div>
        </summary>
        <div style="margin-top:10px;">
          <div class="train-info-box">
            <div class="train-info-header">
              <span class="route-code">${r.tag}</span>
              <span>${r.origin} to ${r.destination}</span>
            </div>
            <div class="train-info-details">
              <span class="model">${consist.model}</span>
              <span>with ${consist.cars} Cars</span>
              <span class="lead-car">Lead Car: ${consist.leadCar}</span>
            </div>
          </div>
          ${statusBanner}
          <div class="compact-view" id="compact-${trainId}" style="${isExpanded ? 'display:none;' : ''}">
            <div class="compact-stop ${pos.status==='not-started'?'at-station':''}">
              <div class="compact-time"><span class="scheduled">${formatTime24Full(originStop.actualArrivalSec)}</span></div>
              <div class="compact-icon">${ICONS.pinDim}</div>
              <div class="compact-name">${originStop.name}</div>
            </div>
            <button class="mid-stops-btn" data-action="expand" data-train-id="${trainId}">Show all stops</button>
            <div class="compact-stop">
              <div class="compact-time"><span class="scheduled">${formatTime24Full(destStop.actualArrivalSec)}</span></div>
              <div class="compact-icon">${ICONS.pinDim}</div>
              <div class="compact-name">${destStop.name}</div>
            </div>
          </div>
          <div class="slide" id="full-${trainId}" style="${isExpanded ? 'display:block; max-height:none; opacity:1;' : 'display:none;'}">
            <div class="subtle" style="margin-bottom:8px;">Making stops at…</div>
            <ul class="stops-list" style="--stop-line-color:${r.color}">${stopsHtml}</ul>
          </div>
        </div>
      </details>`;
    }).join('');

    fullContainerHtml += `
      <div class="direction-group">
        <div class="direction-title">
          <span>${directionName} Departures</span>
        </div>
        <div class="list">${directionCardsHtml}</div>
      </div>
    `;
  }

  arrivalsEl.innerHTML = fullContainerHtml;
  wireUpEventListeners();
}

function wireUpEventListeners() {
  arrivalsEl.querySelectorAll('details.row').forEach(d => {
    const trainId = d.dataset.trainId;
    d.addEventListener('toggle', () => {
      if (d.open) {
        openDetails.add(trainId);
      } else {
        openDetails.delete(trainId);
        expandedStops.delete(trainId);
        const compact = d.querySelector(`#compact-${trainId}`);
        const full = d.querySelector(`#full-${trainId}`);
        if (compact) compact.style.display = '';
        if (full) {
          full.style.display = 'none';
          full.classList.remove('open');
          full.style.maxHeight = '0px';
        }
      }
    });
  });

  arrivalsEl.querySelectorAll('[data-action="expand"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const trainId = btn.dataset.trainId;
      const compact = document.getElementById(`compact-${trainId}`);
      const full = document.getElementById(`full-${trainId}`);
      if (compact && full) {
        compact.style.display = 'none';
        full.style.display = 'block';
        full.style.maxHeight = '0px';
        full.style.opacity = '0';
        requestAnimationFrame(() => slideDown(full));
        expandedStops.add(trainId);
      }
    });
  });
}

renderCustomStationsDropdown();
initializeTripPlanner();
renderClock();
renderArrivals();
const entryParams = new URLSearchParams(location.search);
const plannerEntry = entryParams.get('view') === 'planner';
setTimetableView(plannerEntry ? 'planner' : sessionStorage.getItem('borailTimetableView') || 'upcoming');
if (plannerEntry && STATION_SET.has(entryParams.get('from')) && STATION_SET.has(entryParams.get('to'))) {
  tripOriginDropdown.setValue(entryParams.get('from'));
  tripDestinationDropdown.setValue(entryParams.get('to'));
  findAndRenderTrips();
}

setInterval(() => {
  renderClock();
  renderArrivals();
  if (activeTimetableView === 'planner') {
    const now = BORAIL_CLOCK.now();
    const dateKey = localDateKey(now);
    if (dateKey !== plannerServiceDay) {
      plannerServiceDay = dateKey;
      tripDateInput.min = dateKey;
      if (renderedTripSearch && localDateKey(renderedTripSearch.planningDate) <= dateKey) findAndRenderTrips();
    }
    updatePlannerServiceState(getTripPlanningDate(false) || now);
  }
}, 5000);

limitSelect.addEventListener('change', renderArrivals);
dirFilterSelect.addEventListener('change', renderArrivals);
serviceTypeFilterSelect.addEventListener('change', renderArrivals);
refreshBtn.addEventListener('click', () => { renderClock(); renderArrivals(); });
window.addEventListener('borail:operations', () => {
  renderArrivals();
  renderCustomStationsDropdown();
  if (tripPlannerResults.childElementCount && !tripPlannerView.hidden) findAndRenderTrips();
});
upcomingTab.addEventListener('click', () => setTimetableView('upcoming'));
tripPlannerTab.addEventListener('click', () => setTimetableView('planner'));
liveMapTab.addEventListener('click', () => setTimetableView('map'));
departNowButton.addEventListener('click', () => setTripDepartureMode('now'));
departLaterButton.addEventListener('click', () => setTripDepartureMode('later'));
tripDateInput.addEventListener('change', () => updatePlannerServiceState(getTripPlanningDate(false) || BORAIL_CLOCK.now()));
tripTimeInput.addEventListener('change', () => updatePlannerServiceState(getTripPlanningDate(false) || BORAIL_CLOCK.now()));
swapTripStations.addEventListener('click', () => {
  const origin = tripOriginSelect.value;
  tripOriginDropdown.setValue(tripDestinationSelect.value);
  tripDestinationDropdown.setValue(origin);
});
findTripsButton.addEventListener('click', findAndRenderTrips);
tripPlannerResults.addEventListener('click', async event => {
  const button = event.target.closest('[data-save-trip]');
  const result = renderedTripSearch;
  const journey = result?.journeys[Number(button?.dataset.saveTrip)];
  if (!button || !journey) return;
  const message = button.parentElement.querySelector('[role="status"]');
  const settings = button.parentElement.querySelector('a');
  button.disabled = true;
  message.textContent = 'Saving…';
  try {
    await BORailSavedTrips.save({
      dateKey: localDateKey(result.planningDate),
      origin: result.origin.requested,
      destination: result.destination.requested,
      legs: journey.legs.map(({ runId, boardStation, alightStation }) => ({ runId, boardStation, alightStation }))
    });
    button.textContent = 'Trip alerts saved';
    message.textContent = 'Reminder about 20 minutes before departure, plus alerts for your trains.';
    settings.textContent = 'Manage saved trips';
  } catch (error) {
    button.disabled = false;
    message.textContent = error.message;
  }
  settings.hidden = false;
});

window.BORailTripDebug = {
  planBORailTrip,
  buildScheduledRuns,
  runsWithCurrentlyVisibleDelays,
  arrivalsForStation,
  resolvePlanningStation,
  getEffectiveRoutePattern,
  timeModeForMinutes,
  getBadgesForStation,
  setTripStations(origin, destination) {
    return tripOriginDropdown.setValue(origin) && tripDestinationDropdown.setValue(destination);
  }
};
