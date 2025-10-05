function createBadge({ label, value, probability, positiveLabel, negativeLabel, tonePositive, toneNegative }) {
  const badge = document.createElement('span');
  badge.className = 'asteroid-badge';

  let toneClass = 'asteroid-badge--unknown';
  let valueLabel = 'Unknown';

  if (value === true) {
    toneClass = tonePositive ?? 'asteroid-badge--positive';
    valueLabel = positiveLabel ?? 'Yes';
  } else if (value === false) {
    toneClass = toneNegative ?? 'asteroid-badge--neutral';
    valueLabel = negativeLabel ?? 'No';
  }

  if (toneClass) {
    badge.classList.add(toneClass);
  }

  let probabilityText = '';
  if (Number.isFinite(probability)) {
    const percent = probability * 100;
    if (percent > 0 && percent < 0.01) {
      probabilityText = ' (<0.01%)';
    } else if (percent < 100 && percent > 99.99) {
      probabilityText = ' (>99.99%)';
    } else {
      const decimals = percent >= 10 || percent <= 0 ? 1 : 2;
      probabilityText = ` (${percent.toFixed(decimals)}%)`;
    }
  }

  badge.textContent = `${label} · ${valueLabel}${probabilityText}`;
  return badge;
}

function renderClassification(container, data = {}) {
  if (!container) {
    return;
  }

  container.innerHTML = '';

  const neoBadge = createBadge({
    label: 'NEO',
    value: data.isNeo,
    probability: data.neoProbability,
    positiveLabel: 'Yes',
    negativeLabel: 'No',
    tonePositive: 'asteroid-badge--positive',
    toneNegative: 'asteroid-badge--neutral'
  });

  const phaBadge = createBadge({
    label: 'PHA',
    value: data.isPhaHazardous,
    probability: data.phaProbability,
    positiveLabel: 'Hazard',
    negativeLabel: 'Safe',
    tonePositive: 'asteroid-badge--hazard',
    toneNegative: 'asteroid-badge--neutral'
  });

  container.appendChild(neoBadge);
  container.appendChild(phaBadge);
}

function setMetaText(metaElement, data) {
  if (!metaElement) {
    return;
  }

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

  metaElement.textContent = `Yield: ${yieldText} Mt | a=${semiMajorAxisText} | e=${eccentricityText} | i=${inclinationText}°`;
}

function createListItem(entry, { onToggle }) {
  const { data } = entry;
  const item = document.createElement('li');
  item.className = 'asteroid-panel__item';
  item.dataset.asteroidId = data.id;

  const headerRow = document.createElement('div');
  headerRow.className = 'asteroid-panel__row';

  const nameElement = document.createElement('span');
  nameElement.className = 'asteroid-panel__name';
  nameElement.textContent = data.name;

  const badgesContainer = document.createElement('div');
  badgesContainer.className = 'asteroid-panel__badges';

  headerRow.appendChild(nameElement);
  headerRow.appendChild(badgesContainer);

  const metaElement = document.createElement('span');
  metaElement.className = 'asteroid-panel__meta';

  item.appendChild(headerRow);
  item.appendChild(metaElement);

  item.addEventListener('click', () => {
    const isActive = item.classList.contains('asteroid-panel__item--active');
    const nextState = !isActive;
    if (typeof onToggle === 'function') {
      onToggle(data.id, nextState);
    }
  });

  setMetaText(metaElement, data);
  renderClassification(badgesContainer, data);

  return item;
}

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
      const item = createListItem(entry, { onToggle });
      listElement.appendChild(item);
      itemMap.set(entry.data.id, item);
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
    getItemElement,
    addEntry(entry) {
      if (!listElement || !entry?.data?.id) {
        return;
      }

      const item = createListItem(entry, { onToggle });
      listElement.appendChild(item);
      itemMap.set(entry.data.id, item);
    },
    refreshEntry(entry) {
      const item = entry?.data?.id ? itemMap.get(entry.data.id) : null;
      if (!item) {
        return;
      }

      const badgesContainer = item.querySelector('.asteroid-panel__badges');
      const metaElement = item.querySelector('.asteroid-panel__meta');
      const nameElement = item.querySelector('.asteroid-panel__name');

      if (nameElement) {
        nameElement.textContent = entry.data.name ?? entry.data.id;
      }

      setMetaText(metaElement, entry.data);
      renderClassification(badgesContainer, entry.data);
    }
  };
}

export { initAsteroidPanel };
