const STYLE_ID = 'impact-time-widget-style';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .impact-time-widget {
      position: fixed;
      left: 50%;
      bottom: 72px;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 16px;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.6);
      color: #f8f9fa;
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      z-index: 11;
      backdrop-filter: blur(8px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
    }

    .impact-time-widget[hidden] {
      display: none !important;
    }

    .impact-time-widget__label {
      font-size: 0.8rem;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .impact-time-widget__button {
      appearance: none;
      border: none;
      background: #ff6b6b;
      color: #fff;
      font-weight: 600;
      padding: 5px 12px;
      border-radius: 999px;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .impact-time-widget__button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .impact-time-widget__button:hover:not(:disabled) {
      background: #fa5252;
    }

    .impact-time-widget__button:focus-visible {
      outline: 2px solid #ffd166;
      outline-offset: 2px;
    }
  `;

  document.head.appendChild(style);
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) {
    parts.push(String(hours).padStart(2, '0'));
  }
  parts.push(String(minutes).padStart(2, '0'));
  parts.push(String(seconds).padStart(2, '0'));

  return parts.join(':');
}

function normalizeName(name) {
  if (typeof name !== 'string') {
    return null;
  }
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function createImpactTimeWidget({
  clock,
  orbitTimeChannel = null,
  container = document.body,
  anchorElement = null
} = {}) {
  if (!clock) {
    throw new Error('Simulation clock instance is required for impact time widget.');
  }

  ensureStyles();

  const root = document.createElement('div');
  root.className = 'impact-time-widget';
  root.hidden = true;

  const label = document.createElement('span');
  label.className = 'impact-time-widget__label';
  label.textContent = 'Impact time unavailable';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'impact-time-widget__button';
  button.textContent = 'Jump to Impact';
  button.disabled = true;

  root.appendChild(label);
  root.appendChild(button);

  if (anchorElement?.parentElement) {
    anchorElement.parentElement.insertBefore(root, anchorElement);
  } else if (container) {
    container.appendChild(root);
  }

  let impactTimestampMs = null;
  let impactOrbitFrames = null;
  let asteroidName = null;

  function deriveTimestampMs() {
    const hasOrbitFrames = Number.isFinite(impactOrbitFrames);

    if (hasOrbitFrames && orbitTimeChannel && typeof orbitTimeChannel.getMultiplier === 'function') {
      const multiplier = orbitTimeChannel.getMultiplier();
      if (Number.isFinite(multiplier) && multiplier > 0) {
        return impactOrbitFrames / multiplier;
      }
    }

    return Number.isFinite(impactTimestampMs) ? impactTimestampMs : null;
  }

  function updateView() {
    const derivedTimestamp = deriveTimestampMs();

    if (!Number.isFinite(derivedTimestamp)) {
      label.textContent = 'Impact time unavailable';
      button.disabled = true;
      root.hidden = true;
      return;
    }

    const formattedTime = formatTime(derivedTimestamp);
    const nameText = normalizeName(asteroidName);
    label.textContent = nameText ? `${nameText} impact at ${formattedTime}` : `Impact at ${formattedTime}`;
    button.disabled = false;
    root.hidden = false;
  }

  button.addEventListener('click', () => {
    const targetTimestamp = deriveTimestampMs();
    if (!Number.isFinite(targetTimestamp)) {
      return;
    }
    clock.setTime(targetTimestamp);
    clock.setPaused(false);
  });

  return {
    element: root,
    setImpactTime({ timestampMs, orbitFrames, asteroidName: name } = {}) {
      impactTimestampMs = Number.isFinite(timestampMs) ? timestampMs : null;
      impactOrbitFrames = Number.isFinite(orbitFrames) ? orbitFrames : null;
      asteroidName = normalizeName(name);
      updateView();
    },
    clear() {
      impactTimestampMs = null;
      impactOrbitFrames = null;
      asteroidName = null;
      label.textContent = 'Impact time unavailable';
      button.disabled = true;
      root.hidden = true;
    },
    destroy() {
      root.remove();
    }
  };
}

export { createImpactTimeWidget };
