const PLACEHOLDER_TEXT = 'Select a tracked asteroid to see telemetry.';

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function formatSpeed(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)} km/s` : '—';
}

function setTextContent(element, text) {
  if (!element) {
    return;
  }

  if (element.textContent !== text) {
    element.textContent = text;
  }
}

function initAsteroidInfoPanel() {
  const panelElement = document.getElementById('asteroidInfoPanel');

  if (!panelElement) {
    return null;
  }

  panelElement.dataset.component = 'asteroid-info-panel';

  const nameElement = panelElement.querySelector('[data-asteroid-name]');
  const placeholderElement = panelElement.querySelector('[data-asteroid-placeholder]');
  const sectionsElement = panelElement.querySelector('[data-asteroid-sections]');
  const sections = {
    velocity: {
      root: panelElement.querySelector('[data-section="velocity"]'),
      speed: panelElement.querySelector('[data-velocity-speed]'),
      components: {
        x: panelElement.querySelector('[data-velocity-x]'),
        y: panelElement.querySelector('[data-velocity-y]'),
        z: panelElement.querySelector('[data-velocity-z]')
      }
    }
  };

  let activeAsteroidId = null;

  function setPanelState(hasSelection) {
    panelElement.classList.toggle('asteroid-info--active', hasSelection);

    if (placeholderElement) {
      placeholderElement.hidden = hasSelection;
      if (!hasSelection) {
        setTextContent(placeholderElement, PLACEHOLDER_TEXT);
      }
    }

    if (sectionsElement) {
      sectionsElement.hidden = !hasSelection;
    }
  }

  function clearVelocitySection() {
    const velocitySection = sections.velocity;
    if (!velocitySection) {
      return;
    }

    setTextContent(velocitySection.speed, '—');
    setTextContent(velocitySection.components.x, '—');
    setTextContent(velocitySection.components.y, '—');
    setTextContent(velocitySection.components.z, '—');
  }

  function updateVelocitySection(velocity) {
    const velocitySection = sections.velocity;
    if (!velocitySection || !velocitySection.root) {
      return;
    }

    if (!velocity) {
      clearVelocitySection();
      return;
    }

    const { kilometersPerSecond, speedKilometersPerSecond } = velocity;
    setTextContent(velocitySection.speed, formatSpeed(speedKilometersPerSecond));

    const vector = kilometersPerSecond ?? {};
    setTextContent(velocitySection.components.x, formatNumber(vector.x));
    setTextContent(velocitySection.components.y, formatNumber(vector.y));
    setTextContent(velocitySection.components.z, formatNumber(vector.z));
  }

  function setActiveAsteroid(entry) {
    activeAsteroidId = entry?.data?.id ?? null;
    const hasSelection = Boolean(entry);

    setPanelState(hasSelection);

    const asteroidName = entry?.data?.name ?? entry?.data?.id ?? 'No asteroid selected';
    setTextContent(nameElement, asteroidName);

    updateVelocitySection(entry?.data?.velocity ?? null);
  }

  function clearActiveAsteroid() {
    setActiveAsteroid(null);
  }

  function update(entry) {
    if (!entry) {
      if (activeAsteroidId !== null) {
        clearActiveAsteroid();
      } else {
        updateVelocitySection(null);
      }
      return;
    }

    if (entry.data?.id !== activeAsteroidId) {
      setActiveAsteroid(entry);
      return;
    }

    updateVelocitySection(entry.data?.velocity ?? null);
  }

  clearActiveAsteroid();

  return {
    element: panelElement,
    setActiveAsteroid,
    clearActiveAsteroid,
    update
  };
}

export { initAsteroidInfoPanel };
