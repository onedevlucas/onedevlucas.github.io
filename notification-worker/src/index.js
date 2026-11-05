import { buildPushPayload } from '@block65/webcrypto-web-push';
import '../../assets/js/time.js';
import '../../assets/js/service-calendar.js';
import '../../assets/js/status.js';

const CLOCK = globalThis.BORailTime;
const SERVICE = globalThis.BORailService;
const STATUS = globalThis.BORailStatusEngine;

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
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) }
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
    'line-normal': { title: `${label} - Normal Service Resumed`, body: `${label} trains are operating normally again.`, preference: 'lineNormalResumed' }
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

async function insertEvent(env, event, now = new Date()) {
  await env.DB.prepare(`INSERT OR IGNORE INTO events
    (id, event_type, target_id, payload_json, created_at, processed_at) VALUES (?, ?, ?, ?, ?, NULL)`)
    .bind(event.id, event.eventType, event.targetId || null, JSON.stringify({ ...event.payload, preference: event.preference }), now.toISOString()).run();
}

async function evaluateLineTransitions(env, now) {
  const signals = STATUS.computeStatusDelaySignals(now);
  const overrideRows = await env.DB.prepare(`SELECT * FROM service_overrides
    WHERE expires_at IS NULL OR expires_at > ?`).bind(now.toISOString()).all();
  const overrides = new Map((overrideRows.results || []).map(row => [row.service_id, row]));

  for (const service of STATUS.services) {
    const signal = { ...signals[service.id] };
    const override = overrides.get(service.id);
    let current = signal.type;
    if (override?.status === 'noservice') {
      current = 'unexpected-noservice';
      signal.reason = override.reason;
    }
    const key = `line:${service.id}`;
    const previous = await env.DB.prepare('SELECT * FROM event_state WHERE state_key = ?').bind(key).first();
    const transition = decideLineTransition(service.id, previous, current, signal, now);
    const { lastDisruption, event } = transition;

    await env.DB.prepare(`INSERT INTO event_state (state_key, current_state, last_disruption, detail_json, updated_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(state_key) DO UPDATE SET
      current_state = excluded.current_state, last_disruption = excluded.last_disruption,
      detail_json = excluded.detail_json, updated_at = excluded.updated_at`)
      .bind(key, current, lastDisruption, JSON.stringify(signal), now.toISOString()).run();
    if (event) await insertEvent(env, event, now);
  }
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
  const previous = await env.DB.prepare('SELECT * FROM deliveries WHERE subscription_id = ? AND event_id = ?')
    .bind(subscription.id, event.id).first();
  if (previous?.status === 'sent' || previous?.status === 'expired') return false;
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO deliveries (subscription_id, event_id, status, attempts, last_attempt_at)
    VALUES (?, ?, 'pending', 1, ?) ON CONFLICT(subscription_id, event_id) DO UPDATE SET
    status = 'pending', attempts = attempts + 1, last_attempt_at = excluded.last_attempt_at`)
    .bind(subscription.id, event.id, now).run();
  try {
    const storedPayload = JSON.parse(event.payload_json);
    const { preference: _preference, ...payload } = storedPayload;
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
  const eventRows = await env.DB.prepare('SELECT * FROM events WHERE processed_at IS NULL ORDER BY created_at LIMIT 50').all();
  const subscriptions = (await env.DB.prepare('SELECT * FROM subscriptions').all()).results || [];
  for (const event of eventRows.results || []) {
    let retry = false;
    for (const subscription of subscriptions) {
      if (!wantsEvent(subscription, event)) continue;
      retry = (await deliverEvent(env, event, subscription)) || retry;
    }
    if (!retry) await env.DB.prepare('UPDATE events SET processed_at = ? WHERE id = ?').bind(new Date().toISOString(), event.id).run();
  }
}

async function runNotificationCycle(env, date = new Date()) {
  await evaluateLineTransitions(env, date);
  await evaluateWinterEmergency(env, date);
  await evaluateElevators(env, date);
  await processPendingEvents(env);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
    if (!isAllowedBrowserRequest(request)) return json(request, { error: 'Origin is not allowed.' }, 403);
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/health') return json(request, { ok: true, service: 'BORail notifications' });
      if (request.method === 'GET' && url.pathname === '/config') {
        if (!env.VAPID_SERVER_PUBLIC_KEY) return json(request, { error: 'Notification service is not configured.' }, 503);
        return json(request, { vapidPublicKey: env.VAPID_SERVER_PUBLIC_KEY });
      }
      if (request.method === 'POST' && url.pathname === '/subscriptions') return await createSubscription(request, env);
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

export { decideLineTransition, elevatorCandidate, lineEvent, normalizePreferences, runNotificationCycle, serviceLabel };
