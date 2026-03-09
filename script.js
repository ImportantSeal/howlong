const LEGACY_TIME_ZONE = "Europe/Helsinki";
const DEFAULT_TIME = "17:00";
const STORAGE_KEY = "countdown-target";
const LEGACY_STORAGE_KEY = "helsinki-countdown-target";
const APP_TITLE = "Until";
const FALLBACK_LABEL = "How long until...?";

const browserTimeZone = getBrowserTimeZone();
const defaultTimeZone = browserTimeZone || LEGACY_TIME_ZONE;

const targetForm = document.querySelector("#target-form");
const targetLabelInput = document.querySelector("#target-label");
const dateInput = document.querySelector("#target-date");
const timeInput = document.querySelector("#target-time");
const timeZoneInput = document.querySelector("#target-zone");
const timeZoneOptions = document.querySelector("#time-zone-options");
const copyLinkButton = document.querySelector("#copy-link-button");
const controls = document.querySelector("#controls");
const targetZoneLabel = document.querySelector("#target-zone-label");
const targetLabelDisplay = document.querySelector("#target-label-display");
const targetZoneLine = document.querySelector("#target-zoned");
const targetLocal = document.querySelector("#target-local");
const statusText = document.querySelector("#status-text");
const feedback = document.querySelector("#feedback");

const valueNodes = {
  days: document.querySelector("#days"),
  hours: document.querySelector("#hours"),
  minutes: document.querySelector("#minutes"),
  seconds: document.querySelector("#seconds"),
};

const localFormatter = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateTimeFormatterCache = new Map();
const zonePartFormatterCache = new Map();

let activeTarget = null;
let countdownInterval = null;
let feedbackTimer = null;

function sanitizeLabel(label) {
  return String(label || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 60);
}

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
  if (!dateTimeFormatterCache.has(timeZone)) {
    dateTimeFormatterCache.set(timeZone, new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }));
  }

  return dateTimeFormatterCache.get(timeZone);
}

function getZonePartFormatter(timeZone) {
  if (!zonePartFormatterCache.has(timeZone)) {
    zonePartFormatterCache.set(timeZone, new Intl.DateTimeFormat("en-US", {
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

  return zonePartFormatterCache.get(timeZone);
}

function getSupportedTimeZones() {
  const fallbackZones = [
    defaultTimeZone,
    LEGACY_TIME_ZONE,
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

function pad(value) {
  return String(value).padStart(2, "0");
}

function getDisplayLabel(label) {
  return sanitizeLabel(label) || FALLBACK_LABEL;
}

function getDocumentTitle(label, daysRemaining, hasArrived) {
  const safeLabel = sanitizeLabel(label);

  if (hasArrived) {
    return safeLabel ? `${safeLabel} | ${APP_TITLE}` : APP_TITLE;
  }

  const prefix = `${daysRemaining}d left`;
  return safeLabel ? `${prefix} | ${safeLabel} | ${APP_TITLE}` : `${prefix} | ${APP_TITLE}`;
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

  let candidate = new Date(utcGuess - getTimeZoneOffsetMs(new Date(utcGuess), timeZone));
  const refinedOffset = getTimeZoneOffsetMs(candidate, timeZone);
  candidate = new Date(utcGuess - refinedOffset);

  return candidate;
}

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

function buildTarget(dateString, timeString, timeZoneInputValue, labelInput = "") {
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
  const resolvedTimeZone = normalizeTimeZone(timeZone) || defaultTimeZone;
  const zonedNow = getPartsInZone(new Date(), resolvedTimeZone);
  const timeParts = parseTimeString(DEFAULT_TIME);
  const targetDate = new Date(Date.UTC(
    zonedNow.year,
    zonedNow.month - 1,
    zonedNow.day,
  ));

  const isPastOrCurrentTargetTime =
    zonedNow.hour > timeParts.hour ||
    (zonedNow.hour === timeParts.hour && zonedNow.minute > timeParts.minute) ||
    (zonedNow.hour === timeParts.hour &&
      zonedNow.minute === timeParts.minute &&
      zonedNow.second >= 0);

  if (isPastOrCurrentTargetTime) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 1);
  }

  const dateString = [
    targetDate.getUTCFullYear(),
    pad(targetDate.getUTCMonth() + 1),
    pad(targetDate.getUTCDate()),
  ].join("-");

  return buildTarget(dateString, DEFAULT_TIME, resolvedTimeZone, "");
}

function readTargetFromUrl() {
  const url = new URL(window.location.href);
  const directTarget = url.searchParams.get("target");
  const dateString = url.searchParams.get("date");
  const timeString = url.searchParams.get("time");
  const rawTimeZone = url.searchParams.get("zone") || url.searchParams.get("timezone");
  const timeZone = rawTimeZone ? normalizeTimeZone(rawTimeZone) : LEGACY_TIME_ZONE;
  const label = sanitizeLabel(url.searchParams.get("label"));

  if (rawTimeZone && !timeZone) {
    return null;
  }

  if (directTarget) {
    const [targetDateString, targetTimeString] = directTarget.split("T");
    return buildTarget(targetDateString, targetTimeString || DEFAULT_TIME, timeZone, label);
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
      parsed.timeZone || parsed.zone || LEGACY_TIME_ZONE,
      parsed.label,
    );
  } catch (error) {
    return null;
  }
}

function loadStoredTarget() {
  return loadStoredTargetFromKey(STORAGE_KEY) || loadStoredTargetFromKey(LEGACY_STORAGE_KEY);
}

function persistTarget(target) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
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

function setFeedback(message, isError = false) {
  if (feedbackTimer) {
    window.clearTimeout(feedbackTimer);
    feedbackTimer = null;
  }

  if (!message) {
    feedback.textContent = "";
    feedback.hidden = true;
    delete feedback.dataset.tone;
    return;
  }

  feedback.textContent = message;
  feedback.hidden = false;
  feedback.dataset.tone = isError ? "error" : "info";

  if (!isError) {
    feedbackTimer = window.setTimeout(() => {
      feedback.textContent = "";
      feedback.hidden = true;
      delete feedback.dataset.tone;
      feedbackTimer = null;
    }, 2600);
  }
}

function populateInputs(target) {
  targetLabelInput.value = target.label;
  dateInput.value = target.dateString;
  timeInput.value = target.timeString;
  timeZoneInput.value = target.timeZone;
}

function populateTimeZoneOptions() {
  const fragment = document.createDocumentFragment();

  for (const timeZone of getSupportedTimeZones()) {
    const option = document.createElement("option");
    option.value = timeZone;
    fragment.appendChild(option);
  }

  timeZoneOptions.replaceChildren(fragment);
}

function resetDisplay() {
  Object.values(valueNodes).forEach((node) => {
    node.textContent = "0";
  });
  statusText.textContent = "Counting down.";
  document.title = APP_TITLE;
}

function renderCountdown() {
  if (!activeTarget) {
    resetDisplay();
    return;
  }

  const difference = activeTarget.date.getTime() - Date.now();
  const clamped = Math.max(0, difference);
  const totalSeconds = Math.floor(clamped / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  valueNodes.days.textContent = String(days);
  valueNodes.hours.textContent = pad(hours);
  valueNodes.minutes.textContent = pad(minutes);
  valueNodes.seconds.textContent = pad(seconds);

  if (difference <= 0) {
    statusText.textContent = activeTarget.label
      ? `${activeTarget.label} is now.`
      : "It's now.";
    document.title = getDocumentTitle(activeTarget.label, 0, true);
    return;
  }

  statusText.textContent = "Counting down.";
  document.title = getDocumentTitle(activeTarget.label, days, false);
}

function renderTargetMeta(target) {
  targetZoneLabel.textContent = target.timeZone;
  targetLabelDisplay.textContent = getDisplayLabel(target.label);
  targetZoneLine.textContent = getDateTimeFormatter(target.timeZone).format(target.date);
  targetLocal.textContent =
    browserTimeZone && browserTimeZone !== target.timeZone
      ? `Your time (${browserTimeZone}): ${localFormatter.format(target.date)}`
      : "";
}

function startCountdown() {
  if (countdownInterval) {
    window.clearInterval(countdownInterval);
  }

  renderCountdown();
  countdownInterval = window.setInterval(renderCountdown, 1000);
}

function applyTarget(target) {
  if (!target) {
    setFeedback("That date, time, or timezone is not valid.", true);
    return false;
  }

  activeTarget = target;
  populateInputs(target);
  renderTargetMeta(target);
  persistTarget(target);
  updateUrl(target);
  startCountdown();
  setFeedback("");

  return true;
}

async function copyCurrentLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    setFeedback("Link copied.");
  } catch (error) {
    setFeedback("Copying the link is not available in this browser.", true);
  }
}

targetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const target = buildTarget(
    dateInput.value,
    timeInput.value,
    timeZoneInput.value,
    targetLabelInput.value,
  );
  if (applyTarget(target) && controls) {
    controls.open = false;
  }
});

copyLinkButton.addEventListener("click", () => {
  copyCurrentLink();
});

document.addEventListener("click", (event) => {
  if (controls?.open && !controls.contains(event.target)) {
    controls.open = false;
  }
});

function init() {
  populateTimeZoneOptions();
  targetLabelInput.value = "";
  timeZoneInput.value = defaultTimeZone;

  const targetFromUrl = readTargetFromUrl();
  const storedTarget = loadStoredTarget();
  const fallbackTarget = getNextDefaultTarget(defaultTimeZone);
  const initialTarget = targetFromUrl || storedTarget || fallbackTarget;

  if (!applyTarget(initialTarget)) {
    applyTarget(fallbackTarget);
  }
}

init();
