import '../../assets/js/live-map-id-geometry.js';
import '../../assets/js/operations.js';

const OPS = globalThis.BORailOperations;
const DAY = 86400000;
const SERVICE_IDS = new Set('A-local A-express B-local B-express C-local D-local E-local F-local F-express G-local S-local S-express'.split(' '));
const schedule = () => globalThis.BORailSchedule;
const clock = () => globalThis.BORailTime;
const stations = () => new Set(schedule().STATIONS.map(station => station.id));

export const serviceLabel = id => id.length === 1 ? `All ${id} Service` :
  `${id[0]} ${id.endsWith('express') ? 'Express' : 'Line'}`;
export const easternTime = time => clock().formatDateTime(time, {
  month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
});

export async function operationsSnapshot(env, now = Date.now()) {
  const row = await env.DB.prepare('SELECT * FROM operations_revisions ORDER BY revision DESC LIMIT 1').first();
  const changes = JSON.parse(row.changes_json).filter(change => (change.endsAt ?? Infinity) > now - 2 * DAY);
  return { revision: row.revision, publishedAt: row.published_at, changes };
}

export function describeService(id, date, snapshot) {
  const mode = globalThis.BORailService.context(date).mode;
  return OPS.describeService(id, schedule().routesForDate(date), date.getTime(), snapshot,
    route => schedule().getEffectiveRoutePattern(route, mode));
}

export function operationalEvents(snapshot, now) {
  const events = [];
  const cutoff = now - DAY;
  const timestamps = new Set();
  function add(id, targetId, title, body, at, url) {
    events.push({
      id: `operations:${id}:${at}`, eventType: 'operations', targetId,
      payload: { title, body, url, tag: `borail-operations-${id}` }
    });
  }
  for (const change of snapshot.changes) {
    if (change.kind === 'train' || change.endsAt <= change.startsAt && change.endsAt != null) continue;
    const { id, target, kind, startsAt, endsAt, reason } = change;
    const url = kind === 'station' ? `status.html?closedStation=${encodeURIComponent(target)}`
      : kind === 'system' ? 'status.html?operations=system'
        : `status.html?service=${encodeURIComponent(target.length === 1 ? `${target}-local` : target)}`;
    if (kind === 'station') {
      if (startsAt > cutoff && startsAt <= now) {
        timestamps.add(startsAt);
        add(id, target, `Station Closed - ${target}`,
          `Reason: ${reason.replace(/[.!?]+$/, '')}. ${endsAt == null ? 'Closed until further notice.' : `Expected reopening: ${easternTime(endsAt)}.`}`, startsAt, url);
      }
      if (endsAt != null && endsAt > cutoff && endsAt <= now) {
        timestamps.add(endsAt);
        if (!OPS.atTime(snapshot, endsAt).stations.has(target)) {
          add(id, target, `Station Reopened - ${target}`,
            `${target} has reopened. New departures are returning to normal scheduled service.`, endsAt, url);
        }
      }
      continue;
    }
    const label = kind === 'system' ? 'BORail System-Wide' : serviceLabel(target);
    const service = kind === 'system' ? 'BORail service' : target.length === 1
      ? `${target} Line and ${target} Express service` : `${label} service`;
    const trains = kind === 'system' ? 'trains' : target.length === 1 ? `${target} Line and ${target} Express trains` : `${label} trains`;
    const newTrains = kind === 'system' ? 'BORail trains' : target.length === 1 ? `${target} trains` : trains;
    if (startsAt > cutoff && startsAt <= now) {
      add(id, target, `${label} Shutdown`,
        `Reason: ${reason.replace(/[.!?]+$/, '')}. Active ${trains} will complete their trips. No new ${newTrains} will enter service.`, startsAt, url);
    }
    if (endsAt != null && endsAt > cutoff && endsAt <= now) {
      const otherShutdowns = OPS.atTime(snapshot, endsAt).shutdowns;
      const covered = kind === 'system' ? otherShutdowns.some(item => item.kind === 'system')
        : [...SERVICE_IDS].filter(key => OPS.affectsService(change, key)).every(key =>
          otherShutdowns.some(item => OPS.affectsService(item, key)));
      if (!covered) add(id, target, `${label}${kind === 'system' ? ' Service' : ''} Reactivated`,
        `${service} has been reactivated. New departures are returning to the current schedule.`, endsAt, url);
    }
  }
  for (const at of timestamps) {
    for (const id of SERVICE_IDS) {
      const previous = describeService(id, new Date(at - 1), snapshot)?.type;
      const current = describeService(id, new Date(at), snapshot)?.type;
      const label = serviceLabel(id);
      const url = `status.html?service=${id}`;
      if (current === 'closure-noservice' && previous !== current) {
        add(`${id}-auto-stop`, id, `${label} Shutdown`,
          `${label} service has been suspended because station closures have left no available terminal pair. Active trains will complete their trips.`, at, url);
      }
      if (previous === 'closure-noservice' && !['closure-noservice', 'system-closed', 'admin-noservice'].includes(current)) {
        add(`${id}-auto-start`, id, `${label} Reactivated`,
          `${label} service has been reactivated following the reopening of its terminal stations. New departures are returning to the current schedule.`, at, url);
      }
    }
  }
  return events;
}

function dateForRun(id) {
  const dateKey = /\d{4}-\d{2}-\d{2}$/.exec(id)?.[0];
  return dateKey && clock().fromWallTime(dateKey, '12:00');
}

function selectedRun(id, now, snapshot, includeCanceled = false) {
  const date = dateForRun(id);
  if (!date) throw Error('Choose a valid service date.');
  const options = schedule().planningOptions(date, new Date(now));
  const run = schedule().buildScheduledRuns(date, true, {
    ...options, operations: snapshot, runIds: new Set([id]), includeCanceled
  }).find(candidate => candidate.id === id);
  if (!run || OPS.serviceDayStart(date) + run.stops.at(-1).actualDepartureSec * 1000 <= now) {
    throw Error('That train has finished or is no longer available.');
  }
  return { run, date };
}

function dateValue(value, name, now) {
  if (!Number.isSafeInteger(value) || value < now - 60000 || value > now + 366 * DAY) {
    throw Error(`Choose a valid Eastern ${name} within the next year.`);
  }
  return Math.max(value, now);
}

export function prepareRevision(snapshot, actions, now) {
  if (!Array.isArray(actions) || !actions.length || actions.length > 30) throw Error('Submit 1–30 changes.');
  const changes = snapshot.changes.map(change => ({ ...change }));
  const summary = [];
  for (const action of actions) {
    const { kind } = action;
    const target = kind === 'system' ? 'system' : OPS.stationName(String(action.target || ''));
    if (!['station', 'service', 'system', 'train'].includes(kind)) throw Error('Unknown action.');
    if (kind === 'station' && !stations().has(target)) throw Error('Choose a known station.');
    if (kind === 'service' && !SERVICE_IDS.has(target) &&
        [...SERVICE_IDS].filter(id => id[0] === target).length < 2) throw Error('Choose a known service.');
    const id = crypto.randomUUID();
    const startsAt = action.startsAt == null ? now : dateValue(action.startsAt, 'start time', now);
    const endsAt = action.endsAt == null ? null : dateValue(action.endsAt, 'end time', now);
    const recoveryMinutes = kind === 'system' ? Number(action.recoveryMinutes || 0) : 0;
    if (!Number.isInteger(recoveryMinutes) || recoveryMinutes < 0 || recoveryMinutes > 180) {
      throw Error('Recovery must be between 0 and 180 minutes.');
    }
    if (kind === 'train') {
      const current = { ...snapshot, changes };
      const { run, date } = selectedRun(target, now, current, action.restore === true);
      const dayStart = OPS.serviceDayStart(date);
      const original = selectedRun(target, now, {
        ...snapshot, changes: changes.filter(change => change.kind !== 'train' || change.target !== target)
      }).run;
      const anchor = OPS.editAnchor(run, (now - dayStart) / 1000);
      const locked = anchor < 0 ? [] : run.stops.slice(0, anchor + 1).map(stop => stop.name);
      if (action.anchor != null && action.anchor !== locked.length) throw Error('The train moved. Find and select it again.');
      const originalNames = original.stops.map(stop => stop.name);
      const normalRemainder = locked.length ? originalNames.slice(originalNames.indexOf(locked.at(-1)) + 1) : originalNames;
      const requested = action.restore ? normalRemainder : action.stops;
      if (!action.cancel && (!Array.isArray(requested) || requested.length > 70)) throw Error('Supply an ordered stop list.');
      const names = action.cancel ? [] : requested.map(name => OPS.stationName(String(name).trim()));
      if (names.some(name => !stations().has(name)) || names.some((name, index) => names[index - 1] === name)) {
        throw Error('The stop list contains an invalid or repeated adjacent station.');
      }
      if (names.some(name => locked.includes(name)) && !action.advanced) throw Error('A stop already passed requires an advanced detour.');
      if (action.restore && locked.length && !originalNames.includes(locked.at(-1))) throw Error('Choose a connected stop list from the current location.');
      const closed = OPS.atTime(current, Math.max(now, dayStart + run.stops[0].actualDepartureSec * 1000)).stations;
      if (names.some(name => closed.has(name))) throw Error('A requested stop is closed.');
      const change = {
        id, kind, target, startsAt: now, endsAt: dayStart + 2 * DAY,
        stops: names, advanced: action.advanced === true, cancel: action.cancel === true,
        restore: action.restore === true
      };
      const revised = OPS.applyTrainEdit(run, change, dayStart);
      if (revised && revised.stops.at(-1).actualDepartureSec > 27 * 3600) throw Error('The updated run must finish by 3:00 AM Eastern.');
      changes.push(change);
      summary.push({ ...change, locked, run: revised });
      continue;
    }

    if (action.restore) {
      const matches = changes.filter(change => change.kind === kind && change.target === target &&
        (change.endsAt == null || change.endsAt > startsAt));
      if (!matches.length) throw Error('There is no matching closure or shutdown to restore.');
      for (const existing of matches) {
        existing.endsAt = startsAt;
        if (kind === 'system') existing.recoveryMinutes = recoveryMinutes;
      }
      summary.push({ id, kind, target, startsAt, restore: true, recoveryMinutes });
      continue;
    }

    if (endsAt != null && endsAt <= startsAt) throw Error('The end time must be after the start.');
    const reason = OPS.publicReason(String(action.reason || '').trim());
    if (!reason || reason.length > 240) throw Error('Enter a public reason of 1–240 characters.');
    if (changes.some(change => change.kind === kind && change.target === target &&
      (change.endsAt == null || change.endsAt > Math.max(change.startsAt, startsAt)) &&
      (endsAt == null || change.startsAt < endsAt))) {
      throw Error('That closure or shutdown overlaps an existing one. Restore the existing action first.');
    }
    const change = { id, kind, target, startsAt, endsAt, reason, recoveryMinutes };
    changes.push(change);
    const date = new Date(startsAt);
    const impacts = [...SERVICE_IDS].map(service => [service, describeService(service, date, { changes })])
      .filter(([, info]) => info);
    summary.push({ ...change, impacts });
  }
  return { changes, summary };
}

function publicSnapshot(snapshot) {
  return {
    ...snapshot,
    changes: snapshot.changes.filter(change => change.endsAt == null || change.endsAt > change.startsAt)
  };
}

export async function operationsRequest(request, env, url, helpers) {
  const { json, hashToken, randomToken, timingSafeEqual, parseBearer } = helpers;
  const reply = (body, status) => json(request, body, status);
  const now = Date.now();
  if (request.method === 'GET' && url.pathname === '/operations') {
    return reply(publicSnapshot(await operationsSnapshot(env, now)));
  }
  if (!url.pathname.startsWith('/admin/operations/')) return null;
  const action = url.pathname.split('/').at(-1);
  async function body() {
    const input = await request.text();
    if (input.length > 64000) throw Error('Request is too large.');
    return JSON.parse(input);
  }
  if (action === 'login' && request.method === 'POST') {
    if (!env.OPERATIONS_PASSWORD_HASH) return reply({ error: 'Admin Sign In is awaiting setup.' }, 503);
    const windowStart = Math.floor(now / 900000);
    const bucket = await hashToken(request.headers.get('CF-Connecting-IP') || 'local');
    const { attempts } = await env.DB.prepare(`INSERT INTO operations_login_limits VALUES (?, ?, 1)
      ON CONFLICT(bucket, window_start) DO UPDATE SET attempts = attempts + 1 RETURNING attempts`)
      .bind(bucket, windowStart).first();
    if (attempts > 8) return reply({ error: 'Too many attempts. Try again in up to 15 minutes.' }, 429);
    const { password } = await body();
    if (typeof password !== 'string' || password.length > 256 ||
        !timingSafeEqual(await hashToken(password), env.OPERATIONS_PASSWORD_HASH)) {
      return reply({ error: 'Incorrect password.' }, 401);
    }
    const token = randomToken();
    const expiresAt = now + 45 * 60000;
    await env.DB.prepare('INSERT INTO operations_sessions VALUES (?, ?)')
      .bind(await hashToken(token), expiresAt).run();
    return reply({ token, expiresAt });
  }
  const token = parseBearer(request);
  if (token.length !== 43) return reply({ error: 'Sign in to continue.' }, 401);
  const hash = await hashToken(token);
  if (!await env.DB.prepare('SELECT 1 FROM operations_sessions WHERE token_hash = ? AND expires_at > ?').bind(hash, now).first()) {
    return reply({ error: 'Your admin session expired. Sign in again.' }, 401);
  }
  if (action === 'logout' && request.method === 'POST') {
    await env.DB.prepare('DELETE FROM operations_sessions WHERE token_hash = ?').bind(hash).run();
    return reply({ ok: true });
  }
  const snapshot = await operationsSnapshot(env, now);
  if (action === 'overview' && request.method === 'GET') {
    const { results } = await env.DB.prepare(`SELECT revision, published_at, summary_json FROM operations_revisions
      WHERE revision > 0 ORDER BY revision DESC LIMIT 30`).all();
    return reply({ ...publicSnapshot(snapshot), history: results.map(row => ({
      revision: row.revision, publishedAt: row.published_at, actions: JSON.parse(row.summary_json)
    })) });
  }
  if (action === 'runs' && request.method === 'GET') {
    const date = clock().fromWallTime(url.searchParams.get('date'), '12:00');
    if (!date) throw Error('Choose a valid service date.');
    const start = OPS.serviceDayStart(date);
    const seconds = (now - start) / 1000;
    const after = url.searchParams.get('after') || '06:00';
    if (!/^\d{2}:\d{2}$/.test(after)) throw Error('Choose a valid departure time.');
    const [hour, minute] = after.split(':').map(Number);
    const service = url.searchParams.get('service');
    const direction = url.searchParams.get('direction');
    const origin = url.searchParams.get('origin');
    const destination = url.searchParams.get('destination');
    const runs = schedule().buildScheduledRuns(date, true, {
      ...schedule().planningOptions(date, new Date(now)), operations: snapshot, includeCanceled: true
    }).filter(run => (!service || OPS.serviceKey(run) === service) &&
      (!direction || run.dir === direction) && (!origin || run.origin === origin) &&
      (!destination || run.destination === destination) &&
      run.departureMin >= hour * 60 + minute && run.stops.at(-1).actualDepartureSec > seconds);
    runs.sort((left, right) => left.departureMin - right.departureMin);
    const requested = url.searchParams.get('run');
    return reply({ runs: (requested ? runs.filter(run => run.id === requested) : runs.slice(0, 120))
      .map(run => ({ ...run, locked: OPS.editAnchor(run, seconds) + 1 })), total: runs.length });
  }
  if (['preview', 'publish'].includes(action) && request.method === 'POST') {
    const input = await body();
    if (input.revision !== snapshot.revision) return reply({ error: 'Operations changed on another device. Reload and preview again.' }, 409);
    const { changes, summary } = prepareRevision(snapshot, input.actions, now);
    if (action === 'preview') {
      const times = [...new Set(summary.filter(item => item.kind !== 'train').map(item => item.startsAt))];
      const notices = times.flatMap(at => operationalEvents({ changes }, at)
        .filter(event => event.id.endsWith(`:${at}`)).map(event => event.payload));
      return reply({ summary, notices });
    }
    const revision = snapshot.revision + 1;
    const compactSummary = summary.map(({ run, impacts, ...entry }) => entry);
    const result = await env.DB.prepare(`INSERT OR IGNORE INTO operations_revisions
      SELECT ?, ?, ?, ? WHERE (SELECT MAX(revision) FROM operations_revisions) = ?`)
      .bind(revision, now, JSON.stringify(changes), JSON.stringify(compactSummary), snapshot.revision).run();
    if (!result.meta.changes) return reply({ error: 'Another admin published first. Reload and preview again.' }, 409);
    return reply({ revision, publishedAt: now, summary: compactSummary });
  }
  return reply({ error: 'Not found.' }, 404);
}
