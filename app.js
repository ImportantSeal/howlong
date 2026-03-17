(() => {
  const app = window.UntilApp;
  const { constants, dom, formatters, state } = app;
  const {
    setStatusText,
    pad,
    getDisplayLabel,
    getDocumentTitle,
  } = app.helpers;
  const { getDateTimeFormatter, getSupportedTimeZones } = app.time;
  const {
    buildTarget,
    getNextDefaultTarget,
    readTargetFromUrl,
    loadStoredTarget,
    persistTarget,
    updateUrl,
  } = app.target;

  function setFeedback(message, isError = false) {
    if (state.feedbackTimer) {
      window.clearTimeout(state.feedbackTimer);
      state.feedbackTimer = null;
    }

    if (!message) {
      dom.feedback.textContent = "";
      dom.feedback.hidden = true;
      delete dom.feedback.dataset.tone;
      return;
    }

    dom.feedback.textContent = message;
    dom.feedback.hidden = false;
    dom.feedback.dataset.tone = isError ? "error" : "info";

    if (!isError) {
      state.feedbackTimer = window.setTimeout(() => {
        dom.feedback.textContent = "";
        dom.feedback.hidden = true;
        delete dom.feedback.dataset.tone;
        state.feedbackTimer = null;
      }, 2600);
    }
  }

  function populateInputs(target) {
    dom.targetLabelInput.value = target.label;
    dom.dateInput.value = target.dateString;
    dom.timeInput.value = target.timeString;
    dom.timeZoneInput.value = target.timeZone;
  }

  function populateTimeZoneOptions() {
    const fragment = document.createDocumentFragment();

    for (const timeZone of getSupportedTimeZones()) {
      const option = document.createElement("option");
      option.value = timeZone;
      fragment.appendChild(option);
    }

    dom.timeZoneOptions.replaceChildren(fragment);
  }

  function resetDisplay() {
    Object.values(dom.valueNodes).forEach((node) => {
      node.textContent = "0";
    });
    setStatusText("");
    document.title = constants.APP_TITLE;
  }

  function renderCountdown() {
    if (!state.activeTarget) {
      resetDisplay();
      return;
    }

    const difference = state.activeTarget.date.getTime() - Date.now();
    const clamped = Math.max(0, difference);
    const totalSeconds = Math.floor(clamped / 1000);

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    dom.valueNodes.days.textContent = String(days);
    dom.valueNodes.hours.textContent = pad(hours);
    dom.valueNodes.minutes.textContent = pad(minutes);
    dom.valueNodes.seconds.textContent = pad(seconds);

    if (difference <= 0) {
      setStatusText(state.activeTarget.label
        ? `${state.activeTarget.label} is now.`
        : "It's now.");
      document.title = getDocumentTitle(state.activeTarget.label, 0, true);
      return;
    }

    setStatusText("");
    document.title = getDocumentTitle(state.activeTarget.label, days, false);
  }

  function renderTargetMeta(target) {
    dom.targetZoneLabel.textContent = target.timeZone;
    dom.targetLabelDisplay.textContent = getDisplayLabel(target.label);
    dom.targetZoneLine.textContent = getDateTimeFormatter(target.timeZone)
      .format(target.date);
    dom.targetLocal.textContent =
      state.browserTimeZone && state.browserTimeZone !== target.timeZone
        ? `Your time (${state.browserTimeZone}): ${formatters.localFormatter.format(target.date)}`
        : "";
  }

  function startCountdown() {
    if (state.countdownInterval) {
      window.clearInterval(state.countdownInterval);
    }

    renderCountdown();
    state.countdownInterval = window.setInterval(renderCountdown, 1000);
  }

  function applyTarget(target) {
    if (!target) {
      setFeedback("That date, time, or timezone is not valid.", true);
      return false;
    }

    state.activeTarget = target;
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

  function bindEvents() {
    dom.targetForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const target = buildTarget(
        dom.dateInput.value,
        dom.timeInput.value,
        dom.timeZoneInput.value,
        dom.targetLabelInput.value,
      );

      if (applyTarget(target) && dom.controls) {
        dom.controls.open = false;
      }
    });

    dom.copyLinkButton.addEventListener("click", () => {
      copyCurrentLink();
    });

    document.addEventListener("click", (event) => {
      if (dom.controls?.open && !dom.controls.contains(event.target)) {
        dom.controls.open = false;
      }
    });
  }

  function init() {
    populateTimeZoneOptions();
    dom.targetLabelInput.value = "";
    dom.timeZoneInput.value = state.defaultTimeZone;

    const targetFromUrl = readTargetFromUrl();
    const storedTarget = loadStoredTarget();
    const fallbackTarget = getNextDefaultTarget(state.defaultTimeZone);
    const initialTarget = targetFromUrl || storedTarget || fallbackTarget;

    if (!applyTarget(initialTarget)) {
      applyTarget(fallbackTarget);
    }
  }

  bindEvents();
  init();
})();
