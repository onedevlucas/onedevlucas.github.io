import { buildPushPayload } from '@block65/webcrypto-web-push';
import '../../assets/js/time.js';
import '../../assets/js/service-calendar.js';
import '../../assets/js/status.js';
import { prepareTrip, tripCandidates, tripIsComplete, TRIP_LIMIT } from './trips.js';
import { operationsRequest, operationsSnapshot, operationalEvents, describeService } from './operations.js';

const CLOCK = globalThis.BORailTime;
const SERVICE = globalThis.BORailService;
const STATUS = globalThis.BORailStatusEngine;
const SCHEDULE = globalThis.BORailSchedule;

const ALLOWED_ORIGINS = new Set([
  'https://rideborailmc.net',
  'https://www.rideborailmc.net',
  'http://localhost:8000',
  'http://localhost:8787',
  'http://127.0.0.1:8000'
]);

const SERVICE_IDS = new Set(STATUS.services.map(service => service.id));
const ALERT_KEYS = new Set([
  'lineNoService', 'lineMinor', 'lineMajor', 'lineNormalResumed',
  'stationElevatorOutage', 'stationElevatorFixed', 'winterEmergency'
]);
const DISRUPTIVE_STATES = new Set(['minor', 'major', 'unexpected-noservice']);

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://rideborailmc.net',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(request, value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsHeaders(request) }
  });
}

function isAllowedBrowserRequest(request) {
  const origin = request.headers.get('Origin');
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function base64Url(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomToken(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function hashToken(token) {
  const bytes = new TextEncoder().encode(String(token));
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

function parseBearer(request) {
  const value = request.headers.get('Authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

function normalizePreferences(value = {}) {
  const services = Array.from(new Set(Array.isArray(value.services) ? value.services : [])).filter(id => SERVICE_IDS.has(id));
  const stations = Array.from(new Set(Array.isArray(value.stations) ? value.stations : []))
    .map(station => String(station).trim()).filter(station => station && station.length <= 100).slice(0, 100);
  const sourceAlerts = value.alerts && typeof value.alerts === 'object' ? value.alerts : {};
  const alerts = Object.fromEntries(Array.from(ALERT_KEYS, key => [key, sourceAlerts[key] !== false]));
  return { services, stations, alerts };
}

function normalizeSubscription(value) {
  const endpoint = String(value?.endpoint || '');
  const p256dh = String(value?.keys?.p256dh || '');
  const auth = String(value?.keys?.auth || '');
  if (!endpoint.startsWith('https://') || !p256dh || !auth || endpoint.length > 2048 || p256dh.length > 512 || auth.length > 512) {
    throw new Error('Invalid push subscription.');
  }
  return { endpoint, p256dh, auth };
}

async function requireManagedSubscription(request, env, id) {
  const row = await env.DB.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first();
  if (!row) return null;
  const supplied = await hashToken(parseBearer(request));
  return timingSafeEqual(supplied, row.manage_token_hash) ? row : null;
}

async function createSubscription(request, env) {
  const body = await request.json();
  const subscription = normalizeSubscription(body.subscription);
  const preferences = normalizePreferences(body.preferences);
  const id = crypto.randomUUID();
  const manageToken = randomToken();
  const tokenHash = await hashToken(manageToken);
  const now = new Date().toISOString();
  await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint = ?').bind(subscription.endpoint).run();
  await env.DB.prepare(`INSERT INTO subscriptions
    (id, endpoint, p256dh, auth, preferences_json, manage_token_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, subscription.endpoint, subscription.p256dh, subscription.auth, JSON.stringify(preferences), tokenHash, now, now).run();
  return json(request, { id, manageToken }, 201);
}

async function updateSubscription(request, env, id) {
  const row = await requireManagedSubscription(request, env, id);
  if (!row) return json(request, { error: 'Subscription not found or management token is invalid.' }, 404);
  const body = await request.json();
  const preferences = normalizePreferences(body.preferences);
  await env.DB.prepare('UPDATE subscriptions SET preferences_json = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(preferences), new Date().toISOString(), id).run();
  return json(request, { ok: true });
}

async function refreshSubscription(request, env, id) {
  const row = await requireManagedSubscription(request, env, id);
  if (!row) return json(request, { error: 'Subscription not found or management token is invalid.' }, 404);
  const body = await request.json();
  const subscription = normalizeSubscription(body.subscription);
  await env.DB.prepare('UPDATE subscriptions SET endpoint = ?, p256dh = ?, auth = ?, updated_at = ? WHERE id = ?')
    .bind(subscription.endpoint, subscription.p256dh, subscription.auth, new Date().toISOString(), id).run();
  return json(request, { ok: true });
}

async function deleteSubscription(request, env, id) {
  const row = await requireManagedSubscription(request, env, id);
  if (!row) return json(request, { error: 'Subscription not found or management token is invalid.' }, 404);
  await env.DB.prepare('DELETE FROM subscriptions WHERE id = ?').bind(id).run();
  return json(request, { ok: true });
}

async function manageTrips(request, env, subscriptionId, tripId) {
  if (!await requireManagedSubscription(request, env, subscriptionId)) {
    return json(request, { error: 'This device is not subscribed. Enable notifications in Settings.' }, 404);
  }
  const now = new Date();
  if (request.method === 'GET' && !tripId) {
    const { results } = await env.DB.prepare(`SELECT id, trip_json, flags_json FROM saved_trips
      WHERE subscription_id = ? AND expires_at > ? ORDER BY starts_at`).bind(subscriptionId, now.getTime()).all();
    return json(request, { trips: results.map(row => ({
      ...JSON.parse(row.trip_json), id: row.id, replan: JSON.parse(row.flags_json).includes('replan')
    })) });
  }
  if (request.method === 'POST' && !tripId) {
    if (Number(request.headers.get('Content-Length')) > 8192) return json(request, { error: 'Trip is too large.' }, 413);
    const trip = prepareTrip(await request.json(), now, await operationsSnapshot(env, now.getTime()));
    const encoded = JSON.stringify(trip);
    const journeyKey = JSON.stringify([trip.origin, trip.destination, ...trip.legs.map(leg =>
      [leg.runId, leg.boardStation, leg.alightStation])]);
    const id = crypto.randomUUID();
    const result = await env.DB.prepare(`INSERT OR IGNORE INTO saved_trips
      (id, subscription_id, date_key, starts_at, expires_at, journey_key, trip_json)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM saved_trips
        WHERE subscription_id = ? AND expires_at > ?) < ?`)
      .bind(id, subscriptionId, trip.dateKey, trip.startsAt, trip.expiresAt, journeyKey, encoded,
        subscriptionId, now.getTime(), TRIP_LIMIT).run();
    if (result.meta.changes) return json(request, { id, ...trip }, 201);
    const duplicate = await env.DB.prepare('SELECT id, trip_json FROM saved_trips WHERE subscription_id = ? AND journey_key = ?')
      .bind(subscriptionId, journeyKey).first();
    if (duplicate) return json(request, { id: duplicate.id, ...JSON.parse(duplicate.trip_json) });
    return json(request, { error: `You can save up to ${TRIP_LIMIT} trips. Cancel a trip in Settings to save another.` }, 409);
  }
  if (request.method === 'DELETE' && tripId) {
    await env.DB.prepare('DELETE FROM saved_trips WHERE subscription_id = ? AND id = ?')
      .bind(subscriptionId, tripId).run();
    return json(request, { ok: true });
  }
  return json(request, { error: 'Not found.' }, 404);
}

async function setServiceOverride(request, env) {
  if (!env.ADMIN_TOKEN || !timingSafeEqual(parseBearer(request), env.ADMIN_TOKEN)) return json(request, { error: 'Unauthorized.' }, 401);
  const body = await request.json();
  const serviceId = String(body.serviceId || '');
  if (!SERVICE_IDS.has(serviceId)) return json(request, { error: 'Unknown service.' }, 400);
  if (body.status === 'clear') {
    await env.DB.prepare('DELETE FROM service_overrides WHERE service_id = ?').bind(serviceId).run();
    return json(request, { ok: true });
  }
  if (body.status !== 'noservice') return json(request, { error: 'Only an unexpected no-service override is supported.' }, 400);
  const now = new Date().toISOString();
  const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null;
  await env.DB.prepare(`INSERT INTO service_overrides (service_id, status, reason, expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(service_id) DO UPDATE SET
    status = excluded.status, reason = excluded.reason, expires_at = excluded.expires_at, updated_at = excluded.updated_at`)
    .bind(serviceId, 'noservice', String(body.reason || 'Unexpected service suspension.'), expiresAt, now).run();
  return json(request, { ok: true });
}

function serviceLabel(serviceId) {
  const [letter, mode] = serviceId.split('-');
  return mode === 'express' ? `${letter} Express` : `${letter} Line`;
}

function lineEvent(serviceId, eventType, signal, now) {
  const label = serviceLabel(serviceId);
  const definitions = {
    'line-minor': { title: `${label} - Minor Delays`, body: signal.reason, preference: 'lineMinor' },
    'line-major': { title: `${label} - Major Delays`, body: signal.reason, preference: 'lineMajor' },
    'line-noservice': { title: `${label} - No Service`, body: signal.reason, preference: 'lineNoService' },
    'line-normal': { title: `${label} - Normal Service Resumed`, body: signal.delayed
      ? 'Delays have fallen below the line-wide alert threshold.'
      : `${label} trains are operating normally again.`, preference: 'lineNormalResumed' }
  };
  const definition = definitions[eventType];
  return {
    id: `${eventType}:${serviceId}:${now.toISOString().slice(0, 16)}`,
    eventType,
    targetId: serviceId,
    preference: definition.preference,
    payload: {
      title: definition.title,
      body: definition.body,
      tag: `borail-${serviceId}-${eventType}`,
      url: `status.html?service=${encodeURIComponent(serviceId)}`
    }
  };
}

function decideLineTransition(serviceId, previous, current, signal, now) {
  let lastDisruption = previous?.last_disruption || null;
  let event = null;
  if (current === 'major' && previous && previous.current_state !== 'major') {
    lastDisruption = 'major';
    event = lineEvent(serviceId, 'line-major', signal, now);
  } else if (current === 'minor' && previous && !['minor', 'major'].includes(previous.current_state)) {
    lastDisruption = 'minor';
    event = lineEvent(serviceId, 'line-minor', signal, now);
  } else if (current === 'unexpected-noservice' && previous && previous.current_state !== 'unexpected-noservice') {
    lastDisruption = 'unexpected-noservice';
    event = lineEvent(serviceId, 'line-noservice', signal, now);
  } else if (current === 'ok' && previous && DISRUPTIVE_STATES.has(lastDisruption)) {
    event = lineEvent(serviceId, 'line-normal', signal, now);
    lastDisruption = null;
  } else if (DISRUPTIVE_STATES.has(current)) {
    lastDisruption = current;
  }
  return { lastDisruption, event };
}

function eventStatement(env, event, now) {
  return env.DB.prepare(`INSERT OR IGNORE INTO events
    (id, event_type, target_id, payload_json, created_at, processed_at) VALUES (?, ?, ?, ?, ?, NULL)`)
    .bind(event.id, event.eventType, event.targetId || null, JSON.stringify({ ...event.payload, preference: event.preference }), now.toISOString());
}

async function insertEvent(env, event, now) {
  await eventStatement(env, event, now).run();
}

async function evaluateLineTransitions(env, now, operations) {
  const runs = operations && SCHEDULE.buildScheduledRuns(now, true, { operations, statusMinute: CLOCK.clockMinutes(now) });
  const signals = STATUS.computeStatusDelaySignals(now, runs);
  const overrideRows = await env.DB.prepare(`SELECT * FROM service_overrides
    WHERE expires_at IS NULL OR expires_at > ?`).bind(now.toISOString()).all();
  const overrides = new Map((overrideRows.results || []).map(row => [row.service_id, row]));
  const states = await env.DB.prepare("SELECT * FROM event_state WHERE state_key LIKE 'line:%'").all();
  const previousStates = new Map(states.results.map(row => [row.state_key, row]));
  const writes = [];

  for (const service of STATUS.services) {
    const signal = { ...signals[service.id] };
    const override = overrides.get(service.id);
    let current = signal.type;
    if (override?.status === 'noservice') {
      current = 'unexpected-noservice';
      signal.reason = override.reason;
    }
    const key = `line:${service.id}`;
    const previous = previousStates.get(key);
    const adminState = operations && describeService(service.id, now, operations);
    if (['system-closed', 'admin-noservice', 'closure-noservice'].includes(adminState?.type)) continue;
    const transition = decideLineTransition(service.id, previous, current, signal, now);
    const { lastDisruption, event } = transition;

    if (previous?.current_state === current && previous?.last_disruption === lastDisruption) continue;
    writes.push(env.DB.prepare(`INSERT INTO event_state (state_key, current_state, last_disruption, detail_json, updated_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(state_key) DO UPDATE SET
      current_state = excluded.current_state, last_disruption = excluded.last_disruption,
      detail_json = excluded.detail_json, updated_at = excluded.updated_at`)
      .bind(key, current, lastDisruption, JSON.stringify(signal), now.toISOString()));
    if (event) writes.push(eventStatement(env, event, now));
  }
  if (writes.length) await env.DB.batch(writes);
}

async function evaluateTrips(env, now, operations) {
  const nowMs = now.getTime();
  const current = SERVICE.context(now);
  const previousDate = CLOCK.dateKey(CLOCK.startOfDay(now).getTime() - 1);
  await env.DB.prepare('DELETE FROM saved_trips WHERE expires_at <= ?').bind(nowMs).run();
  const { results } = await env.DB.prepare(`SELECT * FROM saved_trips
    WHERE date_key BETWEEN ? AND ? AND (starts_at <= ? OR (? = 1 AND date_key = ?) OR ? = 1)
    AND flags_json NOT LIKE '%"replan"%' ORDER BY starts_at`)
    .bind(previousDate, operations?.changes.length ? CLOCK.dateKey(nowMs + 181 * 86400_000) : current.dateKey,
      nowMs + 20 * 60_000, Number(current.winterEmergency), current.dateKey, Number(Boolean(operations?.changes.length))).all();
  const indexedTrips = results.map(row => ({ row, trip: JSON.parse(row.trip_json) }));
  const wanted = new Map();
  for (const { row, trip } of indexedTrips) {
    if (!wanted.has(row.date_key)) wanted.set(row.date_key, new Set());
    trip.legs.forEach(leg => wanted.get(row.date_key).add(leg.runId));
  }
  const indexes = new Map();
  const writes = [];
  for (const { row, trip } of indexedTrips) {
    if (!indexes.has(row.date_key)) {
      const date = CLOCK.fromWallTime(row.date_key, '12:00');
      const options = SCHEDULE.planningOptions(date, now);
      indexes.set(row.date_key, {
        runs: new Map(SCHEDULE.buildScheduledRuns(date, true, { ...options, operations, runIds: wanted.get(row.date_key) }).map(run => [run.id, run])),
        winterEmergency: SERVICE.context(date, options).winterEmergency
      });
    }
    const { runs, winterEmergency } = indexes.get(row.date_key);
    const flags = JSON.parse(row.flags_json);
    if (tripIsComplete(trip, runs, now)) {
      writes.push(env.DB.prepare('DELETE FROM saved_trips WHERE id = ?').bind(row.id));
      if (writes.length >= 6) break;
      continue;
    }
    const candidates = tripCandidates({ ...trip, id: row.id }, runs, now, { winterEmergency, flags, operations })
      .slice(0, Math.max(1, 5 - writes.length));
    if (!candidates.length) continue;
    for (const { key, deadline, changedLegs, ...payload } of candidates) {
      if (changedLegs) trip.updatedLegs = changedLegs;
      flags.push(key);
      writes.push(eventStatement(env, {
        id: `trip:${row.id}:${key}`,
        eventType: 'trip-update',
        targetId: row.id,
        payload: { ...payload, tag: `borail-trip-${row.id}-${key}`, deadline }
      }, now));
    }
    writes.push(env.DB.prepare('UPDATE saved_trips SET flags_json = ?, trip_json = ? WHERE id = ?')
      .bind(JSON.stringify(flags), JSON.stringify(trip), row.id));
    if (writes.length >= 6) break;
  }
  if (writes.length) await env.DB.batch(writes);
}

async function evaluateWinterEmergency(env, now) {
  const context = SERVICE.context(now);
  if (!context.winterEmergency) return;
  await insertEvent(env, {
    id: `winter-emergency:${context.dateKey}`,
    eventType: 'winter-emergency',
    targetId: null,
    preference: 'winterEmergency',
    payload: {
      title: 'BORail Winter Emergency Service',
      body: 'Winter Emergency protocols are in effect today. Allow extra travel time and review the Winter Emergency Map.',
      tag: `borail-winter-${context.dateKey}`,
      url: 'map.html'
    }
  }, now);
}

function elevatorCandidate(outage, kind) {
  const fixed = kind === 'fixed';
  return {
    id: `elevator-${kind}:${outage.id}`,
    eventType: fixed ? 'elevator-fixed' : 'elevator-outage',
    targetId: outage.station,
    preference: fixed ? 'stationElevatorFixed' : 'stationElevatorOutage',
    payload: {
      title: `${fixed ? 'Elevator Fixed' : 'Elevator Outage Reported'} - ${outage.station}`,
      body: fixed
        ? `${outage.direction} elevator service has returned to normal.`
        : `${outage.direction} elevator is currently unavailable. Check the Status page for repair details.`,
      tag: `borail-elevator-${outage.id}-${kind}`,
      url: `status.html?station=${encodeURIComponent(outage.station)}`
    }
  };
}

async function evaluateElevators(env, now) {
  const today = STATUS.buildDailyElevatorState(now.getTime());
  const yesterday = STATUS.buildDailyElevatorState(now.getTime() - 24 * 60 * 60 * 1000);
  const dayStart = CLOCK.startOfDay(now).getTime();
  for (const outage of today.outages) {
    if (outage.id.startsWith('daily-repaired-')) continue;
    const reportWindow = dayStart + 6 * 60 * 60 * 1000;
    if (now.getTime() >= reportWindow && STATUS.elevatorStatusFor(outage, now.getTime()) !== 'repaired') {
      await insertEvent(env, elevatorCandidate(outage, 'outage'), now);
    }
  }
  for (const outage of yesterday.outages) {
    if (outage.id.startsWith('daily-repaired-')) continue;
    if (STATUS.elevatorStatusFor(outage, now.getTime()) === 'repaired') {
      await insertEvent(env, elevatorCandidate(outage, 'fixed'), now);
    }
  }
}

function wantsEvent(subscription, event) {
  if (event.event_type === 'operations') return true;
  let preferences;
  try { preferences = normalizePreferences(JSON.parse(subscription.preferences_json)); }
  catch { return false; }
  const payload = JSON.parse(event.payload_json);
  if (preferences.alerts[payload.preference] === false) return false;
  if (event.event_type.startsWith('line-')) return preferences.services.includes(event.target_id);
  if (event.event_type.startsWith('elevator-')) return preferences.stations.includes(event.target_id);
  return event.event_type === 'winter-emergency' && preferences.alerts.winterEmergency !== false;
}

async function sendPush(env, subscription, payload) {
  const vapid = {
    subject: env.VAPID_SUBJECT || 'mailto:notifications@rideborailmc.net',
    publicKey: env.VAPID_SERVER_PUBLIC_KEY,
    privateKey: env.VAPID_SERVER_PRIVATE_KEY
  };
  const pushSubscription = {
    endpoint: subscription.endpoint,
    expirationTime: null,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth }
  };
  const requestInit = await buildPushPayload({ data: JSON.stringify(payload), options: { ttl: 300 } }, pushSubscription, vapid);
  return fetch(subscription.endpoint, requestInit);
}

async function deliverEvent(env, event, subscription) {
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO deliveries (subscription_id, event_id, status, attempts, last_attempt_at)
    VALUES (?, ?, 'pending', 1, ?) ON CONFLICT(subscription_id, event_id) DO UPDATE SET
    status = 'pending', attempts = attempts + 1, last_attempt_at = excluded.last_attempt_at`)
    .bind(subscription.id, event.id, now).run();
  try {
    const storedPayload = JSON.parse(event.payload_json);
    const { preference: _preference, deadline: _deadline, ...payload } = storedPayload;
    const response = await sendPush(env, subscription, payload);
    if (response.ok) {
      await env.DB.prepare(`UPDATE deliveries SET status = 'sent', delivered_at = ?
        WHERE subscription_id = ? AND event_id = ?`).bind(now, subscription.id, event.id).run();
      return false;
    }
    if (response.status === 404 || response.status === 410) {
      await env.DB.prepare('DELETE FROM subscriptions WHERE id = ?').bind(subscription.id).run();
      return false;
    }
    await env.DB.prepare(`UPDATE deliveries SET status = 'failed' WHERE subscription_id = ? AND event_id = ?`)
      .bind(subscription.id, event.id).run();
    return true;
  } catch (error) {
    await env.DB.prepare(`UPDATE deliveries SET status = 'failed' WHERE subscription_id = ? AND event_id = ?`)
      .bind(subscription.id, event.id).run();
    console.error('Push delivery failed', subscription.id, event.id, error);
    return true;
  }
}

async function processPendingEvents(env) {
  const eventRows = await env.DB.prepare(`SELECT events.*, saved_trips.subscription_id AS trip_subscription_id
    FROM events LEFT JOIN saved_trips ON events.event_type = 'trip-update' AND events.target_id = saved_trips.id
    WHERE processed_at IS NULL ORDER BY created_at LIMIT 12`).all();
  if (!eventRows.results.length) return;
  const subscriptions = (await env.DB.prepare('SELECT * FROM subscriptions').all()).results || [];
  const ids = eventRows.results.map(event => event.id);
  const { results: priorDeliveries } = await env.DB.prepare(`SELECT subscription_id, event_id FROM deliveries
    WHERE event_id IN (${ids.map(() => '?').join(',')}) AND (status IN ('sent', 'expired') OR attempts >= 3)`)
    .bind(...ids).all();
  const finished = new Set(priorDeliveries.map(row => JSON.stringify([row.event_id, row.subscription_id])));
  const writes = [];
  let budget = 6;
  for (const event of eventRows.results || []) {
    let retry = false;
    const tripEvent = event.event_type === 'trip-update';
    const deadline = tripEvent ? JSON.parse(event.payload_json).deadline : null;
    for (const subscription of subscriptions) {
      if (tripEvent ? subscription.id !== event.trip_subscription_id || Date.now() >= deadline : !wantsEvent(subscription, event)) continue;
      if (finished.has(JSON.stringify([event.id, subscription.id]))) continue;
      if (!budget) { retry = true; break; }
      budget -= 1;
      retry = (await deliverEvent(env, event, subscription)) || retry;
    }
    if (!retry) writes.push(env.DB.prepare('UPDATE events SET processed_at = ? WHERE id = ?').bind(new Date().toISOString(), event.id));
    if (!budget) break;
  }
  if (writes.length) await env.DB.batch(writes);
}

async function runNotificationCycle(env, date = new Date()) {
  const operations = await operationsSnapshot(env, date.getTime());
  const events = operationalEvents(operations, date.getTime());
  if (events.length) await env.DB.batch(events.map(event => eventStatement(env, event, date)));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM operations_sessions WHERE expires_at <= ?').bind(date.getTime()),
    env.DB.prepare('DELETE FROM operations_login_limits WHERE window_start < ?').bind(Math.floor(date.getTime() / 900000) - 2)
  ]);
  await evaluateLineTransitions(env, date, operations);
  await evaluateWinterEmergency(env, date);
  await evaluateElevators(env, date);
  await evaluateTrips(env, date, operations);
  await processPendingEvents(env);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
    if (!isAllowedBrowserRequest(request)) return json(request, { error: 'Origin is not allowed.' }, 403);
    const url = new URL(request.url);
    try {
      const operations = await operationsRequest(request, env, url, { json, hashToken, randomToken, timingSafeEqual, parseBearer });
      if (operations) return operations;
      if (request.method === 'GET' && url.pathname === '/health') return json(request, { ok: true, service: 'BORail notifications' });
      if (request.method === 'GET' && url.pathname === '/config') {
        if (!env.VAPID_SERVER_PUBLIC_KEY) return json(request, { error: 'Notification service is not configured.' }, 503);
        return json(request, { vapidPublicKey: env.VAPID_SERVER_PUBLIC_KEY });
      }
      if (request.method === 'POST' && url.pathname === '/subscriptions') return await createSubscription(request, env);
      const tripMatch = /^\/subscriptions\/([^/]+)\/trips(?:\/([^/]+))?$/.exec(url.pathname);
      if (tripMatch) return await manageTrips(request, env, decodeURIComponent(tripMatch[1]),
        tripMatch[2] && decodeURIComponent(tripMatch[2]));
      const subscriptionMatch = /^\/subscriptions\/([^/]+)(?:\/(refresh))?$/.exec(url.pathname);
      if (subscriptionMatch) {
        const id = decodeURIComponent(subscriptionMatch[1]);
        if (request.method === 'PATCH' && !subscriptionMatch[2]) return await updateSubscription(request, env, id);
        if (request.method === 'DELETE' && !subscriptionMatch[2]) return await deleteSubscription(request, env, id);
        if (request.method === 'POST' && subscriptionMatch[2] === 'refresh') return await refreshSubscription(request, env, id);
      }
      if (request.method === 'POST' && url.pathname === '/admin/service-override') return await setServiceOverride(request, env);
      return json(request, { error: 'Not found.' }, 404);
    } catch (error) {
      console.error(error);
      return json(request, { error: error instanceof Error ? error.message : 'Request failed.' }, 400);
    }
  },

  async scheduled(controller, env) {
    await runNotificationCycle(env, new Date(controller.scheduledTime));
  }
};

export { decideLineTransition, elevatorCandidate, evaluateTrips, lineEvent, normalizePreferences, runNotificationCycle, serviceLabel, wantsEvent };
