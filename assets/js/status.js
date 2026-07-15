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
    const STATUS_DELAY_MINOR_MIN_TRAINS = 6;
    const STATUS_DELAY_MAJOR_MIN_TRAINS = 12;
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

    const ELEVATOR_STORAGE_KEY = 'borail_elevator_status_v2_daily';
    const ELEVATOR_RECENT_REPAIRED_MS = 24 * 60 * 60 * 1000;
    const ELEVATOR_MIN_REPAIR_START_MS = 12 * 60 * 60 * 1000;
    const ELEVATOR_REPAIR_START_WINDOW_MS = 12 * 60 * 60 * 1000;
    const ELEVATOR_MIN_REPAIR_DURATION_MS = 2 * 60 * 60 * 1000;
    const ELEVATOR_REPAIR_DURATION_WINDOW_MS = 6 * 60 * 60 * 1000;

    const ELEVATOR_STATIONS = [
      { station:'Newkirk', elevators:['Exit','SB','SB','SB'] },
      { station:'Newkirk - Oak Street', elevators:['NB','SB'] },
      { station:'Chelsea Bay', elevators:['Exit','NB'] },
      { station:'Berwick Hall', elevators:['Exit','NB/WB'] },
      { station:'Cambridge Central', elevators:['NB','SB'] },
      { station:'Atkinson Junction', elevators:['Exit','NB','SB'] },
      { station:'Kenilworth', elevators:['Exit'] },
      { station:'La Vista', elevators:['NB','SB'] },
      { station:'Burlington - University of NCU', elevators:['Exit','NB','SB'] },
      { station:'Willow Springs', elevators:['Exit','NB','SB'] },
      { station:'Cannon View', elevators:['Exit','NB','SB'] },
      { station:'Ivory Knolls', elevators:['NB','SB'] },
      { station:'Vanderburg', elevators:['NB','SB'] },
      { station:'Ralston-Finch East', elevators:['Exit'] },
      { station:'Atkins Bridge', elevators:['NB','SB'] },
      { station:'Veridia Nexus', elevators:['Exit'] },
      { station:'Oakville City Airport', elevators:['Exit','NB','SB','WB'] },
      { station:'Oakville Exchange', elevators:['NB','SB','EB'] },
      { station:'Oakville City Center', elevators:['NB','EB'] },
      { station:'Oakville Plaza', elevators:['NB','SB','EB'] },
      { station:'Leighton Castle', elevators:['Exit','NB','EB'] },
      { station:'Yoakum', elevators:['NB','EB'] },
      { station:'Talmedge Hill', elevators:['Exit','NB'] },
      { station:'New Salemview', elevators:['NB','EB'] },
      { station:'Roxbury Landing', elevators:['Exit','SB/NB/WB'] },
      { station:'Scottsbury', elevators:['NB','SB'] },
      { station:'Ameryville', elevators:['NB','SB'] },
      { station:'Scottsdale', elevators:['NB','SB'] },
      { station:'Brandywine', elevators:['NB','SB','Exit'] },
      { station:'Santa Mora', elevators:['Exit'] },
      { station:'Groveton', elevators:['Exit','NB/EB'] },
      { station:'Madisonboro', elevators:['Exit','NB','EB'] },
      { station:'South Harrington', elevators:['NB','EB'] },
      { station:'Harrington City', elevators:['NB','EB'] },
      { station:'Carrollton', elevators:['Exit'] },
      { station:'Hadleigh', elevators:['Exit'] }
    ];

    const STATUS_STATION_SERVICES = {
      'Newkirk': [{ s:'F', e:true }, { s:'F' }, { s:'A' }, { s:'S', e:true }],
      'Newkirk - Oak Street': [{ s:'F', e:true }, { s:'F' }, { s:'S', e:true }],
      'Chelsea Bay': [{ s:'F' }],
      'Berwick Hall': [{ s:'F', e:true }, { s:'F' }, { s:'G' }],
      'Cambridge Central': [{ s:'F' }],
      'Atkinson Junction': [{ s:'F', e:true }, { s:'F' }],
      'Kenilworth': [{ s:'F' }],
      'La Vista': [{ s:'F', e:true }, { s:'F' }],
      'Burlington - University of NCU': [{ s:'A' }, { s:'S', e:true }, { s:'S' }],
      'Willow Springs': [{ s:'A', e:true }, { s:'S', e:true }, { s:'S' }],
      'Cannon View': [{ s:'A', e:true }, { s:'A' }, { s:'S', e:true }, { s:'S' }],
      'Ivory Knolls': [{ s:'S' }],
      'Vanderburg': [{ s:'S' }],
      'Ralston-Finch East': [{ s:'S', e:true }, { s:'S' }],
      'Atkins Bridge': [{ s:'A', e:true }, { s:'A' }],
      'Veridia Nexus': [{ s:'D' }],
      'Oakville City Airport': [{ s:'A', e:true }, { s:'A' }, { s:'C' }, { s:'D' }],
      'Oakville Exchange': [{ s:'A', e:true }, { s:'A' }, { s:'B', e:true }, { s:'B' }, { s:'C' }],
      'Oakville City Center': [{ s:'B', e:true }, { s:'B' }, { s:'C' }],
      'Oakville Plaza': [{ s:'A', e:true }, { s:'A' }, { s:'B', e:true }, { s:'B' }, { s:'C' }],
      'Leighton Castle': [{ s:'B', e:true }, { s:'B' }, { s:'C' }],
      'Yoakum': [{ s:'C' }],
      'Talmedge Hill': [{ s:'A', e:true }, { s:'A' }],
      'New Salemview': [{ s:'C' }],
      'Roxbury Landing': [{ s:'C' }, { s:'E' }],
      'Scottsbury': [{ s:'E' }],
      'Ameryville': [{ s:'E' }],
      'Scottsdale': [{ s:'E' }],
      'Brandywine': [{ s:'E' }],
      'Santa Mora': [{ s:'E' }],
      'Groveton': [{ s:'B' }],
      'Madisonboro': [{ s:'B', e:true }, { s:'B' }],
      'South Harrington': [{ s:'B' }],
      'Harrington City': [{ s:'B', e:true }, { s:'B' }],
      'Carrollton': [{ s:'B', e:true }],
      'Hadleigh': [{ s:'B', e:true }]
    };

    const LINE_ICON_PATHS = {
      A: { local:'assets/images/line-icons/a-local.png', express:'assets/images/line-icons/a-express.png' },
      B: { local:'assets/images/line-icons/b-local.png', express:'assets/images/line-icons/b-express.png' },
      C: { local:'assets/images/line-icons/c-local.png' },
      D: { local:'assets/images/line-icons/d-local.png' },
      E: { local:'assets/images/line-icons/e-local.png' },
      F: { local:'assets/images/line-icons/f-local.png', express:'assets/images/line-icons/f-express.png' },
      G: { local:'assets/images/line-icons/g-local.png' },
      S: { local:'assets/images/line-icons/s-local.png', express:'assets/images/line-icons/s-express.png' }
    };

    const ELEVATOR_UNITS = ELEVATOR_STATIONS.flatMap(station =>
      station.elevators.map((direction, index) => ({
        id: `${station.station}-${direction}-${index}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
        station: station.station,
        direction,
        stationElevatorCount: station.elevators.length
      }))
    );

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
      const windowStart = nowMin;
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

      return Object.fromEntries(BASE_LINES.map(({ letter }) => {
        const bucket = byLetter[letter] || { total: 0, delayed: 0, maxDelaySeconds: 0 };
        const type = bucket.delayed >= STATUS_DELAY_MAJOR_MIN_TRAINS
          ? 'major'
          : (bucket.delayed >= STATUS_DELAY_MINOR_MIN_TRAINS ? 'minor' : 'ok');
        const delayedWord = bucket.delayed === 1 ? 'train' : 'trains';
        return [letter, {
          type,
          delayed: bucket.delayed,
          total: bucket.total,
          maxDelaySeconds: bucket.maxDelaySeconds,
          reason: `Timetable is showing ${bucket.delayed} delayed ${delayedWord} on the ${letter} line in the next 2 hours. Longest delay: ${Math.max(0, Math.round(bucket.maxDelaySeconds / 60))} min.`
        }];
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

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[char]);
    }

    function elevatorIcon(type) {
      if (type === 'hazard') {
        return `<svg class="status-symbol hazard-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2L12 3Z" fill="#ffcc00"/><path d="M12 8v6" stroke="#111" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="17" r="1.4" fill="#111"/></svg>`;
      }
      if (type === 'elevator') {
        return `<svg class="status-symbol elevator-symbol" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v10M9 10l3-3 3 3M9 14l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      }
      if (type === 'progress') {
        return `<svg class="status-symbol repair-symbol progress" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#ff9500"/><path d="M12 7v6" stroke="#211300" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="16.8" r="1.3" fill="#211300"/></svg>`;
      }
      if (type === 'repaired') {
        return `<svg class="status-symbol repair-symbol repaired" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#34c759"/><path d="m7.8 12.2 2.7 2.7 5.8-6" fill="none" stroke="#07130b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      }
      return `<svg class="status-symbol repair-symbol awaiting" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#ff3b30"/><path d="m8.5 8.5 7 7m0-7-7 7" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>`;
    }

    function directionLabel(direction) {
      const labels = {
        Exit: 'Exit',
        NB: 'Northbound',
        SB: 'Southbound',
        EB: 'Eastbound',
        WB: 'Westbound'
      };
      const parts = String(direction).split('/').map(part => labels[part] || part);
      return `${parts.join(' / ')} Elevator`;
    }

    function lineBadgePath(service, express) {
      const item = LINE_ICON_PATHS[service];
      if (!item) return '';
      return express ? item.express : item.local;
    }

    function renderStationBadges(station) {
      const badges = STATUS_STATION_SERVICES[station] || [];
      if (!badges.length) return '';
      return `<span class="station-badges">${badges.map(badge => {
        const src = lineBadgePath(badge.s, Boolean(badge.e));
        if (!src) return '';
        const alt = badge.e ? `<${badge.s}>` : `(${badge.s})`;
        return `<img src="${src}" alt="${escapeHtml(alt)}" loading="lazy">`;
      }).join('')}</span>`;
    }

    function formatElevatorTime(timestamp) {
      return new Intl.DateTimeFormat(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(timestamp));
    }

    function loadElevatorState() {
      try {
        const raw = localStorage.getItem(ELEVATOR_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    }

    function saveElevatorState(state) {
      try { localStorage.setItem(ELEVATOR_STORAGE_KEY, JSON.stringify(state)); }
      catch { /* ignore */ }
    }

    function elevatorDayParts(nowMs = Date.now()) {
      const date = new Date(nowMs);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return {
        dayKey: `${year}-${month}-${day}`,
        dayStart: new Date(year, date.getMonth(), date.getDate()).getTime()
      };
    }

    function elevatorStatusFor(outage, nowMs = Date.now()) {
      if (nowMs >= outage.repairedAt) return 'repaired';
      if (nowMs >= outage.repairStartAt) return 'progress';
      return 'awaiting';
    }

    function repairStatusMeta(status) {
      if (status === 'repaired') {
        return { label: 'Repaired', cls: 'repaired', icon: elevatorIcon('repaired') };
      }
      if (status === 'progress') {
        return { label: 'Repairs in Progress', cls: 'progress', icon: elevatorIcon('progress') };
      }
      return { label: 'Awaiting Repair', cls: 'awaiting', icon: elevatorIcon('awaiting') };
    }

    function createElevatorOutage(unit, nowMs, rng) {
      const reportedAt = nowMs - (20 * 60 * 1000) - Math.floor(rng() * 6 * 60 * 60 * 1000);
      const repairStartAt = reportedAt + ELEVATOR_MIN_REPAIR_START_MS + Math.floor(rng() * ELEVATOR_REPAIR_START_WINDOW_MS);
      const repairedAt = repairStartAt + ELEVATOR_MIN_REPAIR_DURATION_MS + Math.floor(rng() * ELEVATOR_REPAIR_DURATION_WINDOW_MS);
      return {
        id: `outage-${unit.id}-${Math.floor(reportedAt)}`,
        elevatorId: unit.id,
        station: unit.station,
        direction: unit.direction,
        reportedAt,
        repairStartAt,
        repairedAt
      };
    }

    function shuffleElevatorUnits(seed) {
      const rng = seededRandom(seed);
      const units = [...ELEVATOR_UNITS];
      for (let i = units.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const temp = units[i];
        units[i] = units[j];
        units[j] = temp;
      }
      return units;
    }

    function createDailyElevatorOutage(unit, dayKey, dayStart, index) {
      const rng = seededRandom(`elevator-daily-active-${dayKey}-${unit.id}-${index}`);
      const reportedAt = dayStart - (4 * 60 * 60 * 1000) - Math.floor(rng() * 14 * 60 * 60 * 1000);
      const repairStartAt = reportedAt + ELEVATOR_MIN_REPAIR_START_MS + Math.floor(rng() * ELEVATOR_REPAIR_START_WINDOW_MS);
      const repairedAt = dayStart + (26 * 60 * 60 * 1000) + Math.floor(rng() * 8 * 60 * 60 * 1000);

      return {
        id: `daily-${dayKey}-${unit.id}`,
        elevatorId: unit.id,
        station: unit.station,
        direction: unit.direction,
        reportedAt,
        repairStartAt: Math.min(repairStartAt, repairedAt - ELEVATOR_MIN_REPAIR_DURATION_MS),
        repairedAt
      };
    }

    function createDailyRecentlyRepairedOutage(unit, dayKey, dayStart, index) {
      const rng = seededRandom(`elevator-daily-repaired-${dayKey}-${unit.id}-${index}`);
      const repairedAt = dayStart - (60 * 60 * 1000) - Math.floor(rng() * 10 * 60 * 60 * 1000);
      const repairStartAt = repairedAt - ELEVATOR_MIN_REPAIR_DURATION_MS - Math.floor(rng() * ELEVATOR_REPAIR_DURATION_WINDOW_MS);
      const reportedAt = repairStartAt - ELEVATOR_MIN_REPAIR_START_MS - Math.floor(rng() * ELEVATOR_REPAIR_START_WINDOW_MS);

      return {
        id: `daily-repaired-${dayKey}-${unit.id}`,
        elevatorId: unit.id,
        station: unit.station,
        direction: unit.direction,
        reportedAt,
        repairStartAt,
        repairedAt
      };
    }

    function buildDailyElevatorState(nowMs = Date.now()) {
      const { dayKey, dayStart } = elevatorDayParts(nowMs);
      const targetActive = 2 + Math.floor(seededRandom(`elevator-target-${dayKey}`)() * 3);
      const units = shuffleElevatorUnits(`elevator-units-${dayKey}`);
      const activeOutages = units
        .slice(0, targetActive)
        .map((unit, index) => createDailyElevatorOutage(unit, dayKey, dayStart, index));

      const recentlyRepairedCount = Math.floor(seededRandom(`elevator-repaired-count-${dayKey}`)() * 3);
      const repairedOutages = units
        .slice(targetActive, targetActive + recentlyRepairedCount)
        .map((unit, index) => createDailyRecentlyRepairedOutage(unit, dayKey, dayStart, index));

      return {
        createdAt: dayStart,
        dayKey,
        targetActive,
        deterministic: true,
        outages: [...activeOutages, ...repairedOutages]
      };
    }

    function isDailyElevatorState(state, nowMs = Date.now()) {
      return Boolean(state?.deterministic && state.dayKey === elevatorDayParts(nowMs).dayKey);
    }

    function normalizeElevatorState(state, nowMs = Date.now()) {
      const { dayKey } = elevatorDayParts(nowMs);
      const existing = Array.isArray(state?.outages) ? state.outages : [];
      const targetActive = Math.min(4, Math.max(2, Number(state?.targetActive) || 0)) ||
        (2 + Math.floor(seededRandom(`elevator-target-${state?.dayKey || dayKey}`)() * 3));

      return {
        createdAt: Number(state?.createdAt) || nowMs,
        dayKey: String(state?.dayKey || dayKey),
        deterministic: Boolean(state?.deterministic),
        targetActive,
        outages: existing
          .filter(outage => outage && outage.elevatorId && outage.station && outage.direction)
          .map(outage => ({
            id: String(outage.id || `outage-${outage.elevatorId}-${outage.reportedAt}`),
            elevatorId: String(outage.elevatorId),
            station: String(outage.station),
            direction: String(outage.direction),
            reportedAt: Number(outage.reportedAt) || nowMs,
            repairStartAt: Number(outage.repairStartAt) || (nowMs + ELEVATOR_MIN_REPAIR_START_MS),
            repairedAt: Number(outage.repairedAt) || (nowMs + ELEVATOR_MIN_REPAIR_START_MS + ELEVATOR_MIN_REPAIR_DURATION_MS)
          }))
          .filter(outage => {
            const status = elevatorStatusFor(outage, nowMs);
            return status !== 'repaired' || nowMs - outage.repairedAt <= ELEVATOR_RECENT_REPAIRED_MS;
          })
      };
    }

    function ensureElevatorOutageCount(state, nowMs = Date.now()) {
      const active = state.outages.filter(outage => elevatorStatusFor(outage, nowMs) !== 'repaired');
      const needed = Math.max(0, state.targetActive - active.length);
      if (!needed) return state;

      const used = new Set(state.outages.map(outage => outage.elevatorId));
      const candidates = ELEVATOR_UNITS.filter(unit => !used.has(unit.id));
      const rng = seededRandom(`elevator-outage-${state.dayKey || elevatorDayParts(nowMs).dayKey}-${state.createdAt}-${state.outages.length}`);

      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const temp = candidates[i];
        candidates[i] = candidates[j];
        candidates[j] = temp;
      }

      candidates.slice(0, needed).forEach(unit => {
        state.outages.push(createElevatorOutage(unit, nowMs, rng));
      });
      return state;
    }

    function getOrCreateElevatorState(nowMs = Date.now()) {
      const normalized = normalizeElevatorState(buildDailyElevatorState(nowMs), nowMs);
      saveElevatorState(normalized);
      return normalized;
    }

    function groupElevatorOutages(outages) {
      const groups = new Map();
      outages.forEach(outage => {
        if (!groups.has(outage.station)) groups.set(outage.station, []);
        groups.get(outage.station).push(outage);
      });
      return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }

    function renderElevatorDetail(outage, nowMs) {
      const status = elevatorStatusFor(outage, nowMs);
      const meta = repairStatusMeta(status);
      return `<div class="elevator-detail-row">
        <div class="elevator-detail-icon">${elevatorIcon('elevator')}</div>
        <div class="elevator-detail-copy">
          <strong>${escapeHtml(directionLabel(outage.direction))}</strong>
          <span class="repair-state ${meta.cls}">${meta.icon}<span>${meta.label}</span></span>
          <span>Reported at: ${escapeHtml(formatElevatorTime(outage.reportedAt))}</span>
          ${status === 'repaired' ? `<span>Repaired at: ${escapeHtml(formatElevatorTime(outage.repairedAt))}</span>` : ''}
        </div>
      </div>`;
    }

    function renderElevatorGroup(station, outages, nowMs, repaired = false) {
      const count = outages.length;
      const countLabel = count === 1 ? '1' : String(count);
      return `<details class="elevator-row ${repaired ? 'recently-repaired' : ''}">
        <summary>
          <div class="elevator-row-main">
            <div class="elevator-station-line">
              <strong>${escapeHtml(station)}</strong>
              ${renderStationBadges(station)}
            </div>
            <span class="elevator-hint">${repaired ? 'Click for repair details...' : 'Click for more info...'}</span>
          </div>
          <span class="elevator-row-pill ${repaired ? 'repaired' : 'hazard'}">
            ${repaired ? elevatorIcon('repaired') : elevatorIcon('hazard')}
            <span>${countLabel}</span>
          </span>
        </summary>
        <div class="elevator-detail-list">
          ${outages.map(outage => renderElevatorDetail(outage, nowMs)).join('')}
        </div>
      </details>`;
    }

    function renderElevatorStatus(state = getOrCreateElevatorState(), now = new Date()) {
      const host = document.getElementById('elevatorStatusList');
      const summary = document.getElementById('elevatorOutageSummary');
      if (!host || !summary) return;

      const nowMs = now.getTime();
      const sourceState = state?.deterministic && !isDailyElevatorState(state, nowMs)
        ? buildDailyElevatorState(nowMs)
        : state;
      const normalized = ensureElevatorOutageCount(normalizeElevatorState(sourceState, nowMs), nowMs);
      ELEVATOR_STATE = normalized;
      saveElevatorState(normalized);

      const active = normalized.outages.filter(outage => elevatorStatusFor(outage, nowMs) !== 'repaired');
      const repaired = normalized.outages.filter(outage => elevatorStatusFor(outage, nowMs) === 'repaired' && nowMs - outage.repairedAt <= ELEVATOR_RECENT_REPAIRED_MS);
      const activeCount = active.length;

      summary.innerHTML = `${activeCount ? elevatorIcon('hazard') : elevatorIcon('repaired')}<span>${activeCount}</span>`;

      const activeHtml = active.length
        ? groupElevatorOutages(active).map(([station, outages]) => renderElevatorGroup(station, outages, nowMs, false)).join('')
        : '<div class="elevator-empty">No active elevator outages.</div>';

      const repairedHtml = repaired.length
        ? `<div class="elevator-section-title">Recently Repaired Elevators</div>${groupElevatorOutages(repaired).map(([station, outages]) => renderElevatorGroup(station, outages, nowMs, true)).join('')}`
        : '';

      host.innerHTML = `<div class="elevator-section-title">Active Elevator Outages</div>${activeHtml}${repairedHtml}`;
      window.BORailElevatorDebug = {
        state: normalized,
        units: ELEVATOR_UNITS,
        buildDailyState: buildDailyElevatorState,
        getStatus: outage => elevatorStatusFor(outage, Date.now()),
        render: renderElevatorStatus
      };
      if (window.BORailStatusDebug) {
        window.BORailStatusDebug.elevatorState = normalized;
      }
    }

    const STATUS_STATE = getOrCreateStatusState();
    let ELEVATOR_STATE = getOrCreateElevatorState();
    renderStatus(STATUS_STATE);
    renderElevatorStatus(ELEVATOR_STATE);

    window.BORailStatusDebug = {
      services: SERVICES,
      statusState: STATUS_STATE,
      normalizeStatusState,
      computeStatusDelaySignals,
      renderStatus,
      elevatorState: ELEVATOR_STATE,
      buildDailyElevatorState,
      renderElevatorStatus
    };

    // Re-render when we cross into a different service window (based on viewer's local time).
    let _lastKey = scheduleKey();
    setInterval(() => {
      const k = scheduleKey();
      if (k !== _lastKey){
        _lastKey = k;
        renderStatus(STATUS_STATE);
      }
      renderElevatorStatus(ELEVATOR_STATE);
    }, 30 * 1000);
