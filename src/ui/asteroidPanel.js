function initAsteroidPanel(entries, { onToggle } = {}) {
  const listElement = document.getElementById('asteroidList');
  const panelElement = document.getElementById('asteroidListPanel');
  const legendElement = document.getElementById('impactLegendOverlay');

  if (panelElement) {
    panelElement.dataset.component = 'asteroid-panel';
  }

  if (legendElement) {
    legendElement.dataset.component = 'impact-legend';
  }

  const itemMap = new Map();
  const activeIds = new Set();

  if (listElement) {
    listElement.innerHTML = '';

    entries.forEach(entry => {
      const { data } = entry;
      const orbit = data.orbit ?? {};
      const yieldText = Number.isFinite(data.tntYieldMt) ? data.tntYieldMt : 'N/A';
      const semiMajorAxisText = Number.isFinite(orbit.semiMajorAxis)
        ? orbit.semiMajorAxis.toFixed(1)
        : 'N/A';
      const eccentricityText = Number.isFinite(orbit.eccentricity)
        ? orbit.eccentricity.toFixed(3)
        : 'N/A';
      const inclinationText = Number.isFinite(orbit.inclination)
        ? orbit.inclination.toFixed(2)
        : 'N/A';
      const item = document.createElement('li');
      item.className = 'asteroid-panel__item';
      item.dataset.asteroidId = data.id;
      item.innerHTML =
        `<span class='asteroid-panel__name'>${data.name}</span>` +
        `<span class='asteroid-panel__meta'>Yield: ${yieldText} Mt | a=${semiMajorAxisText} | e=${eccentricityText} | i=${inclinationText}°</span>`;
      item.addEventListener('click', () => {
        const isActive = activeIds.has(data.id);
        const nextState = !isActive;
        if (typeof onToggle === 'function') {
          onToggle(data.id, nextState);
        }
      });

      listElement.appendChild(item);
      itemMap.set(data.id, item);
    });
  }

  let hoveredId = null;
  let focusedId = null;

  function setHovered(id) {
    if (hoveredId && itemMap.has(hoveredId)) {
      itemMap.get(hoveredId).classList.remove('asteroid-panel__item--hover');
    }

    hoveredId = id ?? null;

    if (hoveredId && itemMap.has(hoveredId)) {
      itemMap.get(hoveredId).classList.add('asteroid-panel__item--hover');
    }
  }

  function getItemElement(id) {
    return itemMap.get(id) ?? null;
  }

  function setTracked(id, isActive) {
    if (!itemMap.has(id)) {
      return;
    }

    const item = itemMap.get(id);

    if (isActive) {
      activeIds.add(id);
      item.classList.add('asteroid-panel__item--active');
    } else {
      activeIds.delete(id);
      item.classList.remove('asteroid-panel__item--active');
    }
  }

  function setFocused(id) {
    if (focusedId && itemMap.has(focusedId)) {
      itemMap.get(focusedId).classList.remove('asteroid-panel__item--focused');
    }

    focusedId = id ?? null;

    if (focusedId && itemMap.has(focusedId)) {
      itemMap.get(focusedId).classList.add('asteroid-panel__item--focused');
    }
  }

  function clearFocus() {
    setFocused(null);
  }

  return {
    listElement,
    setHovered,
    setTracked,
    setFocused,
    clearFocus,
    getItemElement
  };
}

export { initAsteroidPanel };
