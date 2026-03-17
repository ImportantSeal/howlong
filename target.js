(() => {
  const app = window.UntilApp;
  const { constants, state } = app;
  const { sanitizeLabel, pad } = app.helpers;
  const { normalizeTimeZone, getPartsInZone, zonedTimeToUtc } = app.time;

  function parseTimeString(timeString) {
    const match = /^(\d{2}):(\d{2})$/.exec(timeString);
    if (!match) {
      return null;
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (hour > 23 || minute > 59) {
      return null;
    }

    return { hour, minute };
  }

  function buildTarget(
    dateString,
    timeString,
    timeZoneInputValue,
    labelInput = "",
  ) {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
    const timeParts = parseTimeString(timeString);
    const timeZone = normalizeTimeZone(timeZoneInputValue);

    if (!dateMatch || !timeParts || !timeZone) {
      return null;
    }

    const components = {
      year: Number(dateMatch[1]),
      month: Number(dateMatch[2]),
      day: Number(dateMatch[3]),
      hour: timeParts.hour,
      minute: timeParts.minute,
      second: 0,
    };

    const date = zonedTimeToUtc(components, timeZone);
    const resolved = getPartsInZone(date, timeZone);
    const isExactMatch =
      resolved.year === components.year &&
      resolved.month === components.month &&
      resolved.day === components.day &&
      resolved.hour === components.hour &&
      resolved.minute === components.minute;

    if (!isExactMatch) {
      return null;
    }

    return {
      date,
      dateString,
      timeString,
      timeZone,
      label: sanitizeLabel(labelInput),
    };
  }

  function getNextDefaultTarget(timeZone) {
    const resolvedTimeZone = normalizeTimeZone(timeZone) || state.defaultTimeZone;
    const zonedNow = getPartsInZone(new Date(), resolvedTimeZone);
    const targetDate = new Date(Date.UTC(
      zonedNow.year,
      zonedNow.month - 1,
      zonedNow.day,
    ));

    targetDate.setUTCDate(targetDate.getUTCDate() + 1);

    const dateString = [
      targetDate.getUTCFullYear(),
      pad(targetDate.getUTCMonth() + 1),
      pad(targetDate.getUTCDate()),
    ].join("-");

    return buildTarget(
      dateString,
      constants.DEFAULT_TIME,
      resolvedTimeZone,
      "",
    );
  }

  function readTargetFromUrl() {
    const url = new URL(window.location.href);
    const directTarget = url.searchParams.get("target");
    const dateString = url.searchParams.get("date");
    const timeString = url.searchParams.get("time");
    const rawTimeZone = url.searchParams.get("zone")
      || url.searchParams.get("timezone");
    const timeZone = rawTimeZone
      ? normalizeTimeZone(rawTimeZone)
      : constants.LEGACY_TIME_ZONE;
    const label = sanitizeLabel(url.searchParams.get("label"));

    if (rawTimeZone && !timeZone) {
      return null;
    }

    if (directTarget) {
      const [targetDateString, targetTimeString] = directTarget.split("T");
      return buildTarget(
        targetDateString,
        targetTimeString || constants.DEFAULT_TIME,
        timeZone,
        label,
      );
    }

    if (dateString && timeString) {
      return buildTarget(dateString, timeString, timeZone, label);
    }

    return null;
  }

  function loadStoredTargetFromKey(storageKey) {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      return buildTarget(
        parsed.dateString,
        parsed.timeString,
        parsed.timeZone || parsed.zone || constants.LEGACY_TIME_ZONE,
        parsed.label,
      );
    } catch (error) {
      return null;
    }
  }

  function loadStoredTarget() {
    return loadStoredTargetFromKey(constants.STORAGE_KEY)
      || loadStoredTargetFromKey(constants.LEGACY_STORAGE_KEY);
  }

  function persistTarget(target) {
    try {
      window.localStorage.setItem(constants.STORAGE_KEY, JSON.stringify({
        dateString: target.dateString,
        timeString: target.timeString,
        timeZone: target.timeZone,
        label: target.label,
      }));
    } catch (error) {
      // localStorage is optional for this page.
    }
  }

  function updateUrl(target) {
    const url = new URL(window.location.href);
    url.searchParams.set("target", `${target.dateString}T${target.timeString}`);
    url.searchParams.set("zone", target.timeZone);

    if (target.label) {
      url.searchParams.set("label", target.label);
    } else {
      url.searchParams.delete("label");
    }

    url.searchParams.delete("date");
    url.searchParams.delete("time");
    url.searchParams.delete("timezone");
    window.history.replaceState({}, "", url);
  }

  app.target = {
    buildTarget,
    getNextDefaultTarget,
    readTargetFromUrl,
    loadStoredTarget,
    persistTarget,
    updateUrl,
  };
})();
