(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BORailTripPlanner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function itinerarySignature(legs) {
    return legs.map(leg => `${leg.runId}:${leg.boardStation}>${leg.alightStation}`).join('|');
  }

  function buildBoardIndex(runs) {
    const index = new Map();
    runs.forEach(run => {
      run.stops.forEach((stop, stopIndex) => {
        if (stopIndex >= run.stops.length - 1) return;
        if (!index.has(stop.name)) index.set(stop.name, []);
        index.get(stop.name).push({ run, stopIndex, departureSec: stop.actualDepartureSec });
      });
    });
    index.forEach(events => events.sort((a, b) => a.departureSec - b.departureSec));
    return index;
  }

  function lowerBound(events, target) {
    let low = 0;
    let high = events.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (events[mid].departureSec < target) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  function planJourneys(options) {
    const runs = options.runs || [];
    const origin = options.origin;
    const destination = options.destination;
    const startTimeSec = Number(options.startTimeSec) || 0;
    const minTransferSec = Number(options.minTransferSec) || 120;
    const maxTransfers = Number.isFinite(options.maxTransfers) ? options.maxTransfers : 5;
    const maxResults = Number.isFinite(options.maxResults) ? options.maxResults : 12;
    const searchHorizonSec = Number(options.searchHorizonSec) || 8 * 3600;
    const boardIndex = buildBoardIndex(runs);

    if (!origin || !destination || origin === destination) return [];

    const queue = [{
      station: origin,
      timeSec: startTimeSec,
      legs: [],
      visitedStations: new Set([origin])
    }];
    const stationLabels = new Map([[origin, [{ timeSec: startTimeSec, transfers: -1, lastService: '' }]]]);
    const results = [];
    const resultSignatures = new Set();
    let iterations = 0;

    while (queue.length && results.length < maxResults && iterations < 12000) {
      queue.sort((a, b) => a.timeSec - b.timeSec || a.legs.length - b.legs.length);
      const state = queue.shift();
      iterations += 1;
      if (state.timeSec > startTimeSec + searchHorizonSec) continue;
      if (state.legs.length > maxTransfers + 1) continue;

      const events = boardIndex.get(state.station) || [];
      const readyTime = state.timeSec + (state.legs.length ? minTransferSec : 0);
      const startIndex = lowerBound(events, readyTime);
      const perPatternCount = new Map();
      let considered = 0;

      for (let eventIndex = startIndex; eventIndex < events.length; eventIndex += 1) {
        const event = events[eventIndex];
        if (event.departureSec > readyTime + 150 * 60) break;
        const run = event.run;
        const previousLeg = state.legs[state.legs.length - 1];
        if (previousLeg && previousLeg.runId === run.id) continue;

        const pattern = `${run.serviceId}-${run.isExpress ? 'EXP' : 'LCL'}-${run.destination}`;
        const patternCount = perPatternCount.get(pattern) || 0;
        if (patternCount >= 3) continue;
        perPatternCount.set(pattern, patternCount + 1);
        considered += 1;
        if (considered > 24) break;

        const boardStop = run.stops[event.stopIndex];
        for (let alightIndex = event.stopIndex + 1; alightIndex < run.stops.length; alightIndex += 1) {
          const alightStop = run.stops[alightIndex];
          if (state.visitedStations.has(alightStop.name) && alightStop.name !== destination) continue;

          const waitSec = Math.max(0, boardStop.actualDepartureSec - state.timeSec);
          const transferWaitSec = state.legs.length ? waitSec : 0;
          const leg = {
            runId: run.id,
            serviceId: run.serviceId,
            isExpress: Boolean(run.isExpress),
            tag: run.tag,
            origin: run.origin,
            destination: run.destination,
            boardStation: state.station,
            alightStation: alightStop.name,
            boardIndex: event.stopIndex,
            alightIndex,
            scheduledDepartureSec: boardStop.scheduledDepartureSec ?? boardStop.scheduledArrivalSec,
            actualDepartureSec: boardStop.actualDepartureSec,
            scheduledArrivalSec: alightStop.scheduledArrivalSec,
            actualArrivalSec: alightStop.actualArrivalSec,
            transferWaitSec,
            delayed: Boolean(boardStop.isDelayed || alightStop.isDelayed || run.hasDelay),
            delaySeconds: Math.max(boardStop.delaySeconds || 0, alightStop.delaySeconds || 0, run.delaySeconds || 0),
            stops: run.stops.slice(event.stopIndex, alightIndex + 1),
            trainSeed: run.trainSeed
          };
          const legs = [...state.legs, leg];

          if (alightStop.name === destination) {
            const signature = itinerarySignature(legs);
            if (!resultSignatures.has(signature)) {
              resultSignatures.add(signature);
              results.push({
                origin,
                destination,
                requestedDepartureSec: startTimeSec,
                departureSec: legs[0].actualDepartureSec,
                arrivalSec: alightStop.actualArrivalSec,
                durationSec: alightStop.actualArrivalSec - startTimeSec,
                rideDurationSec: alightStop.actualArrivalSec - legs[0].actualDepartureSec,
                transfers: legs.length - 1,
                legs,
                hasExpress: legs.some(item => item.isExpress),
                hasDelay: legs.some(item => item.delayed),
                signature
              });
            }
            continue;
          }

          if (legs.length > maxTransfers + 1) continue;
          const nextTransfers = legs.length - 1;
          const lastService = `${run.serviceId}-${run.isExpress ? 'EXP' : 'LCL'}`;
          const labels = stationLabels.get(alightStop.name) || [];
          const dominated = labels.some(label =>
            label.timeSec <= alightStop.actualArrivalSec &&
            label.transfers <= nextTransfers &&
            label.lastService === lastService
          );
          if (dominated) continue;

          labels.push({ timeSec: alightStop.actualArrivalSec, transfers: nextTransfers, lastService });
          labels.sort((a, b) => a.timeSec - b.timeSec || a.transfers - b.transfers);
          stationLabels.set(alightStop.name, labels.slice(0, 12));
          const visitedStations = new Set(state.visitedStations);
          visitedStations.add(alightStop.name);
          queue.push({ station: alightStop.name, timeSec: alightStop.actualArrivalSec, legs, visitedStations });
        }
      }
    }

    return results
      .sort((a, b) => a.arrivalSec - b.arrivalSec || a.transfers - b.transfers || a.departureSec - b.departureSec)
      .slice(0, maxResults);
  }

  function selectRecommendedJourneys(localJourneys, allJourneys, options = {}) {
    const expressMinimumGainSec = Number(options.expressMinimumGainSec) || 120;
    const limit = Number(options.limit) || 3;
    const bestLocalArrival = localJourneys.length ? localJourneys[0].arrivalSec : Infinity;
    const candidates = [];
    const signatures = new Set();

    [...localJourneys, ...allJourneys].forEach(journey => {
      if (signatures.has(journey.signature)) return;
      if (journey.hasExpress && Number.isFinite(bestLocalArrival) && journey.arrivalSec > bestLocalArrival - expressMinimumGainSec) return;
      signatures.add(journey.signature);
      candidates.push(journey);
    });

    const sorted = candidates
      .sort((a, b) => a.arrivalSec - b.arrivalSec || a.transfers - b.transfers || a.departureSec - b.departureSec);
    const useful = [];
    sorted.forEach(journey => {
      const dominated = useful.some(existing =>
        existing.arrivalSec <= journey.arrivalSec &&
        existing.transfers <= journey.transfers &&
        Math.abs(existing.departureSec - journey.departureSec) < 5 * 60
      );
      if (!dominated) useful.push(journey);
    });
    return useful.slice(0, limit);
  }

  return { buildBoardIndex, itinerarySignature, planJourneys, selectRecommendedJourneys };
});
