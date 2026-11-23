const BORAIL_CLOCK = globalThis.BORailTime;
const BORAIL_SERVICE = globalThis.BORailService;
if (!BORAIL_CLOCK || !BORAIL_SERVICE) throw new Error('BORail time and service helpers must load before status.js');

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
    ];

    const STATUS_DELAY_MINOR_MIN_TRAINS = 3;
    const STATUS_DELAY_MAJOR_MIN_TRAINS = 4;
    const STATUS_SERVICE_LOOKAHEAD_MIN = 6 * 60;


    const STATUS_DELAY_ROUTES = [
      { serviceId:'F', isExpress:false, tag:'LCL', origin:'Kenilworth', destination:'Newkirk', stopCount:10 },
      { serviceId:'F', isExpress:false, tag:'LCL', origin:'Boylston', destination:'Newkirk', stopCount:11 },
      { serviceId:'F', isExpress:false, tag:'LCL', origin:'Newkirk', destination:'Kenilworth', stopCount:10 },
      { serviceId:'F', isExpress:false, tag:'LCL', origin:'Newkirk', destination:'Boylston', stopCount:11 },
      { serviceId:'F', isExpress:true, tag:'EXP', origin:'Whitebranch', destination:'Newkirk', stopCount:10 },
      { serviceId:'F', isExpress:true, tag:'EXP', origin:'Newkirk', destination:'Whitebranch', stopCount:10 },
      { serviceId:'G', isExpress:false, tag:'LCL', origin:'Bradford Bay', destination:'Berwick Hall', stopCount:4, segmentTimes:[1.5,1.5,2] },
      { serviceId:'G', isExpress:false, tag:'LCL', origin:'Berwick Hall', destination:'Bradford Bay', stopCount:4, segmentTimes:[1.5,1.5,1.5] },
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

    function scheduleKey(){
      const serviceContext = BORAIL_SERVICE.context();
      return `${serviceContext.dateKey}-${serviceContext.mode}`;
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

    function statusTimeModeForMinutes(nowMin) {
      return BORAIL_SERVICE.timeModeForMinutes(nowMin);
    }

    function statusServiceAllowed(route, mode) {
      if (mode === 'closed') return false;
      if (mode === 'winterEmergency') return !route.isExpress;
      if (route.serviceId === 'S' && route.isExpress) {
        if (mode === 'rushAM' && route.peak === 'AM') return true;
        if (mode === 'rushPM' && route.peak === 'PM') return true;
        return false;
      }

      const isRush = mode === 'rushAM' || mode === 'rushPM';
      if (!isRush && route.isExpress) return false;

      return true;
    }

    function statusEffectiveStopCount(route, mode) {
      const shouldSkipRadcliff = route.hasRadcliff && !(mode === 'rushAM' || mode === 'rushPM');
      return shouldSkipRadcliff ? route.stopCount - 1 : route.stopCount;
    }


    function statusRoutesForDate(date) {
      if (BORAIL_SERVICE.context(date).winterEmergency) {
        return BORAIL_SERVICE.WINTER_ROUTES.map(route => ({
          ...route,
          stopCount: route.stops.length,
          segmentTimes: route.segmentTimes ? [...route.segmentTimes] : null
        }));
      }
      return STATUS_DELAY_ROUTES.map(route => ({
        ...route,
        singleTrainShuttle: !route.isExpress && (route.serviceId === 'G' || route.serviceId === 'D'),
        shuttleKey: !route.isExpress && (route.serviceId === 'G' || route.serviceId === 'D') ? route.serviceId : null
      }));
    }


    function statusRouteDepartureMinutes(route, mode, date) {
      const dep = BORAIL_SERVICE.departureSlots(route.serviceId, mode === 'winterEmergency', date);
      const firstMinute = BORAIL_CLOCK.serviceDay(date).firstMinute;
      const branchSeed = `${route.serviceId}-${route.tag}-${route.origin}-${route.destination}`;
      const rng = seededRandom(branchSeed);
      const baseOffset = Math.floor(rng() * 3);
      return dep.map(t0 => {
        let slotted = t0 + baseOffset;
        if (mode !== 'winterEmergency') {
          if (route.serviceId === 'F' && !route.isExpress && route.origin === 'Boylston') slotted += 3;
          else if (route.serviceId === 'C' && (route.destination === 'Oakville City Airport' || route.origin === 'Oakville City Airport')) slotted += 4;
          else if (route.serviceId === 'A' && route.isExpress) slotted += 3;
          else if (route.serviceId === 'B' && route.isExpress) slotted += 2;
          else if (route.serviceId === 'S' && route.isExpress) slotted += 3;
        }
        return slotted;
      }).filter(minute => minute >= firstMinute && minute < 1440);
    }

    function statusRouteDurationMin(route, mode) {
      const stopCount = statusEffectiveStopCount(route, mode);
      const travel = route.segmentTimes?.length
        ? route.segmentTimes.reduce((sum, value) => sum + value, 0)
        : Math.max(0, stopCount - 1) * 1.5;
      const dwell = route.intermediateDwellMinutes
        ? Math.max(0, stopCount - 2) * route.intermediateDwellMinutes
        : Math.max(0, stopCount - 1) * 0.3;
      return Math.max(1.5, travel + dwell);
    }

    function statusShuttleTravelMin(route, mode) {
      const stopCount = statusEffectiveStopCount(route, mode);
      const travel = route.segmentTimes?.length
        ? route.segmentTimes.reduce((sum, value) => sum + value, 0)
        : Math.max(0, stopCount - 1) * 1.5;
      const intermediateDwell = route.intermediateDwellMinutes
        ? Math.max(0, stopCount - 2) * route.intermediateDwellMinutes
        : 0;
      return Math.max(1.5, travel + intermediateDwell);
    }

    function statusShuttleDescriptors(routes, date, mode) {
      const descriptors = [];
      const groups = new Map();
      routes.filter(route => route.singleTrainShuttle).forEach(route => {
        const key = route.shuttleKey || route.serviceId;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(route);
      });
      groups.forEach((group, shuttleKey) => {
        descriptors.push(...BORAIL_SERVICE.singleShuttleRuns(group, shuttleKey, date));
      });
      return descriptors;
    }

    function statusRunDescriptors(now) {
      const serviceContext = BORAIL_SERVICE.context(now);
      const dayMode = serviceContext.winterEmergency ? 'winterEmergency' : 'local';
      const routes = statusRoutesForDate(now);
      const descriptors = statusShuttleDescriptors(routes, now, dayMode);
      routes.filter(route => !route.singleTrainShuttle).forEach(route => {
        statusRouteDepartureMinutes(route, dayMode, now).forEach(departureMin => {
          const mode = serviceContext.winterEmergency ? 'winterEmergency' : statusTimeModeForMinutes(departureMin);
          if (!statusServiceAllowed(route, mode)) return;
          descriptors.push({ route, departureMin, durationMin: statusRouteDurationMin(route, mode), mode });
        });
      });
      return descriptors.map(descriptor => {
        const runMode = serviceContext.winterEmergency
          ? 'winterEmergency'
          : statusTimeModeForMinutes(descriptor.departureMin);
        descriptor.mode = runMode;
        const stopCount = statusEffectiveStopCount(descriptor.route, descriptor.mode);
        const trainSeed = `${descriptor.route.serviceId}-${descriptor.route.tag}-${descriptor.departureMin}-${descriptor.route.origin}-${descriptor.route.destination}`;
        const customDwellSeconds = descriptor.route.intermediateDwellMinutes
          ? Array.from({ length: stopCount }, (_, index) => index > 0 && index < stopCount - 1 ? descriptor.route.intermediateDwellMinutes * 60 : 0)
          : null;
        const timing = BORAIL_SERVICE.calculateStopTimes(
          trainSeed,
          Array.from({ length: stopCount }, (_, index) => `stop-${index}`),
          descriptor.departureMin,
          {
            segmentTimes: descriptor.route.segmentTimes || null,
            customDwellSeconds,
            mode: descriptor.mode
          }
        );
        const firstStop = timing.stops[0];
        const lastStop = timing.stops[timing.stops.length - 1];
        return {
          ...descriptor,
          trainSeed,
          delayInfo: {
            isDelayed: timing.hasDelay,
            delaySeconds: timing.delaySeconds,
            delayStartStop: timing.delayStartStop
          },
          startMin: firstStop.actualArrivalSec / 60,
          delayStartsMin: timing.delayStartSec === null ? null : timing.delayStartSec / 60,
          endMin: lastStop.actualDepartureSec / 60,
          serviceKey: `${descriptor.route.serviceId}-${descriptor.route.isExpress ? 'express' : 'local'}`
        };
      });
    }

    function computeStatusDelaySignals(now = BORAIL_CLOCK.now(), scheduledRuns) {
      const serviceContext = BORAIL_SERVICE.context(now);
      const nowMin = BORAIL_CLOCK.scheduleSeconds(now) / 60;
      const runs = scheduledRuns ?? globalThis.BORailSchedule?.buildRunWindow(now, { statusMinute: nowMin });
      const descriptors = runs ? runs.map(run => ({
        serviceKey: `${run.serviceId}-${run.isExpress ? 'express' : 'local'}`,
        departureMin: run.departureMin,
        startMin: run.stops ? run.stops[0].actualArrivalSec / 60 : Infinity,
        endMin: run.stops ? run.stops.at(-1).actualDepartureSec / 60 : -Infinity,
        delayStartsMin: run.delayStartSec == null ? null : run.delayStartSec / 60,
        delayInfo: { isDelayed: run.hasDelay, delaySeconds: run.delaySeconds }
      })) : statusRunDescriptors(now);
      return Object.fromEntries(SERVICES.map(service => {
        const relevant = descriptors.filter(run => run.serviceKey === service.id);
        const active = relevant.filter(run => nowMin >= run.startMin && nowMin < run.endMin);
        const delayed = active.filter(run => run.delayInfo.isDelayed && run.delayStartsMin !== null && nowMin >= run.delayStartsMin);
        const nextDeparture = relevant.filter(run => run.departureMin > nowMin).sort((left, right) => left.departureMin - right.departureMin)[0];
        const suspendedForWinter = serviceContext.winterEmergency && service.mode === 'express';
        let type = 'ok';
        if (delayed.length >= STATUS_DELAY_MAJOR_MIN_TRAINS) type = 'major';
        else if (delayed.length >= STATUS_DELAY_MINOR_MIN_TRAINS) type = 'minor';
        else if (!active.length) {
          const returnsSoon = nextDeparture && nextDeparture.departureMin - nowMin <= STATUS_SERVICE_LOOKAHEAD_MIN;
          type = !serviceContext.operatingWindowOpen || suspendedForWinter || !returnsSoon ? 'noservice' : 'noactive';
        } else if (serviceContext.winterEmergency) {
          type = 'winter';
        }
        const maxDelaySeconds = delayed.reduce((maximum, run) => Math.max(maximum, run.delayInfo.delaySeconds), 0);
        const reason = delayed.length
          ? `${service.letter} ${service.mode} ${delayed.length === 1 ? 'train' : 'trains'} delayed. Longest current delay: ${Math.round(maxDelaySeconds / 60)} ${maxDelaySeconds === 60 ? 'minute' : 'minutes'}.`
          : type === 'noactive'
            ? `No ${service.letter} ${service.mode} train is actively moving right now. Service remains scheduled.`
            : type === 'noservice'
              ? suspendedForWinter
                ? 'Express service is suspended under Winter Emergency protocols.'
                : 'No service is operating now or scheduled within the applicable service window.'
              : serviceContext.winterEmergency
                ? 'Winter Emergency service is operating with reduced frequency. Allow extra travel time.'
                : `All ${active.length} active ${service.letter} ${service.mode} ${active.length === 1 ? 'train is' : 'trains are'} currently on time.`;
        return [service.id, {
          type,
          delayed: delayed.length,
          total: active.length,
          maxDelaySeconds,
          reason,
          winterEmergency: serviceContext.winterEmergency,
          nextDepartureMin: nextDeparture?.departureMin ?? null
        }];
      }));
    }

    function renderStatus(state, delaySignals = computeStatusDelaySignals()){
      const host = document.getElementById('statusList');
      const client = globalThis.BORailOperationsClient;
      const ops = globalThis.BORailOperations;
      const schedule = globalThis.BORailSchedule;
      const now = BORAIL_CLOCK.now();
      const operationState = client?.state(now);
      const system = operationState?.shutdowns.find(item => item.kind === 'system');
      const noticeHost = document.getElementById('operationsNotices');
      if (noticeHost) noticeHost.innerHTML = system
        ? `<div class="row" id="systemOperationsNotice"><strong>System Closed</strong><span>${escapeHtml(client.text(system))}</span></div>`
        : '';
      if (client && ops && schedule) renderStationStatus(now, client, ops, schedule, operationState);
      host.innerHTML = state.statuses.map((stObj) => {
        const base = delaySignals[stObj.id] || { type: 'noservice', reason: 'No service information is available.' };
        const override = client && schedule && ops.describeService(stObj.id, schedule.routesForDate(now),
          +now, client.snapshot, route => schedule.getEffectiveRoutePattern(route, BORAIL_SERVICE.context(now).mode));
        const signal = override || base;
        const svcName = stObj.nameHtml;
        const st = signal.type;

        const icon = `<img class="lnicon" src="${stObj.icon}" alt="${stObj.letter} ${stObj.mode}" loading="lazy" onerror="this.style.display='none'">`;
        const left = `<div class="name">${svcName}</div>`;

        if (st === 'ok'){
          return `
            <div class="row" data-service-id="${stObj.id}" data-status-type="${st}">
              ${icon}
              ${left}
              <span class="pill ok">No Disruptions</span>
            </div>`;
        }
        const cls = st === 'minor' ? 'warn'
          : st === 'major' ? 'bad'
          : st === 'noactive' ? 'idle'
          : st === 'winter' || st === 'rerouted' || st === 'bypassed' ? 'winter'
          : 'nosvc';
        const label = st === 'minor' ? 'Minor Disruptions'
          : st === 'major' ? 'Major Disruptions'
          : st === 'noactive' ? 'No Active Trains'
          : st === 'winter' ? 'Winter Emergency Service'
          : st === 'system-closed' ? 'System Closed'
          : st === 'rerouted' ? 'Rerouted Service'
          : st === 'bypassed' ? 'Station Bypassed' : 'NO SERVICE';
        return `
          <details class="srow" data-service-id="${stObj.id}" data-status-type="${st}">
            <summary>
              ${icon}
              ${left}
              <span class="pill ${cls}">${label}<span class="arrow">▸</span></span>
            </summary>
            <div class="reason">${escapeHtml(signal.reason)}${signal.endsAt ? ` · Expected end: ${escapeHtml(client.timeLabel(signal.endsAt))}` : ''}</div>
          </details>`;
      }).join('');
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

    function renderStationBadges(station, badges = STATUS_STATION_SERVICES[station] || []) {
      if (!badges.length) return '';
      return `<span class="station-badges">${badges.map(badge => {
        const src = lineBadgePath(badge.s, Boolean(badge.e));
        if (!src) return '';
        const alt = badge.e ? `<${badge.s}>` : `(${badge.s})`;
        return `<img src="${src}" alt="${escapeHtml(alt)}" loading="lazy">`;
      }).join('')}</span>`;
    }

    let stationStatusMarkup;

    function renderStationStatus(now, client, ops, schedule, operationState) {
      const host = document.getElementById('stationStatusList');
      const routes = schedule.routesForDate(now, { allowWinter: false });
      const active = [...operationState.stations.values()];
      const scheduled = [];
      const reopened = [];
      for (const item of client.snapshot.changes) {
        if (item.kind !== 'station' || (item.endsAt != null && item.endsAt <= item.startsAt)) continue;
        if (item.startsAt > +now) scheduled.push(item);
        else if (item.endsAt != null && item.endsAt <= +now && item.endsAt > +now - 86400000 &&
          !ops.atTime(client.snapshot, item.endsAt).stations.has(item.target)) reopened.push(item);
      }
      active.sort((a, b) => a.target.localeCompare(b.target));
      scheduled.sort((a, b) => a.startsAt - b.startsAt);
      reopened.sort((a, b) => b.endsAt - a.endsAt);

      function renderNotice(item, type) {
        const services = new Set(routes.filter(route => route.stops.includes(item.target)).map(ops.serviceKey));
        const badges = SERVICES.filter(service => services.has(service.id))
          .map(service => ({ s: service.letter, e: service.mode === 'express' }));
        const label = { closed: 'Station Closed', scheduled: 'Scheduled Closure', reopened: 'Station Reopened' }[type];
        const endLabel = type === 'reopened' ? 'Reopened' : 'Expected reopening';
        const end = item.endsAt == null ? 'Until further notice' : client.timeLabel(item.endsAt);
        return `<details class="station-notice" data-closed-station="${escapeHtml(item.target)}" data-notice-id="${escapeHtml(item.id)}">
          <summary>
            <span class="station-notice-name"><strong>${escapeHtml(item.target)}</strong>${renderStationBadges(item.target, badges)}</span>
            <span class="station-notice-chevron" aria-hidden="true"></span>
          </summary>
          <div class="station-notice-details">
            <strong>${label}</strong>
            <p>${type === 'reopened' ? 'Original closure reason' : 'Reason'}: ${escapeHtml(item.reason)}</p>
            <p>Closure start: ${escapeHtml(client.timeLabel(item.startsAt))}</p>
            <p>${endLabel}: ${escapeHtml(end)}</p>
          </div>
        </details>`;
      }

      // List current closures first so existing station notification links find them before older notices.
      const markup = (active.length ? active.map(item => renderNotice(item, 'closed')).join('')
        : '<p class="station-status-empty">No stations are currently closed.</p>') +
        (scheduled.length ? '<h3>Scheduled Closures</h3>' + scheduled.map(item => renderNotice(item, 'scheduled')).join('') : '') +
        (reopened.length ? '<h3>Recently Reopened</h3>' + reopened.map(item => renderNotice(item, 'reopened')).join('') : '');
      if (markup === stationStatusMarkup) return;
      stationStatusMarkup = markup;
      const openNotices = new Set(Array.from(host.querySelectorAll('details[open]'), row => row.dataset.noticeId));
      const focusedNotice = document.activeElement?.closest('.station-notice')?.dataset.noticeId;
      host.innerHTML = markup;
      for (const row of host.querySelectorAll('details')) {
        row.open = openNotices.has(row.dataset.noticeId);
        if (row.dataset.noticeId === focusedNotice) row.querySelector('summary').focus({ preventScroll: true });
      }
    }

    function formatElevatorTime(timestamp) {
      return BORAIL_CLOCK.formatDateTime(timestamp, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
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
      const dayKey = BORAIL_CLOCK.dateKey(nowMs);
      const dayStart = BORAIL_CLOCK.startOfDay(nowMs);
      return {
        dayKey,
        dayStart: dayStart.getTime()
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
      return `<details class="elevator-row ${repaired ? 'recently-repaired' : ''}" data-station="${escapeHtml(station)}">
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

    const STATUS_STATE = { statuses: SERVICES };
    let ELEVATOR_STATE = null;
    let requestedStatusShown = false;

    function focusRequestedStatus() {
      if (requestedStatusShown || document.getElementById('splash-screen')) return;
      const params = new URLSearchParams(location.search);
      const service = params.get('service');
      const station = params.get('station');
      const closedStation = params.get('closedStation');
      const target = service
        ? document.querySelector(`[data-service-id="${CSS.escape(service)}"]`)
        : station
          ? Array.from(document.querySelectorAll('.elevator-row[data-station]')).find(row => row.dataset.station === station)
          : closedStation ? Array.from(document.querySelectorAll('#stationStatusList [data-closed-station]')).find(row => row.dataset.closedStation === closedStation)
            : params.has('operations') ? document.getElementById('systemOperationsNotice') || document.getElementById('statusList') : null;
      if (!target) return;
      requestedStatusShown = true;
      if (target.tagName === 'DETAILS') target.open = true;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'center' });
      target.animate?.([
        { boxShadow: '0 0 0 0 rgba(138,143,255,0)' },
        { boxShadow: '0 0 0 4px rgba(138,143,255,.45)' },
        { boxShadow: '0 0 0 0 rgba(138,143,255,0)' }
      ], { duration: reduceMotion ? 0 : 1500, easing: 'ease-out' });
    }

    globalThis.BORailStatusEngine = Object.freeze({
      services: SERVICES,
      computeStatusDelaySignals,
      buildDailyElevatorState,
      elevatorStatusFor,
      elevatorUnits: ELEVATOR_UNITS
    });

    if (typeof document !== 'undefined') {
      ELEVATOR_STATE = getOrCreateElevatorState();
      renderStatus(STATUS_STATE);
      renderElevatorStatus(ELEVATOR_STATE);
      window.addEventListener('borail:operations', () => {
        renderStatus(STATUS_STATE);
        focusRequestedStatus();
      });
      if (document.getElementById('splash-screen')) {
        document.addEventListener('borail:splashend', focusRequestedStatus, { once: true });
      } else {
        window.setTimeout(focusRequestedStatus, 60);
      }

      window.BORailStatusDebug = {
        services: SERVICES,
        statusState: STATUS_STATE,
        computeStatusDelaySignals,
        renderStatus,
        elevatorState: ELEVATOR_STATE,
        buildDailyElevatorState,
        renderElevatorStatus
      };

      // Re-render when New York crosses into a different service window.
      let _lastKey = scheduleKey();
      setInterval(() => {
        const k = scheduleKey();
        if (k !== _lastKey){
          _lastKey = k;
        }
        renderStatus(STATUS_STATE);
        renderElevatorStatus(ELEVATOR_STATE);
        focusRequestedStatus();
      }, 30 * 1000);
    }
