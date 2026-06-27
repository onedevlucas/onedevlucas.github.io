// ----- base line probabilities (shared by local/express variants) -----
    const BASE_LINES = [
      { letter:'A', color:'var(--line-Green)',  probs:{ ok:90, minor:3, major:5, none:2 } }, // formerly Green
      { letter:'F', color:'var(--line-Red)',    probs:{ ok:85, minor:9, major:4, none:2 } }, // formerly Red
      { letter:'G', color:'var(--line-Gold)',   probs:{ ok:95, minor:2, major:2, none:1 } }, // formerly Gold
      { letter:'D', color:'var(--line-Orange)', probs:{ ok:99, minor:0, major:0, none:1 } }, // formerly Orange
      { letter:'B', color:'var(--line-Blue)',   probs:{ ok:80, minor:4, major:15, none:1 } }, // formerly Blue
      { letter:'C', color:'var(--line-Pink)',   probs:{ ok:86, minor:4, major:5, none:5 } }, // formerly Pink
      { letter:'E', color:'var(--line-Brown)',  probs:{ ok:86, minor:1, major:9, none:4 } }, // formerly Brown
      // new Silver Line
      { letter:'S', color:'var(--line-Silver)', probs:{ ok:90, minor:4, major:4, none:2 } },
    ];
    const BASE = Object.fromEntries(BASE_LINES.map(x => [x.letter, x]));

    // ----- services shown on the status page -----
    // nameHtml is inserted via innerHTML
    const SERVICES = [
      // A (Green) - Local + Express
      { id:'A-local',   nameHtml:'Line',        icon:'assets/images/line-icons/a-local.png',    letter:'A', mode:'local'   },
      { id:'A-express', nameHtml:'Line',  icon:'assets/images/line-icons/a-express.png',  letter:'A', mode:'express' },

      // F (Red) - Local + Express
      { id:'F-local',   nameHtml:'Line',        icon:'assets/images/line-icons/f-local.png',    letter:'F', mode:'local'   },
      { id:'F-express', nameHtml:'Line',  icon:'assets/images/line-icons/f-express.png',  letter:'F', mode:'express' },

      // G (Gold) - Local
      { id:'G-local',   nameHtml:'Line',        icon:'assets/images/line-icons/g-local.png',    letter:'G', mode:'local'   },

      // D (Orange) - Local
      { id:'D-local',   nameHtml:'Line',        icon:'assets/images/line-icons/d-local.png',    letter:'D', mode:'local'   },

      // B (Blue) - Local + Express
      { id:'B-local',   nameHtml:'Line',        icon:'assets/images/line-icons/b-local.png',    letter:'B', mode:'local'   },
      { id:'B-express', nameHtml:'Line',        icon:'assets/images/line-icons/b-express.png',  letter:'B', mode:'express' },

      // C (Pink) - Local
      { id:'C-local',   nameHtml:'Line',        icon:'assets/images/line-icons/c-local.png',    letter:'C', mode:'local'   },

      // E (Brown) - Local
      { id:'E-local',   nameHtml:'Line',        icon:'assets/images/line-icons/e-local.png',    letter:'E', mode:'local'   },

      // S (Silver) - Local + Express
      { id:'S-local',   nameHtml:'Line',        icon:'assets/images/line-icons/s-local.png',    letter:'S', mode:'local'   },
      { id:'S-express', nameHtml:'Line',  icon:'assets/images/line-icons/s-express.png',  letter:'S', mode:'express' },
    ].map(s => ({ ...s, ...BASE[s.letter] }));

    // 3 reasons per type (white text in details)
    const REASONS = {
      minor: [
        'Signal Maintenance - Causing Reduced Speed On Tracks',
        'Track Inspection In Progress - Possible Track Damage, Crews Assisting.',
        'Platform Crowding - Passengers Delaying Trains at Platform.'
      ],
      major: [
        'Disabled Train On Tracks — Crews Assisting; Expect Extended Delays.',
        'Switch Malfunction Near A Junction - Single-Tracking Through The Area.',
        'Police Activity At A Station - Trains Are Bypassing Station.'
      ],
      none: [
        'Severe Weather Impacted — Service Suspended until further notice.',
        'Electrical Outage on track - Service Suspended until further notice.',
        'Emergency Track Repair - Service Suspended until further notice.',
        'Signal System Fault - Service Suspended until further notice.',
        'Staff Shortage - Service Suspended until further notice.',
        'Fire/Smoke Incident - Service Suspended until further notice.'
      ]
    };

    // ----- time-based service rules (uses the viewer's local time) -----
    const SCHEDULE = {
      morningRushStart: 6*60 + 30,   // 6:30 AM
      morningRushEnd:   9*60 + 30,   // 9:30 AM
      eveningRushStart: 17*60 + 0,   // 5:00 PM
      eveningRushEnd:   19*60 + 30,  // 7:30 PM
      lateNightStart:   22*60 + 30,  // 10:30 PM
      lateNightEnd:     6*60 + 30    // 6:30 AM
    };

    const LATE_NIGHT_OFF = new Set(['S-local','S-express','G-local','D-local']);
    const STATUS_DELAY_THRESHOLD_MIN_TRAINS = 3;
    const STATUS_DELAY_THRESHOLD_RATIO = 0.25;
    const STATUS_DELAY_LOOKBACK_MIN = 45;
    const STATUS_DELAY_LOOKAHEAD_MIN = 120;
    const STATUS_BASE_DELAY_RATE = 0.10;
    const STATUS_RUSH_DELAY_MULTIPLIER = 1.09;

    const STATUS_LINE_SERVICE = {
      A: [{ start: '04:00', end: '05:59', every: 20 }, { start: '06:00', end: '09:29', every: 7 }, { start: '09:30', end: '16:59', every: 15 }, { start: '17:00', end: '19:29', every: 7 }, { start: '19:30', end: '22:29', every: 20 }],
      F: [{ start: '04:00', end: '05:59', every: 20 }, { start: '06:00', end: '09:29', every: 7 }, { start: '09:30', end: '16:59', every: 15 }, { start: '17:00', end: '19:29', every: 7 }, { start: '19:30', end: '22:29', every: 20 }],
      B: [{ start: '04:00', end: '05:59', every: 25 }, { start: '06:00', end: '09:29', every: 5 }, { start: '09:30', end: '16:59', every: 15 }, { start: '17:00', end: '19:29', every: 5 }, { start: '19:30', end: '22:29', every: 25 }],
      C: [{ start: '04:00', end: '05:59', every: 20 }, { start: '06:00', end: '09:29', every: 7 }, { start: '09:30', end: '16:59', every: 15 }, { start: '17:00', end: '19:29', every: 7 }, { start: '19:30', end: '22:29', every: 20 }],
      E: [{ start: '04:00', end: '05:59', every: 25 }, { start: '06:00', end: '09:29', every: 5 }, { start: '09:30', end: '16:59', every: 15 }, { start: '17:00', end: '19:29', every: 5 }, { start: '19:30', end: '22:29', every: 25 }],
      S: [{ start: '04:00', end: '05:59', every: 20 }, { start: '06:00', end: '09:29', every: 7 }, { start: '09:30', end: '16:59', every: 15 }, { start: '17:00', end: '19:29', every: 7 }, { start: '19:30', end: '22:29', every: 20 }],
      D: [{ start: '05:30', end: '22:30', every: 12 }],
      G: [{ start: '05:30', end: '22:30', every: 12 }]
    };

    const STATUS_DELAY_ROUTES = [
      { serviceId:'F', isExpress:false, tag:'LCL', origin:'Kenilworth', destination:'Newkirk', stopCount:10 },
      { serviceId:'F', isExpress:false, tag:'LCL', origin:'Boylston', destination:'Newkirk', stopCount:11 },
      { serviceId:'F', isExpress:false, tag:'LCL', origin:'Newkirk', destination:'Kenilworth', stopCount:10 },
      { serviceId:'F', isExpress:false, tag:'LCL', origin:'Newkirk', destination:'Boylston', stopCount:11 },
      { serviceId:'F', isExpress:true, tag:'EXP', origin:'Whitebranch', destination:'Newkirk', stopCount:10 },
      { serviceId:'F', isExpress:true, tag:'EXP', origin:'Newkirk', destination:'Whitebranch', stopCount:10 },
      { serviceId:'G', isExpress:false, tag:'LCL', origin:'Bradford Bay', destination:'Berwick Hall', stopCount:4 },
      { serviceId:'G', isExpress:false, tag:'LCL', origin:'Berwick Hall', destination:'Bradford Bay', stopCount:4 },
      { serviceId:'S', isExpress:false, tag:'LCL', origin:'Ralston-Finch East', destination:'Burlington - University of NCU', stopCount:8 },
      { serviceId:'S', isExpress:false, tag:'LCL', origin:'Burlington - University of NCU', destination:'Ralston-Finch East', stopCount:8 },
      { serviceId:'S', isExpress:true, tag:'EXP', origin:'Ralston-Finch East', destination:'Newkirk', stopCount:7, peak:'AM' },
      { serviceId:'S', isExpress:true, tag:'EXP', origin:'Newkirk', destination:'Ralston-Finch East', stopCount:7, peak:'PM' },
      { serviceId:'A', isExpress:false, tag:'LCL', origin:'Mount River', destination:'Newkirk', stopCount:10, hasRadcliff:true },
      { serviceId:'A', isExpress:false, tag:'LCL', origin:'Newkirk', destination:'Mount River', stopCount:10, hasRadcliff:true },
      { serviceId:'A', isExpress:true, tag:'EXP', origin:'Mount River', destination:'Port Williamson', stopCount:9 },
      { serviceId:'A', isExpress:true, tag:'EXP', origin:'Port Williamson', destination:'Mount River', stopCount:8 },
      { serviceId:'D', isExpress:false, tag:'LCL', origin:'Oakville City Airport', destination:'Veridia Nexus', stopCount:2 },
      { serviceId:'D', isExpress:false, tag:'LCL', origin:'Veridia Nexus', destination:'Oakville City Airport', stopCount:2 },
      { serviceId:'C', isExpress:false, tag:'LCL', origin:'East Heights', destination:'Oakville City Airport', stopCount:8 },
      { serviceId:'C', isExpress:false, tag:'LCL', origin:'East Heights', destination:'Fernwood', stopCount:15 },
      { serviceId:'C', isExpress:false, tag:'LCL', origin:'Oakville City Airport', destination:'East Heights', stopCount:8 },
      { serviceId:'C', isExpress:false, tag:'LCL', origin:'Fernwood', destination:'East Heights', stopCount:15 },
      { serviceId:'E', isExpress:false, tag:'LCL', origin:'Santa Mora', destination:'East Heights', stopCount:12 },
      { serviceId:'E', isExpress:false, tag:'LCL', origin:'East Heights', destination:'Santa Mora', stopCount:10 },
      { serviceId:'B', isExpress:false, tag:'LCL', origin:'Leighton Castle', destination:'Harrington City', stopCount:15 },
      { serviceId:'B', isExpress:false, tag:'LCL', origin:'Harrington City', destination:'Leighton Castle', stopCount:15 },
      { serviceId:'B', isExpress:true, tag:'EXP', origin:'Leighton Castle', destination:'Hadleigh', stopCount:9 },
      { serviceId:'B', isExpress:true, tag:'EXP', origin:'Hadleigh', destination:'Leighton Castle', stopCount:9 }
    ];

    function minutesNowLocal(){
      const d = new Date();
      return d.getHours()*60 + d.getMinutes();
    }

    function getScheduleState(){
      const m = minutesNowLocal();
      const late = (m >= SCHEDULE.lateNightStart) || (m < SCHEDULE.lateNightEnd);
      const morningRush = (m >= SCHEDULE.morningRushStart) && (m < SCHEDULE.morningRushEnd);
      const eveningRush = (m >= SCHEDULE.eveningRushStart) && (m < SCHEDULE.eveningRushEnd);
      const rush = morningRush || eveningRush;
      return { m, late, rush };
    }

    function scheduleKey(){
      const s = getScheduleState();
      return s.late ? 'late' : (s.rush ? 'rush' : 'noexpress');
    }

    function seededRandom(seed) {
      let h = 2166136261 >>> 0;
      const s = String(seed);
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return function() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return ((h ^= h >>> 16) >>> 0) / 4294967296;
      };
    }

    const toMin = t => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    function statusTimeModeForMinutes(nowMin) {
      const normalized = ((nowMin % 1440) + 1440) % 1440;
      const rushAM = (normalized >= toMin('06:00') && normalized < toMin('09:30'));
      const rushPM = (normalized >= toMin('17:00') && normalized < toMin('19:30'));
      const overnight = (normalized >= toMin('22:30') || normalized < toMin('03:59'));
      if (overnight) return 'overnight';
      if (rushAM) return 'rushAM';
      if (rushPM) return 'rushPM';
      return 'local';
    }

    function statusServiceAllowed(route, mode) {
      if (route.serviceId === 'S' && route.isExpress) {
        if (mode === 'rushAM' && route.peak === 'AM') return true;
        if (mode === 'rushPM' && route.peak === 'PM') return true;
        return false;
      }

      const isRush = mode === 'rushAM' || mode === 'rushPM';
      if (!isRush && route.isExpress) return false;

      if (mode === 'overnight') {
        if (route.serviceId === 'G' || route.serviceId === 'S' || route.serviceId === 'D') return false;
        if (route.serviceId === 'F' && route.isExpress) return false;
      }
      return true;
    }

    function statusEffectiveStopCount(route, mode) {
      const shouldSkipRadcliff = route.hasRadcliff && !(mode === 'rushAM' || mode === 'rushPM');
      return shouldSkipRadcliff ? route.stopCount - 1 : route.stopCount;
    }

    function statusExpandDepartures(periods) {
      const out = [];
      periods.forEach(period => {
        let cur = toMin(period.start);
        const end = toMin(period.end);
        while (cur <= end) {
          out.push(cur);
          cur += period.every;
        }
      });
      return out;
    }

    function statusRouteDepartureMinutes(route) {
      const dep = statusExpandDepartures(STATUS_LINE_SERVICE[route.serviceId] || []);
      const branchSeed = `${route.serviceId}-${route.tag}-${route.origin}-${route.destination}`;
      const rng = seededRandom(branchSeed);
      const baseOffset = Math.floor(rng() * 3);

      return dep.map(t0 => {
        let slotted = t0 + baseOffset;
        if (route.serviceId === 'F' && !route.isExpress && route.origin === 'Boylston') slotted += 3;
        else if (route.serviceId === 'C' && (route.destination === 'Oakville City Airport' || route.origin === 'Oakville City Airport')) slotted += 4;
        else if (route.serviceId === 'A' && route.isExpress) slotted += 3;
        else if (route.serviceId === 'B' && route.isExpress) slotted += 2;
        else if (route.serviceId === 'S' && route.isExpress) slotted += 3;
        return slotted;
      });
    }

    function statusTrainDelayInfo(trainSeed, mode) {
      const rng = seededRandom(trainSeed + '-delay');
      const roll = rng();
      const isRushHour = mode === 'rushAM' || mode === 'rushPM';
      const delayRate = STATUS_BASE_DELAY_RATE * (isRushHour ? STATUS_RUSH_DELAY_MULTIPLIER : 1);
      const oneMinuteDelayThreshold = 1 - (STATUS_BASE_DELAY_RATE * 0.20);

      if (roll < 1 - delayRate) {
        return { isDelayed: false, delaySeconds: 0, delayStartStop: -1 };
      }
      if (roll < oneMinuteDelayThreshold) {
        return { isDelayed: true, delaySeconds: 60, delayStartStop: Math.floor(rng() * 2) + 2 };
      }
      return {
        isDelayed: true,
        delaySeconds: (Math.floor(rng() * 2) + 2) * 60,
        delayStartStop: Math.floor(rng() * 2) + 2
      };
    }

    function computeStatusDelaySignals(now = new Date()) {
      const nowMin = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() / 60);
      const mode = statusTimeModeForMinutes(nowMin);
      const windowStart = nowMin - STATUS_DELAY_LOOKBACK_MIN;
      const windowEnd = nowMin + STATUS_DELAY_LOOKAHEAD_MIN;
      const byLetter = {};

      for (const route of STATUS_DELAY_ROUTES) {
        if (!statusServiceAllowed(route, mode)) continue;
        const stopCount = statusEffectiveStopCount(route, mode);
        const routeDurationMin = Math.max(4, (stopCount - 1) * 1.5 + stopCount * 0.35);

        for (const baseDeparture of statusRouteDepartureMinutes(route)) {
          for (const departureMin of [baseDeparture - 1440, baseDeparture, baseDeparture + 1440]) {
            if (departureMin > windowEnd) continue;
            if (departureMin + routeDurationMin < windowStart) continue;

            const trainSeed = `${route.serviceId}-${route.tag}-${baseDeparture}-${route.origin}-${route.destination}`;
            const delayInfo = statusTrainDelayInfo(trainSeed, mode);
            const bucket = byLetter[route.serviceId] || { total: 0, delayed: 0, maxDelaySeconds: 0 };
            bucket.total += 1;

            const delayCanAffectStops = delayInfo.isDelayed && delayInfo.delayStartStop < stopCount;
            const delayStartsMin = departureMin + Math.max(0, delayInfo.delayStartStop) * 1.5;
            if (delayCanAffectStops && delayStartsMin <= windowEnd) {
              bucket.delayed += 1;
              bucket.maxDelaySeconds = Math.max(bucket.maxDelaySeconds, delayInfo.delaySeconds);
            }
            byLetter[route.serviceId] = bucket;
          }
        }
      }

      return Object.fromEntries(Object.entries(byLetter).flatMap(([letter, bucket]) => {
        const ratio = bucket.total ? bucket.delayed / bucket.total : 0;
        const significant = bucket.delayed >= STATUS_DELAY_THRESHOLD_MIN_TRAINS ||
          (bucket.total >= 4 && ratio >= STATUS_DELAY_THRESHOLD_RATIO);
        if (!significant) return [];

        const type = (ratio >= 0.5 || bucket.delayed >= 5 || bucket.maxDelaySeconds >= 180) ? 'major' : 'minor';
        const delayedWord = bucket.delayed === 1 ? 'train' : 'trains';
        return [[letter, {
          type,
          delayed: bucket.delayed,
          total: bucket.total,
          maxDelaySeconds: bucket.maxDelaySeconds,
          reason: `Timetable is showing ${bucket.delayed} delayed ${delayedWord} on the ${letter} line within the active service window. Longest delay: ${Math.max(1, Math.round(bucket.maxDelaySeconds / 60))} min.`
        }]];
      }));
    }

    function scheduledOverride(service){
      const s = getScheduleState();

      // Late night shutdown (10:30 PM–6:30 AM): S (local+express), G, D
      if (s.late && LATE_NIGHT_OFF.has(service.id)) {
        return {
          cls: 'nosvc',
          label: 'NO SERVICE',
          reason: 'Service does not operate 10:30 PM–6:30 AM (your local time).',
          always: true
        };
      }

      // Express only during rush windows
      if (service.mode === 'express' && !s.rush) {
        return {
          cls: 'nosvc',
          label: 'NO SERVICE',
          reason: 'Express service operates only 6:30 AM–9:30 AM and 5:00 PM–7:30 PM (your local time).',
          always: false
        };
      }

      return null;
    }

    function pickStatus(p){
      // returns one of: 'ok' | 'minor' | 'major' | 'none'
      const r = Math.random()*100;
      if (r < p.ok) return 'ok';
      if (r < p.ok + p.minor) return 'minor';
      if (r < p.ok + p.minor + p.major) return 'major';
      return 'none';
    }

    function renderStatus(state, delaySignals = computeStatusDelaySignals()){
      const host = document.getElementById('statusList');
      host.innerHTML = state.statuses.map((stObj) => {
        const delaySignal = delaySignals[stObj.letter];
        const displayObj = delaySignal ? { ...stObj, type: delaySignal.type, delaySignal } : stObj;
        const svcName = stObj.nameHtml;
        const st = displayObj.type; // 'ok' | 'minor' | 'major' | 'none'

        const icon = `<img class="lnicon" src="${stObj.icon}" alt="${stObj.letter} ${stObj.mode}" loading="lazy" onerror="this.style.display='none'">`;
        const left = `<div class="name">${svcName}</div>`;

        const forced = scheduledOverride(stObj);
        if (forced && (forced.always || st === 'ok')){
          // schedule-based "NO SERVICE" row (clickable for explanation)
          return `
            <details class="srow" data-service-id="${stObj.id}" data-status-type="${st}">
              <summary>
                ${icon}
                ${left}
                <span class="pill ${forced.cls}">${forced.label}<span class="arrow">▸</span></span>
              </summary>
              <div class="reason">${forced.reason}</div>
            </details>`;
        }

        if (st === 'ok'){
          // plain row (not clickable)
          return `
            <div class="row" data-service-id="${stObj.id}" data-status-type="${st}">
              ${icon}
              ${left}
              <span class="pill ok">No Disruptions</span>
            </div>`;
        } else {
          // details row (clickable)
          const cls = st==='minor' ? 'warn' : (st==='major' ? 'bad' : 'nosvc');
          const label =
            st==='minor' ? 'Minor Disruptions' :
            st==='major' ? 'Major Disruptions' : 'NO SERVICE';

          // fixed reason pulled from the stored reasonIndex
          const pool =
            st==='minor' ? REASONS.minor :
            st==='major' ? REASONS.major : REASONS.none;
          const reasonText = displayObj.delaySignal?.reason || pool[displayObj.reasonIndex] || pool[0];

          return `
            <details class="srow" data-service-id="${stObj.id}" data-status-type="${st}">
              <summary>
                ${icon}
                ${left}
                <span class="pill ${cls}">${label}<span class="arrow">▸</span></span>
              </summary>
              <div class="reason">${reasonText}</div>
            </details>`;
        }
      }).join('');
    }

    // --- 12-hour persistence (per device) ---
    const WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours
    const STORAGE_KEY = 'borail_status_window_v3';

    // Load previously saved state, or null
    function loadStatusState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    }

    function saveStatusState(state) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
      catch { /* ignore */ }
    }

    function createNewStatusState() {
      // One disruption status per letter, shared across local/express variants.
      const byLetter = {};
      for (const ln of BASE_LINES) {
        const type = pickStatus(ln.probs); // 'ok' | 'minor' | 'major' | 'none'
        let reasonIndex = -1;
        if (type !== 'ok') {
          const pool =
            type === 'minor' ? REASONS.minor :
            type === 'major' ? REASONS.major : REASONS.none;
          reasonIndex = Math.floor(Math.random() * pool.length);
        }
        byLetter[ln.letter] = { type, reasonIndex };
      }

      return {
        start: Date.now(),
        statuses: SERVICES.map(svc => {
          const shared = byLetter[svc.letter] || { type: 'ok', reasonIndex: -1 };
          return {
            id: svc.id,
            nameHtml: svc.nameHtml,
            icon: svc.icon,
            letter: svc.letter,
            mode: svc.mode,
            color: svc.color,
            type: shared.type,
            reasonIndex: shared.reasonIndex
          };
        })
      };
    }

    function normalizeStatusState(state) {
      const existing = Array.isArray(state?.statuses) ? state.statuses : [];
      const byLetter = {};

      for (const service of existing) {
        if (!service?.letter || byLetter[service.letter]) continue;
        byLetter[service.letter] = {
          type: service.type || 'ok',
          reasonIndex: Number.isInteger(service.reasonIndex) ? service.reasonIndex : -1
        };
      }

      return {
        start: Number(state?.start) || Date.now(),
        statuses: SERVICES.map(service => {
          const shared = byLetter[service.letter] || { type: 'ok', reasonIndex: -1 };
          return {
            id: service.id,
            nameHtml: service.nameHtml,
            icon: service.icon,
            letter: service.letter,
            mode: service.mode,
            color: service.color,
            type: shared.type,
            reasonIndex: shared.reasonIndex
          };
        })
      };
    }

    // Get state: reuse if under 12h, otherwise create/replace
    function getOrCreateStatusState() {
      const cur = loadStatusState();
      if (!cur) {
        const fresh = createNewStatusState();
        saveStatusState(fresh);
        return fresh;
      }
      const age = Date.now() - cur.start;
      if (age >= WINDOW_MS) {
        const fresh = createNewStatusState();
        saveStatusState(fresh);
        return fresh;
      }
      const normalized = normalizeStatusState(cur);
      saveStatusState(normalized);
      return normalized;
    }

    const STATUS_STATE = getOrCreateStatusState();
    renderStatus(STATUS_STATE);

    window.BORailStatusDebug = {
      services: SERVICES,
      statusState: STATUS_STATE,
      normalizeStatusState,
      computeStatusDelaySignals,
      renderStatus
    };

    // Re-render when we cross into a different service window (based on viewer's local time).
    let _lastKey = scheduleKey();
    setInterval(() => {
      const k = scheduleKey();
      if (k !== _lastKey){
        _lastKey = k;
        renderStatus(STATUS_STATE);
      }
    }, 30 * 1000);
