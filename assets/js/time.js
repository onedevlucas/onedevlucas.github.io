(function(root) {
  'use strict';

  const TIME_ZONE = 'America/New_York';
  const PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short'
  });

  function asDate(value = Date.now()) {
    return value instanceof Date ? value : new Date(value);
  }

  function parts(value = Date.now()) {
    const date = asDate(value);
    const values = {};
    PARTS_FORMATTER.formatToParts(date).forEach(part => {
      if (part.type !== 'literal') values[part.type] = part.value;
    });
    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
      hour: Number(values.hour),
      minute: Number(values.minute),
      second: Number(values.second),
      zoneName: values.timeZoneName || 'ET'
    };
  }

  function dateKey(value = Date.now()) {
    const valueParts = parts(value);
    return `${valueParts.year}-${String(valueParts.month).padStart(2, '0')}-${String(valueParts.day).padStart(2, '0')}`;
  }

  function inputTimeValue(value = Date.now()) {
    const valueParts = parts(value);
    return `${String(valueParts.hour).padStart(2, '0')}:${String(valueParts.minute).padStart(2, '0')}`;
  }

  function clockMinutes(value = Date.now()) {
    const valueParts = parts(value);
    return valueParts.hour * 60 + valueParts.minute;
  }

  function clockSeconds(value = Date.now()) {
    const valueParts = parts(value);
    return valueParts.hour * 3600 + valueParts.minute * 60 + valueParts.second;
  }

  function fromWallTime(dateValue, timeValue = '00:00') {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ''));
    const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(timeValue || ''));
    if (!dateMatch || !timeMatch) return null;

    const desired = {
      year: Number(dateMatch[1]),
      month: Number(dateMatch[2]),
      day: Number(dateMatch[3]),
      hour: Number(timeMatch[1]),
      minute: Number(timeMatch[2]),
      second: Number(timeMatch[3] || 0)
    };
    if (desired.month < 1 || desired.month > 12 || desired.day < 1 || desired.day > 31 ||
        desired.hour > 23 || desired.minute > 59 || desired.second > 59) return null;

    const desiredAsUtc = Date.UTC(
      desired.year,
      desired.month - 1,
      desired.day,
      desired.hour,
      desired.minute,
      desired.second
    );
    let timestamp = desiredAsUtc;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const observed = parts(timestamp);
      const observedAsUtc = Date.UTC(
        observed.year,
        observed.month - 1,
        observed.day,
        observed.hour,
        observed.minute,
        observed.second
      );
      timestamp += desiredAsUtc - observedAsUtc;
    }

    const result = new Date(timestamp);
    const resultParts = parts(result);
    const matches = ['year', 'month', 'day', 'hour', 'minute', 'second']
      .every(key => resultParts[key] === desired[key]);
    return matches ? result : null;
  }

  function startOfDay(value = Date.now()) {
    return fromWallTime(dateKey(value), '00:00');
  }

  function formatDateTime(value, options = {}) {
    return new Intl.DateTimeFormat(undefined, {
      ...options,
      timeZone: TIME_ZONE
    }).format(asDate(value));
  }

  root.BORailTime = Object.freeze({
    TIME_ZONE,
    parts,
    dateKey,
    inputTimeValue,
    clockMinutes,
    clockSeconds,
    fromWallTime,
    startOfDay,
    formatDateTime
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
