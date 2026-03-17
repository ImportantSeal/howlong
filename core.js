(() => {
  const app = (window.UntilApp = window.UntilApp || {});

  const constants = {
    LEGACY_TIME_ZONE: "Europe/Helsinki",
    DEFAULT_TIME: "00:00",
    STORAGE_KEY: "countdown-target",
    LEGACY_STORAGE_KEY: "helsinki-countdown-target",
    APP_TITLE: "Until",
    FALLBACK_LABEL: "How long until...?",
  };

  const dom = {
    targetForm: document.querySelector("#target-form"),
    targetLabelInput: document.querySelector("#target-label"),
    dateInput: document.querySelector("#target-date"),
    timeInput: document.querySelector("#target-time"),
    timeZoneInput: document.querySelector("#target-zone"),
    timeZoneOptions: document.querySelector("#time-zone-options"),
    copyLinkButton: document.querySelector("#copy-link-button"),
    controls: document.querySelector("#controls"),
    targetZoneLabel: document.querySelector("#target-zone-label"),
    targetLabelDisplay: document.querySelector("#target-label-display"),
    targetZoneLine: document.querySelector("#target-zoned"),
    targetLocal: document.querySelector("#target-local"),
    statusText: document.querySelector("#status-text"),
    feedback: document.querySelector("#feedback"),
    valueNodes: {
      days: document.querySelector("#days"),
      hours: document.querySelector("#hours"),
      minutes: document.querySelector("#minutes"),
      seconds: document.querySelector("#seconds"),
    },
  };

  const formatters = {
    localFormatter: new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }),
    dateTimeFormatterCache: new Map(),
    zonePartFormatterCache: new Map(),
  };

  const state = {
    activeTarget: null,
    countdownInterval: null,
    feedbackTimer: null,
    browserTimeZone: null,
    defaultTimeZone: null,
  };

  function setStatusText(message = "") {
    dom.statusText.textContent = message;
    dom.statusText.hidden = !message;
  }

  function sanitizeLabel(label) {
    return String(label || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 60);
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function getDisplayLabel(label) {
    return sanitizeLabel(label) || constants.FALLBACK_LABEL;
  }

  function getDocumentTitle(label, daysRemaining, hasArrived) {
    const safeLabel = sanitizeLabel(label);

    if (hasArrived) {
      return safeLabel
        ? `${safeLabel} | ${constants.APP_TITLE}`
        : constants.APP_TITLE;
    }

    const prefix = `${daysRemaining}d left`;
    return safeLabel
      ? `${prefix} | ${safeLabel} | ${constants.APP_TITLE}`
      : `${prefix} | ${constants.APP_TITLE}`;
  }

  app.constants = constants;
  app.dom = dom;
  app.formatters = formatters;
  app.state = state;
  app.helpers = {
    setStatusText,
    sanitizeLabel,
    pad,
    getDisplayLabel,
    getDocumentTitle,
  };
})();
