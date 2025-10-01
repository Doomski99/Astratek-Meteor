function initAsteroidPanel(entries, { onSelect } = {}) {
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

  if (listElement) {
    listElement.innerHTML = '';

    entries.forEach(entry => {
      const { data } = entry;
      const item = document.createElement('li');
      item.className = 'asteroid-panel__item';
      item.dataset.asteroidId = data.id;
      item.innerHTML =
        `<span class='asteroid-panel__name'>${data.name}</span>` +
        `<span class='asteroid-panel__meta'>Yield: ${data.tntYieldMt} Mt | a=${data.orbit.semiMajorAxis} | e=${data.orbit.eccentricity} | i=${data.orbit.inclination}°</span>`;

      item.addEventListener('click', () => {
        if (typeof onSelect === 'function') {
          onSelect(data.id);
        }
      });

      listElement.appendChild(item);
      itemMap.set(data.id, item);
    });
  }

  let hoveredId = null;
  let selectedId = null;

  function setHovered(id) {
    if (hoveredId && itemMap.has(hoveredId)) {
      itemMap.get(hoveredId).classList.remove('asteroid-panel__item--hover');
    }

    hoveredId = id ?? null;

    if (hoveredId && itemMap.has(hoveredId)) {
      itemMap.get(hoveredId).classList.add('asteroid-panel__item--hover');
    }
  }

  function setSelected(id) {
    if (selectedId && itemMap.has(selectedId)) {
      itemMap.get(selectedId).classList.remove('asteroid-panel__item--active');
    }

    selectedId = id ?? null;

    if (selectedId && itemMap.has(selectedId)) {
      itemMap.get(selectedId).classList.add('asteroid-panel__item--active');
    }
  }

  function clearSelection() {
    setSelected(null);
  }

  function getItemElement(id) {
    return itemMap.get(id) ?? null;
  }

  return {
    listElement,
    setHovered,
    setSelected,
    clearSelection,
    getItemElement
  };
}

export { initAsteroidPanel };
