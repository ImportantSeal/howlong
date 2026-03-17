(() => {
  const app = window.UntilApp;
  const { constants, formatters, state } = app;

  function normalizeTimeZone(timeZone) {
    if (!timeZone) {
      return null;
    }

    const trimmedTimeZone = String(timeZone).trim();

    if (!trimmedTimeZone) {
      return null;
    }

    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: trimmedTimeZone,
      }).resolvedOptions().timeZone;
    } catch (error) {
      return null;
    }
  }

  function getBrowserTimeZone() {
    try {
      return normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch (error) {
      return null;
    }
  }

  function getDateTimeFormatter(timeZone) {
    if (!formatters.dateTimeFormatterCache.has(timeZone)) {
      formatters.dateTimeFormatterCache.set(timeZone, new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }));
    }

    return formatters.dateTimeFormatterCache.get(timeZone);
  }

  function getZonePartFormatter(timeZone) {
    if (!formatters.zonePartFormatterCache.has(timeZone)) {
      formatters.zonePartFormatterCache.set(timeZone, new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }));
    }

    return formatters.zonePartFormatterCache.get(timeZone);
  }

  function getSupportedTimeZones() {
    const fallbackZones = [
      state.defaultTimeZone,
      constants.LEGACY_TIME_ZONE,
      "UTC",
      "Europe/London",
      "Europe/Berlin",
      "America/New_York",
      "America/Los_Angeles",
      "Asia/Tokyo",
      "Australia/Sydney",
    ];

    const supportedZones = typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [];

    return [...new Set([...fallbackZones, ...supportedZones].filter(Boolean))];
  }

  function getPartsInZone(date, timeZone) {
    const partMap = {};
    const formatter = getZonePartFormatter(timeZone);

    for (const part of formatter.formatToParts(date)) {
      if (part.type !== "literal") {
        partMap[part.type] = part.value;
      }
    }

    return {
      year: Number(partMap.year),
      month: Number(partMap.month),
      day: Number(partMap.day),
      hour: Number(partMap.hour),
      minute: Number(partMap.minute),
      second: Number(partMap.second),
    };
  }

  function getTimeZoneOffsetMs(date, timeZone) {
    const parts = getPartsInZone(date, timeZone);
    const wallClockAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );

    return wallClockAsUtc - date.getTime();
  }

  function zonedTimeToUtc(components, timeZone) {
    const utcGuess = Date.UTC(
      components.year,
      components.month - 1,
      components.day,
      components.hour,
      components.minute,
      components.second || 0,
    );

    let candidate = new Date(
      utcGuess - getTimeZoneOffsetMs(new Date(utcGuess), timeZone),
    );
    const refinedOffset = getTimeZoneOffsetMs(candidate, timeZone);
    candidate = new Date(utcGuess - refinedOffset);

    return candidate;
  }

  state.browserTimeZone = getBrowserTimeZone();
  state.defaultTimeZone = state.browserTimeZone || constants.LEGACY_TIME_ZONE;

  app.time = {
    normalizeTimeZone,
    getDateTimeFormatter,
    getSupportedTimeZones,
    getPartsInZone,
    zonedTimeToUtc,
  };
})();
