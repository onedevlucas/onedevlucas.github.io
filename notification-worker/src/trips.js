import '../../assets/js/time.js';
import '../../assets/js/service-calendar.js';
import '../../assets/js/schedule.js';

const CLOCK = globalThis.BORailTime;
const SERVICE = globalThis.BORailService;
const SCHEDULE = globalThis.BORailSchedule;
const stations = new Set(SCHEDULE.STATIONS.map(station => station.name));
const MINUTE = 60_000;
export const TRIP_LIMIT = 5;

function timestamp(dateKey, seconds) {
  // Scheduled service runs after the DST changeover hour. Anchor to a wall
  // time on that service date so 08:00 stays 08:00 on clock-change days.
  const noon = CLOCK.fromWallTime(dateKey, '12:00');
  return noon.getTime() + (seconds - 43200) * 1000;
}

function stationPair(run, leg) {
  const board = run?.stops.find(stop => stop.name === leg.boardStation);
  const alight = run?.stops.find(stop => stop.name === leg.alightStation);
  return board && alight && board.stopIndex < alight.stopIndex ? { board, alight } : null;
}

export function prepareTrip(input, now = new Date()) {
  const { dateKey, origin, destination, legs } = input ?? {};
  const date = typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    ? CLOCK.fromWallTime(dateKey, '12:00') : null;
  if (!date || dateKey < CLOCK.dateKey(now) || date.getTime() - now.getTime() > 181 * 86400_000
    || !stations.has(origin) || !stations.has(destination) || origin === destination
    || !Array.isArray(legs) || legs.length < 1 || legs.length > 6
    || legs.some(leg => typeof leg?.runId !== 'string' || leg.runId.length > 250)) {
    throw new Error('Choose a valid BORail trip within the next 180 days.');
  }
  const options = SCHEDULE.planningOptions(date, now);
  const service = SERVICE.context(date, options);
  const rawRuns = SCHEDULE.buildScheduledRuns(date, true, { ...options, runIds: new Set(legs.map(leg => leg?.runId)) });
  const runs = new Map(rawRuns.map(run => [run.id, run]));
  const currentSeconds = (now.getTime() - timestamp(dateKey, 0)) / 1000;
  const actual = (run, stop, type) => knowsDelay(run, currentSeconds)
    ? stop[`actual${type}Sec`] : stop[`scheduled${type}Sec`];
  let previousArrival;
  let previousAlight;
  const savedLegs = legs.map(leg => {
    const run = runs.get(leg?.runId);
    const pair = stationPair(run, leg);
    if (!pair || (previousAlight && leg.boardStation !== previousAlight)) {
      throw new Error('This itinerary has changed. Find your trip again.');
    }
    const { board, alight } = pair;
    const departure = actual(run, board, 'Departure');
    if (previousArrival !== undefined && departure - previousArrival < 120) {
      throw new Error('This connection has changed. Find your trip again.');
    }
    previousArrival = actual(run, alight, 'Arrival');
    previousAlight = leg.alightStation;
    return {
      runId: run.id,
      serviceId: run.serviceId,
      isExpress: run.isExpress,
      boardStation: board.name,
      alightStation: alight.name,
      departureSec: board.scheduledDepartureSec,
      arrivalSec: alight.scheduledArrivalSec,
      expectedDepartureSec: departure,
      expectedArrivalSec: previousArrival
    };
  });
  const first = savedLegs[0];
  const last = savedLegs.at(-1);
  const startsAt = timestamp(dateKey, first.expectedDepartureSec);
  if (startsAt <= now.getTime()) throw new Error('This trip has already departed. Find a later trip.');
  return {
    dateKey, origin, destination, legs: savedLegs, startsAt,
    winterEmergency: service.winterEmergency,
    expiresAt: timestamp(dateKey, last.expectedArrivalSec) + 60 * MINUTE
  };
}

function knowsDelay(run, seconds) {
  return run.hasDelay && run.delayStartSec !== null
    && seconds >= Math.max(run.delayStartSec, run.stops[0].actualArrivalSec);
}

function lineName(leg) {
  return `${leg.serviceId} ${leg.isExpress ? 'Express ' : ''}train`;
}

function plannerLink(trip) {
  return `index.html?${new URLSearchParams({ view: 'planner', from: trip.origin, to: trip.destination })}`;
}

export function tripIsComplete(trip, runIndex, now) {
  const last = trip.legs.at(-1);
  const pair = stationPair(runIndex.get(last.runId), last);
  return Boolean(pair && now.getTime() >= timestamp(trip.dateKey, pair.alight.actualArrivalSec));
}

export function tripCandidates(trip, runIndex, now, { winterEmergency, flags = [] }) {
  const due = [];
  const previous = new Set(flags);
  const sec = (now.getTime() - timestamp(trip.dateKey, 0)) / 1000;
  const url = plannerLink(trip);
  const push = (key, title, body, deadline) => {
    if (!previous.has(key) && deadline > now.getTime()) due.push({ key, title, body, url, deadline });
  };
  if (previous.has('replan')) return due;
  const legs = trip.legs.map(leg => {
    const run = runIndex.get(leg.runId);
    const pair = stationPair(run, leg);
    if (!pair) return null;
    const { board, alight } = pair;
    const known = knowsDelay(run, sec);
    return {
      board, alight, run, leg, known,
      departure: known ? board.actualDepartureSec : board.scheduledDepartureSec,
      arrival: known ? alight.actualArrivalSec : alight.scheduledArrivalSec
    };
  });
  if (legs.some((item, index) => !item || item.board.scheduledDepartureSec !== trip.legs[index].departureSec
      || item.alight.scheduledArrivalSec !== trip.legs[index].arrivalSec)) {
    push('replan', `Replan your trip to ${trip.destination}`, winterEmergency && !trip.winterEmergency
      ? 'Winter Emergency Service is in effect today and has changed your itinerary. Open Plan a Trip for an updated route.'
      : 'The timetable for your saved trip has changed. Open Plan a Trip for an updated route.', trip.expiresAt);
    return due;
  }

  const first = legs[0];
  const remaining = first.departure - sec;
  if (remaining > 0 && remaining <= 1200) {
    const minutes = Math.ceil(remaining / 60);
    push('reminder', `Your trip to ${trip.destination} is today`,
      `Your first train leaves ${first.leg.boardStation} in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`,
      timestamp(trip.dateKey, first.departure));
  }
  legs.forEach((item, index) => {
    const { leg, board, alight, known, departure, arrival, run } = item;
    if (known && sec < run.stops.at(-1).actualDepartureSec && sec < arrival && alight.delaySeconds > 0) {
      const beforeBoarding = sec < departure;
      const delay = beforeBoarding && board.delaySeconds ? board.delaySeconds : alight.delaySeconds;
      const minutes = Math.round(delay / 60);
      const body = beforeBoarding && board.delaySeconds
        ? `Your ${lineName(leg)} scheduled to leave ${leg.boardStation} at ${SCHEDULE.formatTripClock(leg.departureSec)} is delayed by ${minutes} min.`
        : `Your ${lineName(leg)} is expected to arrive at ${leg.alightStation} ${minutes} min late.`;
      push(`delay-${index}-${delay}`, `${lineName(leg)} delayed`, body, timestamp(trip.dateKey, arrival));
    }
    const next = legs[index + 1];
    if (next && (known || next.known) && sec < next.departure && next.departure - arrival < 120) {
      push(`transfer-${index}`, `Connection at risk · ${leg.alightStation}`,
        `Your connection to the ${lineName(next.leg)} may be missed. Open Plan a Trip to check alternatives.`,
        timestamp(trip.dateKey, next.departure));
    }
  });
  return due;
}
