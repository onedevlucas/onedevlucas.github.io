(function initializeSavedTrips(root) {
  'use strict';

  const DEVICE_KEY = 'borail_notification_device_v1';
  const SETTINGS = 'settings.html#savedTrips';
  const CLOCK = root.BORailTime;

  function device() {
    try { return JSON.parse(localStorage.getItem(DEVICE_KEY)); }
    catch { return null; }
  }

  async function request(method = 'GET', id, trip) {
    const base = root.BORailNotificationConfig?.apiBase?.replace(/\/$/, '');
    const active = device();
    if (!base || !active?.id || !active?.manageToken || root.Notification?.permission !== 'granted') {
      throw new Error('Enable notifications in Settings to save trip alerts on this device.');
    }
    const response = await fetch(`${base}/subscriptions/${encodeURIComponent(active.id)}/trips${id ? `/${encodeURIComponent(id)}` : ''}`, {
      method,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${active.manageToken}` },
      ...(trip ? { body: JSON.stringify(trip) } : {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Saved trips are temporarily unavailable. Try again.');
    return result;
  }

  function clockTime(dateKey, seconds) {
    const noon = CLOCK.fromWallTime(dateKey, '12:00');
    return CLOCK.formatDateTime(noon.getTime() + (seconds - 43200) * 1000, {
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    });
  }

  async function refreshList() {
    const list = document.getElementById('savedTripList');
    if (!list) return;
    if (!device()?.id || root.Notification?.permission !== 'granted') {
      list.textContent = 'Enable notifications above, then save an itinerary from Plan a Trip.';
      return;
    }
    list.textContent = 'Loading saved trips…';
    try {
      const { trips } = await request();
      list.replaceChildren();
      if (!trips.length) list.textContent = 'No trips saved on this device.';
      const focusTrip = new URLSearchParams(location.search).get('trip');
      trips.forEach(trip => {
        const row = document.createElement('article');
        row.className = 'saved-trip-row';
        row.dataset.updated = String(Boolean(trip.updatedLegs));
        const title = document.createElement('strong');
        title.textContent = `${trip.origin} → ${trip.destination}`;
        const when = document.createElement('span');
        when.textContent = CLOCK.formatDateTime(trip.startsAt, {
          weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
        });
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = trip.replan ? 'Itinerary changed · replan needed' : trip.updatedLegs ? 'Schedule updated · Review changes' : 'View trains';
        details.append(summary);
        details.open = focusTrip === trip.id;
        const legs = document.createElement('ol');
        (trip.updatedLegs || trip.legs).forEach(leg => {
          const item = document.createElement('li');
          item.textContent = `${leg.serviceId}${leg.isExpress ? ' Express' : ' Line'} · ${leg.boardStation} ${clockTime(trip.dateKey, leg.expectedDepartureSec)} → ${leg.alightStation} ${clockTime(trip.dateKey, leg.expectedArrivalSec)}`;
          if (leg.changed) {
            const updated = document.createElement('small');
            updated.textContent = ` · Updated route: ${leg.stops.join(' → ')}`;
            item.append(updated);
          }
          legs.append(item);
        });
        details.append(legs);
        const actions = document.createElement('div');
        actions.className = 'button-row';
        if (trip.replan) {
          const replan = document.createElement('a');
          replan.href = `index.html?${new URLSearchParams({ view: 'planner', from: trip.origin, to: trip.destination })}`;
          replan.textContent = 'Replan trip';
          actions.append(replan);
        }
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Cancel trip alerts';
        cancel.addEventListener('click', async () => {
          cancel.disabled = true;
          try {
            await request('DELETE', trip.id);
            await refreshList();
          } catch (error) {
            cancel.disabled = false;
            message.textContent = error.message;
          }
        });
        const message = document.createElement('span');
        message.setAttribute('role', 'status');
        actions.append(cancel);
        row.append(title, when, details, actions, message);
        list.append(row);
        if (focusTrip === trip.id) requestAnimationFrame(() => row.scrollIntoView({ block: 'center' }));
      });
    } catch (error) {
      list.textContent = error.message;
    }
  }

  root.BORailSavedTrips = Object.freeze({
    save: trip => request('POST', null, trip), refreshList, settingsUrl: SETTINGS
  });
  refreshList();
})(globalThis);
