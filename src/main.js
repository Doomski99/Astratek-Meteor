import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import bgTexture1 from '/images/1.jpg';
import bgTexture2 from '/images/2.jpg';
import bgTexture3 from '/images/3.jpg';
import bgTexture4 from '/images/4.jpg';
import sunTexture from '/images/sun.jpg';
import mercuryTexture from '/images/mercurymap.jpg';
import mercuryBump from '/images/mercurybump.jpg';
import venusTexture from '/images/venusmap.jpg';
import venusBump from '/images/venusmap.jpg';
import venusAtmosphere from '/images/venus_atmosphere.jpg';
import earthTexture from '/images/earth_daymap.jpg';
import earthNightTexture from '/images/earth_nightmap.jpg';
import earthAtmosphere from '/images/earth_atmosphere.jpg';
import earthMoonTexture from '/images/moonmap.jpg';
import earthMoonBump from '/images/moonbump.jpg';
import marsTexture from '/images/marsmap.jpg';
import marsBump from '/images/marsbump.jpg';
import jupiterTexture from '/images/jupiter.jpg';
import ioTexture from '/images/jupiterIo.jpg';
import europaTexture from '/images/jupiterEuropa.jpg';
import ganymedeTexture from '/images/jupiterGanymede.jpg';
import callistoTexture from '/images/jupiterCallisto.jpg';
import saturnTexture from '/images/saturnmap.jpg';
import satRingTexture from '/images/saturn_ring.png';
import uranusTexture from '/images/uranus.jpg';
import uraRingTexture from '/images/uranus_ring.png';
import neptuneTexture from '/images/neptune.jpg';
import plutoTexture from '/images/plutomap.jpg';

import { scene, camera, renderer, controls, composer, outlinePass } from './core/scene.js';
import { createSimulationClock } from './core/time.js';
import {
  createPlanetFactory,
  planetData,
  createAsteroidEntries,
  loadAsteroidCatalog,
  planetOrbitCatalog
} from './data/bodies.js';
import { initAsteroidPanel } from './ui/asteroidPanel.js';
import { initAsteroidInfoPanel } from './ui/asteroidInfoPanel.js';
import { initTimeControls } from './ui/timeControls.js';
import {
  createAsteroidMeshManager,
  updateAsteroidTransform,
  getAsteroidMeshes,
  findAsteroidEntryFromObject,
  getTrajectoryPoints,
  createTrajectoryLine,
  createImpactOverlayMesh,
  disposeObject
} from './simulation/asteroids.js';
import { propagateKepler } from './simulation/kepler.js';
import { orbitPositionToScene, estimateOrbitalVelocity } from './simulation/orbitUtils.js';
import { updateEarthVelocity } from './simulation/referenceFrames.js';
import { EARTH_RADIUS_SCENE_UNITS } from './simulation/scales.js';
import { createImpactorManager } from './simulation/impactorManager.js';

const cubeTextureLoader = new THREE.CubeTextureLoader();
const textureLoader = new THREE.TextureLoader();

const FRAMES_PER_SECOND = 60;
const FRAMES_PER_MILLISECOND = FRAMES_PER_SECOND / 1000;
const DEFAULT_SIMULATION_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

scene.background = cubeTextureLoader.load([
  bgTexture3,
  bgTexture1,
  bgTexture2,
  bgTexture2,
  bgTexture4,
  bgTexture2
]);

const settings = {
  accelerationOrbit: 1,
  acceleration: 1,
  sunIntensity: 1.9
};

const simulationClock = createSimulationClock({ duration: DEFAULT_SIMULATION_DURATION });
const orbitTimeChannel = simulationClock.createChannel(settings.accelerationOrbit * FRAMES_PER_MILLISECOND);
const spinTimeChannel = simulationClock.createChannel(settings.acceleration * FRAMES_PER_MILLISECOND);


initTimeControls(simulationClock);

const impactLegendElement = document.getElementById('impactLegendOverlay');
if (impactLegendElement) {
  impactLegendElement.hidden = true;
}

const forceCollisionButton = document.getElementById('forceCollisionButton');
if (forceCollisionButton) {
  forceCollisionButton.hidden = true;
}

const impactorForm = document.getElementById('impactorForm');
const impactorNameInput = document.getElementById('impactorName');
const impactorTypeInput = document.getElementById('impactorType');
const impactorDiameterInput = document.getElementById('impactorDiameter');
const impactorSubmitButton = impactorForm?.querySelector('button[type="submit"]') ?? null;
const impactorResetButton = document.getElementById('impactorResetButton');
const impactorFeedbackElement = document.querySelector('[data-impactor-feedback]');
const impactorResultsElement = document.querySelector('[data-impactor-results]');
const impactorYieldValue = document.querySelector('[data-impactor-yield]');
const impactorCategoryValue = document.querySelector('[data-impactor-category]');
const impactorImpactLocationValue = document.querySelector('[data-impactor-impact-location]');
const impactorTimeValue = document.querySelector('[data-impactor-time]');
const impactorEffectsList = document.querySelector('[data-impactor-effects]');
const impactMapPanel = document.getElementById('impactMapPanel');
const impactMapCanvas = document.getElementById('impactMapCanvas');
const impactMapContext = impactMapCanvas?.getContext('2d') ?? null;
const impactMapStatusElement = document.querySelector('[data-impact-map-status]');
const impactMapCaptionElement = document.querySelector('[data-impact-map-caption]');
const impactMapStatusBaseText = impactMapStatusElement?.textContent ?? 'Awaiting impactor launch…';
const impactMapCaptionBaseText = impactMapCaptionElement?.textContent ?? '';

const ASTEROID_TYPES = {
  M: {
    densityKgPerM3: 7500,
    couplingEfficiency: 0.8,
    nominalVelocityKmPerSecond: 22
  },
  S: {
    densityKgPerM3: 3000,
    couplingEfficiency: 0.45,
    nominalVelocityKmPerSecond: 18
  },
  C: {
    densityKgPerM3: 2000,
    couplingEfficiency: 0.2,
    nominalVelocityKmPerSecond: 15
  }
};

const impactMapImage = new Image();
impactMapImage.crossOrigin = 'anonymous';
impactMapImage.src = earthTexture;
let impactMapImageReady = impactMapImage.complete && impactMapImage.naturalWidth > 0;
let pendingImpactMapDraw = null;

impactMapImage.onload = () => {
  impactMapImageReady = true;
  if (typeof pendingImpactMapDraw === 'function') {
    const callback = pendingImpactMapDraw;
    pendingImpactMapDraw = null;
    callback();
  }
};

let impactMapSummary = null;
let lastImpactMapImpacted = null;
let lastImpactMapSecond = null;

function hexToRgba(hex, alpha = 1) {
  const value = Number.isFinite(hex) ? hex : 0xffffff;
  const clampedAlpha = Math.min(Math.max(alpha, 0), 1);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
}

function normalizeLongitude(longitude) {
  const raw = Number.isFinite(longitude) ? longitude : 0;
  return ((raw + 540) % 360) - 180;
}

function showImpactMapPanel() {
  if (impactMapPanel) {
    impactMapPanel.hidden = false;
  }
}

function hideImpactMapPanel() {
  if (impactMapPanel) {
    impactMapPanel.hidden = true;
  }
  if (impactMapCanvas && impactMapContext) {
    impactMapContext.clearRect(0, 0, impactMapCanvas.width, impactMapCanvas.height);
    impactMapContext.fillStyle = 'rgba(3, 6, 24, 0.92)';
    impactMapContext.fillRect(0, 0, impactMapCanvas.width, impactMapCanvas.height);
  }
  if (impactMapStatusElement) {
    impactMapStatusElement.textContent = impactMapStatusBaseText;
  }
  if (impactMapCaptionElement) {
    impactMapCaptionElement.textContent = impactMapCaptionBaseText;
  }
  pendingImpactMapDraw = null;
  impactMapSummary = null;
  lastImpactMapImpacted = null;
  lastImpactMapSecond = null;
}

function updateImpactMapStatusText({
  name,
  latitude,
  longitude,
  remainingSeconds,
  impacted,
  impactCategory
} = {}) {
  if (!impactMapStatusElement) {
    return;
  }

  if (!name) {
    impactMapStatusElement.textContent = impactMapStatusBaseText;
    return;
  }

  const locationText = `${formatLatitude(latitude)}, ${formatLongitude(longitude)}`;
  const timeText = impacted
    ? 'Impact occurred'
    : Number.isFinite(remainingSeconds)
      ? `Impact in ${formatDuration(Math.max(remainingSeconds, 0))}`
      : 'Impact pending';
  const categoryText = impactCategory?.name
    ? ` (${impactCategory.name}${impactCategory.rangeLabel ? ` • ${impactCategory.rangeLabel}` : ''})`
    : '';

  impactMapStatusElement.textContent = `${name}${categoryText} — ${locationText} — ${timeText}`;
}

function renderImpactMap(summary, { impacted = false } = {}) {
  if (!impactMapCanvas || !impactMapContext || !summary) {
    return;
  }

  const { width, height } = impactMapCanvas;
  impactMapContext.clearRect(0, 0, width, height);

  if (impactMapImageReady) {
    impactMapContext.drawImage(impactMapImage, 0, 0, width, height);
    impactMapContext.fillStyle = 'rgba(2, 4, 18, 0.45)';
    impactMapContext.fillRect(0, 0, width, height);
  } else {
    impactMapContext.fillStyle = 'rgba(3, 6, 24, 0.92)';
    impactMapContext.fillRect(0, 0, width, height);
    pendingImpactMapDraw = () => renderImpactMap(summary, { impacted });
  }

  const safeLatitude = Math.max(Math.min(summary.latitude ?? 0, 89.999), -89.999);
  const safeLongitude = normalizeLongitude(summary.longitude);
  const latRad = THREE.MathUtils.degToRad(safeLatitude);
  const centerX = ((safeLongitude + 180) / 360) * width;
  const centerY = ((90 - safeLatitude) / 180) * height;

  const bands = Array.isArray(summary.effectBands)
    ? [...summary.effectBands].sort((a, b) => (b.radiusKm ?? 0) - (a.radiusKm ?? 0))
    : [];

  bands.forEach(band => {
    const angularRadius = band.displayAngularRadiusRad ?? band.angularRadiusRad ?? 0;
    if (!Number.isFinite(angularRadius) || angularRadius <= 0) {
      return;
    }

    const radiusLatDeg = THREE.MathUtils.radToDeg(angularRadius);
    const lonScale = Math.max(Math.cos(latRad), 0.25);
    const radiusLonDeg = radiusLatDeg / lonScale;
    const radiusX = Math.max((Math.abs(radiusLonDeg) / 360) * width, 6);
    const radiusY = Math.max((Math.abs(radiusLatDeg) / 180) * height, 6);

    const positions = [centerX];
    if (centerX - radiusX < 0) {
      positions.push(centerX + width);
    }
    if (centerX + radiusX > width) {
      positions.push(centerX - width);
    }

    positions.forEach(xPosition => {
      impactMapContext.beginPath();
      impactMapContext.ellipse(xPosition, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      impactMapContext.fillStyle = hexToRgba(band.fillColor ?? band.color ?? 0xff7043, band.opacity ?? 0.35);
      impactMapContext.fill();
      impactMapContext.lineWidth = 2;
      impactMapContext.strokeStyle = hexToRgba(
        band.outlineColor ?? band.fillColor ?? 0xffc199,
        Math.min((band.opacity ?? 0.35) + 0.25, 0.95)
      );
      impactMapContext.stroke();
    });
  });

  const markerPositions = [centerX];
  if (centerX < 12) {
    markerPositions.push(centerX + width);
  }
  if (centerX > width - 12) {
    markerPositions.push(centerX - width);
  }

  markerPositions.forEach(xPosition => {
    impactMapContext.beginPath();
    impactMapContext.arc(xPosition, centerY, impacted ? 6 : 4, 0, Math.PI * 2);
    impactMapContext.fillStyle = impacted ? 'rgba(255, 112, 67, 0.9)' : 'rgba(216, 229, 255, 0.95)';
    impactMapContext.fill();
    impactMapContext.lineWidth = 2;
    impactMapContext.strokeStyle = impacted ? 'rgba(255, 170, 120, 0.95)' : 'rgba(90, 205, 255, 0.85)';
    impactMapContext.stroke();

    impactMapContext.beginPath();
    impactMapContext.moveTo(xPosition - 10, centerY);
    impactMapContext.lineTo(xPosition + 10, centerY);
    impactMapContext.moveTo(xPosition, centerY - 10);
    impactMapContext.lineTo(xPosition, centerY + 10);
    impactMapContext.lineWidth = 1.2;
    impactMapContext.strokeStyle = 'rgba(240, 248, 255, 0.55)';
    impactMapContext.stroke();
  });

  if (impactMapCaptionElement) {
    const locationText = `${formatLatitude(summary.latitude)}, ${formatLongitude(summary.longitude)}`;
    const categoryLabel = summary.impactCategory?.name
      ? ` (${summary.impactCategory.name}${summary.impactCategory.rangeLabel ? ` • ${summary.impactCategory.rangeLabel}` : ''})`
      : '';
    impactMapCaptionElement.textContent = `${impactMapCaptionBaseText} Focused near ${locationText}${categoryLabel}.`;
  }
}

function setImpactMapSummary(summary) {
  if (!summary) {
    hideImpactMapPanel();
    return;
  }

  impactMapSummary = {
    ...summary,
    effectBands: Array.isArray(summary.effectBands)
      ? summary.effectBands.map(band => ({ ...band }))
      : []
  };
  lastImpactMapImpacted = false;
  lastImpactMapSecond = Number.isFinite(summary.timeToImpactSeconds)
    ? Math.floor(summary.timeToImpactSeconds)
    : null;

  showImpactMapPanel();
  renderImpactMap(impactMapSummary, { impacted: false });
  updateImpactMapStatusText({
    ...impactMapSummary,
    remainingSeconds: summary.timeToImpactSeconds,
    impacted: false
  });
}

function updateImpactMapFromSnapshot(snapshot) {
  if (!impactMapSummary || !snapshot) {
    return;
  }

  const wholeSeconds = Number.isFinite(snapshot.remainingSeconds)
    ? Math.max(0, Math.floor(snapshot.remainingSeconds))
    : null;

  const impactedChanged = snapshot.impacted !== lastImpactMapImpacted;
  if (impactedChanged) {
    lastImpactMapImpacted = snapshot.impacted;
    renderImpactMap(impactMapSummary, { impacted: snapshot.impacted });
  }

  impactMapSummary.timeToImpactSeconds = snapshot.remainingSeconds;

  if (impactedChanged || wholeSeconds !== lastImpactMapSecond) {
    lastImpactMapSecond = wholeSeconds;
    updateImpactMapStatusText({
      ...impactMapSummary,
      remainingSeconds: snapshot.remainingSeconds,
      impacted: snapshot.impacted
    });
  }
}

function formatLatitude(latitude) {
  if (!Number.isFinite(latitude)) {
    return '—';
  }

  const hemisphere = latitude >= 0 ? 'N' : 'S';
  return `${Math.abs(latitude).toFixed(1)}° ${hemisphere}`;
}

function formatLongitude(longitude) {
  if (!Number.isFinite(longitude)) {
    return '—';
  }

  const hemisphere = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(longitude).toFixed(1)}° ${hemisphere}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) {
    return '—';
  }

  const clamped = Math.max(seconds, 0);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);

  const segments = [];
  if (hours > 0) {
    segments.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0) {
    segments.push(`${minutes}m`);
  }
  segments.push(`${secs}s`);
  return segments.join(' ');
}

function setImpactorFeedback(message, variant = 'info') {
  if (!impactorFeedbackElement) {
    return;
  }

  if (!message) {
    impactorFeedbackElement.textContent = '';
    impactorFeedbackElement.dataset.variant = '';
    impactorFeedbackElement.hidden = true;
    return;
  }

  impactorFeedbackElement.textContent = message;
  impactorFeedbackElement.dataset.variant = variant;
  impactorFeedbackElement.hidden = false;
}

function clearImpactorResults() {
  if (impactorResultsElement) {
    impactorResultsElement.hidden = true;
  }
  if (impactorYieldValue) {
    impactorYieldValue.textContent = '—';
  }
  if (impactorCategoryValue) {
    impactorCategoryValue.textContent = '—';
    impactorCategoryValue.title = '';
    delete impactorCategoryValue.dataset.tooltip;
    impactorCategoryValue.classList.remove('impactor-results__value--has-tooltip');
    impactorCategoryValue.removeAttribute('tabindex');
    impactorCategoryValue.removeAttribute('role');
    impactorCategoryValue.removeAttribute('aria-label');
  }
  if (impactorImpactLocationValue) {
    impactorImpactLocationValue.textContent = '—';
  }
  if (impactorTimeValue) {
    impactorTimeValue.textContent = '—';
  }
  if (impactorEffectsList) {
    impactorEffectsList.innerHTML = '';
  }
  hideImpactMapPanel();
}

function renderImpactorEffects(bands) {
  if (!impactorEffectsList) {
    return;
  }

  impactorEffectsList.innerHTML = '';

  bands.forEach(band => {
    if (!band || !Number.isFinite(band.radiusKm)) {
      return;
    }

    const item = document.createElement('li');
    item.className = 'impactor-effects__item';

    const swatch = document.createElement('span');
    swatch.className = 'impactor-effects__swatch';
    const swatchColor = band.fillColor ?? band.color ?? 0xffffff;
    swatch.style.backgroundColor = `#${swatchColor.toString(16).padStart(6, '0')}`;

    const label = document.createElement('span');
    label.className = 'impactor-effects__label';
    label.textContent = band.label ?? 'Effect';

    if (band.description) {
      label.dataset.tooltip = band.description;
      label.classList.add('impactor-effects__label--has-tooltip');
      label.setAttribute('tabindex', '0');
      label.setAttribute('role', 'button');
      label.setAttribute(
        'aria-label',
        `${band.label ?? 'Effect'} — ${band.description}`
      );
    }

    if (band.severity) {
      const severity = document.createElement('span');
      severity.className = `impactor-effects__severity impactor-effects__severity--${band.severity}`;
      severity.textContent = band.severity;
      label.appendChild(severity);
    }

    const value = document.createElement('span');
    value.className = 'impactor-effects__value';
    if (band.categoryName && band.categoryRangeLabel) {
      value.textContent = `${band.categoryName} • ${band.categoryRangeLabel}`;
    } else if (band.categoryName) {
      value.textContent = band.categoryName;
    } else if (band.categoryRangeLabel) {
      value.textContent = band.categoryRangeLabel;
    } else {
      value.textContent = '—';
    }

    if (band.categoryDescription) {
      value.dataset.tooltip = band.categoryDescription;
      value.classList.add('impactor-effects__value--has-tooltip');
      value.setAttribute('tabindex', '0');
      value.setAttribute('role', 'note');
      value.setAttribute(
        'aria-label',
        `${band.categoryName ?? 'Impact category'} — ${band.categoryDescription}`
      );
    }

    item.appendChild(swatch);
    item.appendChild(label);
    item.appendChild(value);
    impactorEffectsList.appendChild(item);
  });
}

function updateImpactorResults(summary) {
  if (!summary) {
    clearImpactorResults();
    return;
  }

  if (impactorResultsElement) {
    impactorResultsElement.hidden = false;
  }
  if (impactorYieldValue) {
    const yieldText = Number.isFinite(summary.yieldMegatons)
      ? `${summary.yieldMegatons.toFixed(2)} Mt`
      : '—';
    impactorYieldValue.textContent = yieldText;
  }
  if (impactorCategoryValue) {
    const category = summary.impactCategory ?? null;
    if (category?.name) {
      const labelParts = [category.name];
      if (category.rangeLabel) {
        labelParts.push(category.rangeLabel);
      }
      impactorCategoryValue.textContent = labelParts.join(' • ');

      if (category.description) {
        impactorCategoryValue.title = category.description;
        impactorCategoryValue.dataset.tooltip = category.description;
        impactorCategoryValue.classList.add('impactor-results__value--has-tooltip');
        impactorCategoryValue.setAttribute('tabindex', '0');
        impactorCategoryValue.setAttribute('role', 'note');
        impactorCategoryValue.setAttribute(
          'aria-label',
          `${category.name} — ${category.description}`
        );
      } else {
        impactorCategoryValue.title = '';
        delete impactorCategoryValue.dataset.tooltip;
        impactorCategoryValue.classList.remove('impactor-results__value--has-tooltip');
        impactorCategoryValue.removeAttribute('tabindex');
        impactorCategoryValue.removeAttribute('role');
        impactorCategoryValue.removeAttribute('aria-label');
      }
    } else {
      impactorCategoryValue.textContent = '—';
      impactorCategoryValue.title = '';
      delete impactorCategoryValue.dataset.tooltip;
      impactorCategoryValue.classList.remove('impactor-results__value--has-tooltip');
      impactorCategoryValue.removeAttribute('tabindex');
      impactorCategoryValue.removeAttribute('role');
      impactorCategoryValue.removeAttribute('aria-label');
    }
  }
  if (impactorImpactLocationValue) {
    const latitudeText = formatLatitude(summary.latitude);
    const longitudeText = formatLongitude(summary.longitude);
    impactorImpactLocationValue.textContent = `${latitudeText}, ${longitudeText}`;
  }
  if (impactorTimeValue && Number.isFinite(summary.timeToImpactSeconds)) {
    impactorTimeValue.textContent = formatDuration(summary.timeToImpactSeconds);
  }
  if (Array.isArray(summary.effectBands)) {
    renderImpactorEffects(summary.effectBands);
  }

  setImpactMapSummary(summary);
}

function updateImpactorCountdown(remainingSeconds, impacted) {
  if (!impactorTimeValue) {
    return;
  }

  if (!Number.isFinite(remainingSeconds)) {
    impactorTimeValue.textContent = '—';
    return;
  }

  if (impacted) {
    impactorTimeValue.textContent = 'Impact';
    return;
  }

  impactorTimeValue.textContent = formatDuration(remainingSeconds);
}

function setImpactorFormState({ isSubmitting = false, hasActiveImpactor = false } = {}) {
  if (impactorSubmitButton) {
    impactorSubmitButton.disabled = isSubmitting || hasActiveImpactor;
  }
  if (impactorResetButton) {
    impactorResetButton.disabled = !hasActiveImpactor;
  }
  [impactorTypeInput, impactorDiameterInput, impactorNameInput]
    .filter(Boolean)
    .forEach(input => {
      input.disabled = hasActiveImpactor && !isSubmitting;
    });
}

function getPositiveNumber(input, fieldName) {
  if (!input) {
    throw new Error(`${fieldName} input is unavailable.`);
  }

  const value = Number.parseFloat(input.value);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive number.`);
  }
  return value;
}

function handleImpactorSubmit(event) {
  event.preventDefault();

  if (!impactorManagerInstance) {
    setImpactorFeedback('Impactor systems are not ready yet.', 'error');
    return;
  }

  try {
    setImpactorFeedback('');
    const asteroidType = impactorTypeInput?.value ?? '';
    const asteroidTypeConfig = ASTEROID_TYPES[asteroidType];
    if (!asteroidTypeConfig) {
      throw new Error('Please select a valid asteroid type.');
    }
    const diameterMeters = getPositiveNumber(impactorDiameterInput, 'Diameter');
    const name = impactorNameInput?.value?.trim() || 'Impactor';

    const massKg = computeAsteroidMassKg(diameterMeters, asteroidTypeConfig.densityKgPerM3);
    const velocityKmPerSecond = computeImpactorVelocityKmPerSecond(
      diameterMeters,
      asteroidTypeConfig
    );

    setImpactorFormState({ isSubmitting: true, hasActiveImpactor: false });

    const timing = getCurrentSimulationTiming();
    const summary = impactorManagerInstance.spawn(
      {
        name,
        massKg,
        diameterMeters,
        velocityKmPerSecond,
        asteroidType,
        densityKgPerM3: asteroidTypeConfig.densityKgPerM3,
        couplingEfficiency: asteroidTypeConfig.couplingEfficiency
      },
      { currentOrbitFrame: timing.orbitFrames }
    );

    updateImpactorResults({ ...summary, timeToImpactSeconds: summary.timeToImpactSeconds });
    setImpactorFeedback('Impactor launched toward the selected impact zone.', 'success');
    setImpactorFormState({ hasActiveImpactor: true });
  } catch (error) {
    console.error('Failed to create impactor', error);
    clearImpactorResults();
    setImpactorFormState({ hasActiveImpactor: false });
    setImpactorFeedback(error.message || 'Unable to create impactor.', 'error');
  }
}

function computeAsteroidMassKg(diameterMeters, densityKgPerM3) {
  if (!Number.isFinite(densityKgPerM3) || densityKgPerM3 <= 0) {
    throw new Error('Selected asteroid type has invalid density.');
  }

  const radiusMeters = diameterMeters / 2;
  const volumeCubicMeters = (4 / 3) * Math.PI * radiusMeters * radiusMeters * radiusMeters;
  return volumeCubicMeters * densityKgPerM3;
}

function computeImpactorVelocityKmPerSecond(diameterMeters, asteroidTypeConfig) {
  const { nominalVelocityKmPerSecond } = asteroidTypeConfig ?? {};

  if (!Number.isFinite(nominalVelocityKmPerSecond) || nominalVelocityKmPerSecond <= 0) {
    throw new Error('Selected asteroid type has invalid nominal velocity.');
  }

  const referenceDiameterMeters = 100;
  const diameterScale = Math.cbrt(Math.max(diameterMeters, 1) / referenceDiameterMeters);
  const velocity = nominalVelocityKmPerSecond * diameterScale;

  return Math.max(0.1, velocity);
}

function handleImpactorReset(event) {
  event?.preventDefault?.();

  if (!impactorManagerInstance) {
    setImpactorFeedback('Impactor systems are not ready yet.', 'error');
    return;
  }

  impactorManagerInstance.reset();
  clearImpactorResults();
  setImpactorFormState({ hasActiveImpactor: false });
  setImpactorFeedback('Impactor cleared. Enter new parameters to generate another trajectory.', 'info');
}

clearImpactorResults();
setImpactorFormState({ hasActiveImpactor: false });
setImpactorFeedback('');

let lastFrameTime = performance.now();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const targetBoundingBox = new THREE.Box3();
const targetBoundingSphere = new THREE.Sphere();

let isManualOrbiting = false;
let isUserOrbitControlsActive = false;

controls.addEventListener('start', () => {
  isManualOrbiting = true;
  isUserOrbitControlsActive = true;
  isMovingTowardsAsteroid = false;
  isMovingTowardsPlanet = false;
  isZoomingOut = false;
});

controls.addEventListener('end', () => {
  isUserOrbitControlsActive = false;
});

const viewTargetListElement = document.getElementById('viewTargetList');
const viewTargetItems = new Map();
let activeViewTargetId = null;

if (viewTargetListElement) {
  const items = viewTargetListElement.querySelectorAll('[data-target-id]');
  items.forEach(item => {
    const targetId = item.dataset.targetId;
    viewTargetItems.set(targetId, item);
    if (item.classList.contains('view-panel__item--active')) {
      activeViewTargetId = targetId;
    }
  });
}

function setActiveViewTarget(id) {
  activeViewTargetId = id ?? null;

  if (!viewTargetListElement) {
    return;
  }

  const items = viewTargetListElement.querySelectorAll('[data-target-id]');
  items.forEach(item => {
    item.classList.toggle('view-panel__item--active', item.dataset.targetId === activeViewTargetId);
  });
}

function getAsteroidViewTargetId(asteroidId) {
  return `asteroid:${asteroidId}`;
}

function addAsteroidViewTarget(entry) {
  if (!viewTargetListElement) {
    return;
  }

  const targetId = getAsteroidViewTargetId(entry.data.id);
  if (viewTargetItems.has(targetId)) {
    return;
  }

  const item = document.createElement('li');
  item.className = 'view-panel__item';
  item.dataset.targetId = targetId;
  item.textContent = entry.data.name ?? entry.data.id;

  viewTargetListElement.appendChild(item);
  viewTargetItems.set(targetId, item);
}

function removeAsteroidViewTarget(entry) {
  const targetId = getAsteroidViewTargetId(entry.data.id);
  const item = viewTargetItems.get(targetId);

  if (item?.parentElement) {
    item.parentElement.removeChild(item);
  }

  viewTargetItems.delete(targetId);
}

const MIN_CAMERA_DISTANCE = 0.2;
const MIN_CAMERA_DISTANCE_FLOOR = 0.1;
const MIN_CAMERA_PADDING_FACTOR = 1.6;
const SMALL_OBJECT_PADDING_FACTOR = 1.1;
const SMALL_OBJECT_RADIUS_THRESHOLD = 2;
const MAX_CAMERA_DISTANCE_FLOOR = 350;
const MAX_CAMERA_DISTANCE_FACTOR = 15;

function setCameraZoomLimitsForObject(object, fallbackRadius = 8) {
  let radius = fallbackRadius;

  if (object) {
    targetBoundingBox.setFromObject(object);
    if (!targetBoundingBox.isEmpty()) {
      targetBoundingBox.getBoundingSphere(targetBoundingSphere);
      const computedRadius = targetBoundingSphere.radius;
      if (computedRadius > 0) {
        radius = computedRadius;
      }
    }
  }

  let minDistance;

  if (radius <= SMALL_OBJECT_RADIUS_THRESHOLD) {
    const t = Math.min(radius / SMALL_OBJECT_RADIUS_THRESHOLD, 1);
    const paddingFactor = THREE.MathUtils.lerp(
      SMALL_OBJECT_PADDING_FACTOR,
      MIN_CAMERA_PADDING_FACTOR,
      t
    );
    minDistance = Math.max(radius * paddingFactor, MIN_CAMERA_DISTANCE_FLOOR);
  } else {
    minDistance = radius * MIN_CAMERA_PADDING_FACTOR;
  }

  minDistance = Math.max(minDistance, MIN_CAMERA_DISTANCE);
  const maxDistance = Math.max(radius * MAX_CAMERA_DISTANCE_FACTOR, MAX_CAMERA_DISTANCE_FLOOR);

  controls.minDistance = minDistance;
  controls.maxDistance = Math.max(maxDistance, minDistance * 1.2);
}

if (viewTargetListElement) {
  viewTargetListElement.addEventListener('click', async event => {
    const item = event.target.closest('[data-target-id]');
    if (!item) {
      return;
    }

    const { targetId } = item.dataset;
    if (targetId === 'earth') {
      focusEarthView();
      return;
    }

    if (targetId?.startsWith('asteroid:')) {
      const asteroidId = targetId.split(':')[1];
      await focusAsteroidById(asteroidId);
    }
  });
}

setActiveViewTarget('earth');

if (renderer?.domElement) {
  renderer.domElement.style.cursor = 'grab';
  renderer.domElement.addEventListener('pointerdown', () => {
    renderer.domElement.style.cursor = 'grabbing';
  });
  renderer.domElement.addEventListener('pointerup', () => {
    renderer.domElement.style.cursor = 'grab';
  });
  renderer.domElement.addEventListener('pointerleave', () => {
    renderer.domElement.style.cursor = 'grab';
  });
}

const earthDefaultCameraOffset = new THREE.Vector3(-90, 45, 140);
const earthDefaultCameraPosition = new THREE.Vector3();
const earthDefaultTargetPosition = new THREE.Vector3();
const zoomOutTargetPosition = new THREE.Vector3();
const planetFocusPosition = new THREE.Vector3();

let selectedPlanet = null;
let isMovingTowardsPlanet = false;
let targetCameraPosition = new THREE.Vector3();
let offset;

let isZoomingOut = false;
function updateEarthDefaultView(applyToCamera = false) {
  if (typeof earth !== 'undefined' && earth.planet) {
    earth.planet.getWorldPosition(earthDefaultTargetPosition);
  } else {
    earthDefaultTargetPosition.set(0, 0, 0);
  }

  earthDefaultCameraPosition.copy(earthDefaultTargetPosition).add(earthDefaultCameraOffset);
  zoomOutTargetPosition.copy(earthDefaultCameraPosition);

  if (applyToCamera) {
    controls.target.copy(earthDefaultTargetPosition);
    camera.position.copy(earthDefaultCameraPosition);
  }

  const earthTarget = typeof earth !== 'undefined' ? earth.planet : null;
  setCameraZoomLimitsForObject(earthTarget, 6.4);
}

function closeInfo() {
  const info = document.getElementById('planetInfo');
  if (info) {
    info.style.display = 'none';
  }
  settings.accelerationOrbit = 1;
  orbitTimeChannel.setMultiplier(settings.accelerationOrbit * FRAMES_PER_MILLISECOND);
  updateEarthDefaultView();
  controls.target.copy(earthDefaultTargetPosition);
  isManualOrbiting = false;
  isZoomingOut = true;
}

function closeInfoNoZoomOut() {
  const info = document.getElementById('planetInfo');
  if (info) {
    info.style.display = 'none';
  }
  settings.accelerationOrbit = 1;
  orbitTimeChannel.setMultiplier(settings.accelerationOrbit * FRAMES_PER_MILLISECOND);
  isManualOrbiting = false;
}

function showPlanetInfo(planet) {
  const info = document.getElementById('planetInfo');
  const name = document.getElementById('planetName');
  const details = document.getElementById('planetDetails');

  if (!info || !name || !details) {
    return;
  }

  name.innerText = planet;
  const data = planetData[planet];
  if (data) {
    details.innerText =
      `Radius: ${data.radius}\n` +
      `Tilt: ${data.tilt}\n` +
      `Rotation: ${data.rotation}\n` +
      `Orbit: ${data.orbit}\n` +
      `Distance: ${data.distance}\n` +
      `Moons: ${data.moons}\n` +
      `Info: ${data.info}`;
  } else {
    details.innerText = '';
  }

  info.style.display = 'block';
}

window.closeInfo = closeInfo;

const createPlanet = createPlanetFactory({ scene, textureLoader });

const sunSize = 697 / 40;
const sunGeom = new THREE.SphereGeometry(sunSize, 32, 20);
const sunMat = new THREE.MeshStandardMaterial({
  emissive: 0xfff88f,
  emissiveMap: textureLoader.load(sunTexture),
  emissiveIntensity: settings.sunIntensity
});
const sun = new THREE.Mesh(sunGeom, sunMat);
scene.add(sun);

const pointLight = new THREE.PointLight(0xfdffd3, 1200, 0, 0);
scene.add(pointLight);

function loadObject(path, position, scale, callback) {
  const loader = new GLTFLoader();
  loader.load(
    path,
    gltf => {
      const obj = gltf.scene;
      obj.position.set(position, 0, 0);
      obj.scale.set(scale, scale, scale);
      scene.add(obj);
      if (callback) {
        callback(obj);
      }
    },
    undefined,
    error => {
      console.error('An error happened', error);
    }
  );
}

const asteroidYieldColors = {
  low: 0x58d68d,
  medium: 0xf4d03f,
  high: 0xe74c3c
};

const asteroidImpactAngularRadii = {
  low: 12,
  medium: 25,
  high: 40
};

const defaultAsteroidCameraOffset = new THREE.Vector3(25, 15, 25);
const asteroidCameraOffsetDirection = defaultAsteroidCameraOffset.clone().normalize();
const ASTEROID_CAMERA_OFFSET_RADIUS_MULTIPLIER = 4;
const ASTEROID_CAMERA_OFFSET_MIN = 0.6;
const ASTEROID_CAMERA_OFFSET_MIN_MULTIPLIER = 1.5;

function computeAsteroidCameraOffset(entry) {
  if (!entry?.mesh) {
    return defaultAsteroidCameraOffset.clone();
  }

  targetBoundingBox.setFromObject(entry.mesh);
  if (targetBoundingBox.isEmpty()) {
    return defaultAsteroidCameraOffset.clone();
  }

  targetBoundingBox.getBoundingSphere(targetBoundingSphere);
  const radius = targetBoundingSphere.radius || 0;
  if (radius <= 0) {
    return defaultAsteroidCameraOffset.clone();
  }

  const minDistanceFromZoom = controls.minDistance ?? 0;
  const targetDistance = Math.max(
    radius * ASTEROID_CAMERA_OFFSET_RADIUS_MULTIPLIER,
    minDistanceFromZoom * ASTEROID_CAMERA_OFFSET_MIN_MULTIPLIER,
    ASTEROID_CAMERA_OFFSET_MIN
  );

  return asteroidCameraOffsetDirection
    .clone()
    .multiplyScalar(targetDistance);
}

const asteroidFocusPoint = new THREE.Vector3();
const asteroidCameraTarget = new THREE.Vector3();
const asteroidWorkVector = new THREE.Vector3();
const previousControlsTarget = new THREE.Vector3();
const controlsTargetDelta = new THREE.Vector3();
const earthWorldPosition = new THREE.Vector3();

const asteroidEntries = [];
const asteroidEntryMap = new Map();
const activeAsteroidIds = new Set();
const planetEntries = [];
let asteroidPanel = null;
const asteroidInfoPanel = initAsteroidInfoPanel();

function updateAsteroidPanelMetadata(entry) {
  if (!asteroidPanel || !entry?.data?.id) {
    return;
  }

  const item = asteroidPanel.getItemElement(entry.data.id);
  if (!item) {
    return;
  }

  const metaElement = item.querySelector('.asteroid-panel__meta');
  if (!metaElement) {
    return;
  }

  const orbit = entry.data.orbit ?? {};
  const yieldValue = entry.data.tntYieldMt;
  const yieldText = Number.isFinite(yieldValue) ? yieldValue : 'N/A';
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
const earthVelocityOrbital = new THREE.Vector3();
const earthVelocityKilometersPerSecond = new THREE.Vector3();

function getCurrentSimulationTiming() {
  return {
    orbitFrames: orbitTimeChannel.getValue(),
    spinFrames: spinTimeChannel.getValue()
  };
}

const asteroidMeshManagerPromise = createAsteroidMeshManager({
  scene,
  getCurrentTiming: getCurrentSimulationTiming
});
let asteroidMeshManager = null;

async function getAsteroidMeshManager() {
  if (asteroidMeshManager) {
    return asteroidMeshManager;
  }

  asteroidMeshManager = await asteroidMeshManagerPromise;
  return asteroidMeshManager;
}

let focusedAsteroidEntry = null;
let hoveredAsteroidEntry = null;
const asteroidTrajectories = new Map();
let asteroidImpactOverlay = null;
let isMovingTowardsAsteroid = false;
let impactorManagerInstance = null;

const earthMaterial = new THREE.ShaderMaterial({
  uniforms: {
    dayTexture: { type: 't', value: textureLoader.load(earthTexture) },
    nightTexture: { type: 't', value: textureLoader.load(earthNightTexture) },
    sunPosition: { type: 'v3', value: sun.position }
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vSunDirection;

    uniform vec3 sunPosition;

    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vNormal = normalize(modelMatrix * vec4(normal, 0.0)).xyz;
      vSunDirection = normalize(sunPosition - worldPosition.xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;

    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vSunDirection;

    void main() {
      float intensity = max(dot(vNormal, vSunDirection), 0.0);
      vec4 dayColor = texture2D(dayTexture, vUv);
      vec4 nightColor = texture2D(nightTexture, vUv) * 0.2;
      gl_FragColor = mix(nightColor, dayColor, intensity);
    }
  `
});

const earthMoon = [
  {
    size: 1.6,
    texture: earthMoonTexture,
    bump: earthMoonBump,
    orbitSpeed: 0.0166667,
    orbitRadius: 10,
    spinRate: 0.01,
    tilt: 5
  }
];

const marsMoons = [
  {
    modelPath: '/images/mars/phobos.glb',
    scale: 0.1,
    orbitRadius: 5,
    orbitSpeed: 0.0333333,
    position: 100,
    mesh: null,
    spinRate: 0.001
  },
  {
    modelPath: '/images/mars/deimos.glb',
    scale: 0.1,
    orbitRadius: 9,
    orbitSpeed: 0.0083333,
    position: 120,
    mesh: null,
    spinRate: 0.001
  }
];

const jupiterMoons = [
  {
    size: 1.6,
    texture: ioTexture,
    orbitRadius: 20,
    orbitSpeed: 0.0083333,
    spinRate: 0.01
  },
  {
    size: 1.4,
    texture: europaTexture,
    orbitRadius: 24,
    orbitSpeed: 0.0041667,
    spinRate: 0.01
  },
  {
    size: 2,
    texture: ganymedeTexture,
    orbitRadius: 28,
    orbitSpeed: 0.0020833,
    spinRate: 0.01
  },
  {
    size: 1.7,
    texture: callistoTexture,
    orbitRadius: 32,
    orbitSpeed: 0.001,
    spinRate: 0.01
  }
];

const mercury = createPlanet({
  name: 'Mercury',
  size: 2.4,
  tilt: 0,
  texture: mercuryTexture,
  bump: mercuryBump,
  orbit: planetOrbitCatalog.Mercury
});
const venus = createPlanet({
  name: 'Venus',
  size: 6.1,
  tilt: 3,
  texture: venusTexture,
  bump: venusBump,
  atmosphere: venusAtmosphere,
  orbit: planetOrbitCatalog.Venus
});
const earth = createPlanet({
  name: 'Earth',
  size: 6.4,
  tilt: 23,
  texture: earthMaterial,
  atmosphere: earthAtmosphere,
  moons: earthMoon,
  orbit: planetOrbitCatalog.Earth
});
impactorManagerInstance = createImpactorManager({
  scene,
  earthMesh: earth?.planet ?? null,
  earthOrbitElements: earth?.keplerElements ?? null
});
const mars = createPlanet({
  name: 'Mars',
  size: 3.4,
  tilt: 25,
  texture: marsTexture,
  bump: marsBump,
  orbit: planetOrbitCatalog.Mars
});

marsMoons.forEach((moon, index) => {
  moon.initialPhase = moon.initialPhase ?? index * (Math.PI / 2);
  loadObject(moon.modelPath, moon.position, moon.scale, loadedModel => {
    moon.mesh = loadedModel;
    mars.planetSystem.add(moon.mesh);
    moon.baseRotation = moon.mesh.rotation.y;
    moon.mesh.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  });
});

const jupiter = createPlanet({
  name: 'Jupiter',
  size: 69 / 4,
  tilt: 3,
  texture: jupiterTexture,
  moons: jupiterMoons,
  orbit: planetOrbitCatalog.Jupiter
});
const saturn = createPlanet({
  name: 'Saturn',
  size: 58 / 4,
  tilt: 26,
  texture: saturnTexture,
  ring: {
    innerRadius: 18,
    outerRadius: 29,
    texture: satRingTexture
  },
  orbit: planetOrbitCatalog.Saturn
});
const uranus = createPlanet({
  name: 'Uranus',
  size: 25 / 4,
  tilt: 82,
  texture: uranusTexture,
  ring: {
    innerRadius: 6,
    outerRadius: 8,
    texture: uraRingTexture
  },
  orbit: planetOrbitCatalog.Uranus
});
const neptune = createPlanet({
  name: 'Neptune',
  size: 24 / 4,
  tilt: 28,
  texture: neptuneTexture,
  orbit: planetOrbitCatalog.Neptune
});
const pluto = createPlanet({
  name: 'Pluto',
  size: 1,
  tilt: 57,
  texture: plutoTexture,
  orbit: planetOrbitCatalog.Pluto
});

[
  mercury,
  venus,
  earth,
  mars,
  jupiter,
  saturn,
  uranus,
  neptune,
  pluto
].forEach(entry => {
  if (entry) {
    planetEntries.push(entry);
  }
});

function synchronizeEarthVelocity(frameTime = 0) {
  if (!earth?.keplerElements) {
    earthVelocityOrbital.set(0, 0, 0);
    earthVelocityKilometersPerSecond.set(0, 0, 0);
    updateEarthVelocity({
      orbital: earthVelocityOrbital,
      kilometersPerSecond: earthVelocityKilometersPerSecond
    });
    return;
  }

  estimateOrbitalVelocity(earth.keplerElements, frameTime, {
    orbitalTarget: earthVelocityOrbital,
    kilometersPerSecondTarget: earthVelocityKilometersPerSecond
  });

  updateEarthVelocity({
    orbital: earthVelocityOrbital,
    kilometersPerSecond: earthVelocityKilometersPerSecond
  });
}

synchronizeEarthVelocity(earth?.keplerElements?.epoch ?? 0);

const spinBindings = [];

function registerSpinBinding(object, ratePerFrame) {
  if (!object) {
    return;
  }
  if (!object.userData) {
    object.userData = {};
  }
  object.userData.spinRate = ratePerFrame;
  object.userData.spinBase = object.rotation.y;
  spinBindings.push({ object, rate: ratePerFrame, base: object.rotation.y });
}

registerSpinBinding(sun, 0.001);
registerSpinBinding(mercury.planet, 0.001);
registerSpinBinding(venus.planet, 0.0005);
registerSpinBinding(venus.Atmosphere, 0.0005);
registerSpinBinding(earth.planet, 0.005);
registerSpinBinding(earth.Atmosphere, 0.001);
registerSpinBinding(mars.planet, 0.01);
registerSpinBinding(jupiter.planet, 0.005);
registerSpinBinding(saturn.planet, 0.01);
registerSpinBinding(uranus.planet, 0.005);
registerSpinBinding(neptune.planet, 0.005);
registerSpinBinding(pluto.planet, 0.001);


updateEarthDefaultView(true);
setCameraZoomLimitsForObject(earth?.planet ?? null, 6.4);

renderer.shadowMap.enabled = true;
pointLight.castShadow = true;
pointLight.shadow.mapSize.width = 1024;
pointLight.shadow.mapSize.height = 1024;
pointLight.shadow.camera.near = 10;
pointLight.shadow.camera.far = 20;

[earth, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto].forEach(body => {
  if (body?.planet) {
    body.planet.castShadow = true;
    body.planet.receiveShadow = true;
  }
  if (body?.Atmosphere) {
    body.Atmosphere.castShadow = true;
    body.Atmosphere.receiveShadow = true;
  }
  if (body?.Ring) {
    body.Ring.receiveShadow = true;
  }
  if (body?.moons) {
    body.moons.forEach(moon => {
      if (moon.mesh) {
        moon.mesh.castShadow = true;
        moon.mesh.receiveShadow = true;
      }
    });
  }
});

function handlePlanetSelection(clickedObject) {
  if (clickedObject.material === mercury.planet.material) {
    offset = 10;
    return mercury;
  }
  if (
    clickedObject.material === venus.planet.material ||
    clickedObject.material === venus.Atmosphere?.material
  ) {
    offset = 25;
    return venus;
  }
  if (
    clickedObject.material === earth.planet.material ||
    clickedObject.material === earth.Atmosphere?.material
  ) {
    offset = 25;
    return earth;
  }
  if (clickedObject.material === mars.planet.material) {
    offset = 15;
    return mars;
  }
  if (clickedObject.material === jupiter.planet.material) {
    offset = 50;
    return jupiter;
  }
  if (clickedObject.material === saturn.planet.material) {
    offset = 50;
    return saturn;
  }
  if (clickedObject.material === uranus.planet.material) {
    offset = 25;
    return uranus;
  }
  if (clickedObject.material === neptune.planet.material) {
    offset = 20;
    return neptune;
  }
  if (clickedObject.material === pluto.planet.material) {
    offset = 10;
    return pluto;
  }
  return null;
}

function focusCameraOnPlanet(planet) {
  if (!planet?.planet) {
    return;
  }

  const planetRadius = planet.planet.geometry?.parameters?.radius ?? 8;
  setCameraZoomLimitsForObject(planet.planet, planetRadius);

  planet.planet.getWorldPosition(planetFocusPosition);
  controls.target.copy(planetFocusPosition);

  targetCameraPosition.copy(planetFocusPosition);
  targetCameraPosition.z += offset;
  targetCameraPosition.y += offset / 2;
  isManualOrbiting = false;
  isMovingTowardsPlanet = true;
}

function setHoveredAsteroidEntry(entry) {
  hoveredAsteroidEntry = entry;
  const hoveredId = hoveredAsteroidEntry ? hoveredAsteroidEntry.data.id : null;
  asteroidPanel?.setHovered(hoveredId);
}

function getEarthPosition(target = earthWorldPosition) {
  if (earth?.planet) {
    earth.planet.getWorldPosition(target);
  } else {
    target.set(0, 0, 0);
  }

  return target;
}

function ensureAsteroidTrajectory(entry) {
  if (!entry?.mesh) {
    return;
  }

  const points = getTrajectoryPoints(entry);
  if (points.length === 0) {
    return;
  }
  const id = entry.data.id;
  let trajectory = asteroidTrajectories.get(id);

  if (!trajectory) {
    trajectory = createTrajectoryLine(points);
    scene.add(trajectory);
    asteroidTrajectories.set(id, trajectory);
  } else {
    trajectory.geometry.setFromPoints(points);
    if (trajectory.geometry.attributes.position) {
      trajectory.geometry.attributes.position.needsUpdate = true;
    }
    trajectory.geometry.computeBoundingSphere();
  }
}

function removeAsteroidTrajectory(entryOrId) {
  const id = typeof entryOrId === 'string' ? entryOrId : entryOrId?.data?.id;
  if (!id) {
    return;
  }

  const trajectory = asteroidTrajectories.get(id);
  if (!trajectory) {
    return;
  }

  disposeObject(trajectory);
  asteroidTrajectories.delete(id);
}

function updateAsteroidTrajectories() {
  const idsToRemove = [];

  asteroidTrajectories.forEach((trajectory, asteroidId) => {
    const entry = asteroidEntryMap.get(asteroidId);
    if (!entry?.mesh) {
      disposeObject(trajectory);
      idsToRemove.push(asteroidId);
      return;
    }

    const points = getTrajectoryPoints(entry);
    if (points.length === 0) {
      disposeObject(trajectory);
      idsToRemove.push(asteroidId);
      return;
    }
    trajectory.geometry.setFromPoints(points);
    if (trajectory.geometry.attributes.position) {
      trajectory.geometry.attributes.position.needsUpdate = true;
    }
    trajectory.geometry.computeBoundingSphere();
  });

  idsToRemove.forEach(id => {
    asteroidTrajectories.delete(id);
  });
}

function setImpactLegendVisible(isVisible) {
  if (!impactLegendElement) {
    return;
  }

  impactLegendElement.hidden = !isVisible;
}

function removeImpactOverlay() {
  if (!asteroidImpactOverlay) {
    return;
  }
  disposeObject(asteroidImpactOverlay);
  asteroidImpactOverlay = null;
}

function createImpactOverlay(entry) {
  const intersects = entry?.earthOrbitIntersection?.intersects;

  if (!intersects) {
    removeImpactOverlay();
    setImpactLegendVisible(false);
    return;
  }

  removeImpactOverlay();
  const earthRadius = earth?.planet?.geometry?.parameters?.radius ?? EARTH_RADIUS_SCENE_UNITS;
  asteroidImpactOverlay = createImpactOverlayMesh(entry, earthRadius, {
    colors: asteroidYieldColors,
    angularRadii: asteroidImpactAngularRadii
  });

  if (earth?.planet) {
    earth.planet.add(asteroidImpactOverlay);
  } else {
    scene.add(asteroidImpactOverlay);
  }

  setImpactLegendVisible(true);
}

function focusCameraOnAsteroid(entry) {
  closeInfoNoZoomOut();
  selectedPlanet = null;
  isMovingTowardsPlanet = false;
  isZoomingOut = false;

  if (!entry.mesh) {
    return;
  }

  setCameraZoomLimitsForObject(entry.mesh, 2.5);

  entry.cameraOffset = computeAsteroidCameraOffset(entry);

  entry.mesh.getWorldPosition(asteroidWorkVector);
  asteroidCameraTarget.copy(asteroidWorkVector).add(entry.cameraOffset);
  controls.target.copy(asteroidWorkVector);
  isManualOrbiting = false;
  isMovingTowardsAsteroid = true;
}

function clearAsteroidFocus() {
  asteroidPanel?.clearFocus();
  removeImpactOverlay();
  setImpactLegendVisible(false);
  asteroidInfoPanel?.clearActiveAsteroid();

  if (focusedAsteroidEntry) {
    focusedAsteroidEntry.cameraOffset = null;
    focusedAsteroidEntry = null;
    isMovingTowardsAsteroid = false;
  }
}

async function activateAsteroid(entry) {
  const id = entry.data.id;
  asteroidPanel?.setTracked(id, true);
  addAsteroidViewTarget(entry);

  if (activeAsteroidIds.has(id) && entry.mesh) {
    ensureAsteroidTrajectory(entry);
    return true;
  }

  if (entry.mesh) {
    activeAsteroidIds.add(id);
    ensureAsteroidTrajectory(entry);
    return true;
  }

  try {
    const meshManager = await getAsteroidMeshManager();
    meshManager.ensureMesh(entry, getCurrentSimulationTiming());
    activeAsteroidIds.add(id);
    ensureAsteroidTrajectory(entry);
    return true;
  } catch (error) {
    console.error('Failed to activate asteroid mesh', error);
    activeAsteroidIds.delete(id);
    asteroidPanel?.setTracked(id, false);
    removeAsteroidViewTarget(entry);
    return false;
  }
}

async function deactivateAsteroid(entry) {
  const id = entry.data.id;
  asteroidPanel?.setTracked(id, false);
  removeAsteroidViewTarget(entry);
  const wasActive = activeAsteroidIds.delete(id);

  if (focusedAsteroidEntry && focusedAsteroidEntry.data.id === id) {
    focusEarthView();
  }

  removeAsteroidTrajectory(entry);

  if (!entry.mesh && !wasActive) {
    return;
  }

  try {
    const meshManager = await getAsteroidMeshManager();
    meshManager.removeMesh(entry);
  } catch (error) {
    console.error('Failed to remove asteroid mesh', error);
  }

  entry.cameraOffset = null;
}

function handleAsteroidToggle(id, shouldActivate) {
  const entry = asteroidEntryMap.get(id);
  if (!entry) {
    return;
  }

  if (shouldActivate) {
    activateAsteroid(entry).catch(error => {
      console.error('Unable to activate asteroid', error);
    });
  } else {
    deactivateAsteroid(entry).catch(error => {
      console.error('Unable to deactivate asteroid', error);
    });
  }
}

function focusAsteroidEntry(entry) {
  clearAsteroidFocus();
  focusedAsteroidEntry = entry;
  activeAsteroidIds.add(entry.data.id);
  asteroidPanel?.setFocused(entry.data.id);
  setActiveViewTarget(getAsteroidViewTargetId(entry.data.id));
  ensureAsteroidTrajectory(entry);
  focusCameraOnAsteroid(entry);
  asteroidInfoPanel?.setActiveAsteroid(entry);
  createImpactOverlay(entry);
}

async function focusAsteroidById(id) {
  const entry = asteroidEntryMap.get(id);
  if (!entry) {
    return;
  }

  try {
    const meshManager = await getAsteroidMeshManager();
    meshManager.ensureMesh(entry, getCurrentSimulationTiming());
    activeAsteroidIds.add(id);
  } catch (error) {
    console.error('Failed to prepare asteroid for focus', error);
    return;
  }

  if (!entry.mesh) {
    return;
  }

  focusAsteroidEntry(entry);
}

function focusEarthView() {
  clearAsteroidFocus();
  setActiveViewTarget('earth');
  const earthTarget = typeof earth !== 'undefined' ? earth.planet : null;
  setCameraZoomLimitsForObject(earthTarget, 6.4);
  updateEarthDefaultView(true);
  isManualOrbiting = false;
  isMovingTowardsAsteroid = false;
  isMovingTowardsPlanet = false;
  isZoomingOut = true;
}

let asteroidInitializationPromise = null;

async function initializeAsteroids() {
  if (!asteroidInitializationPromise) {
    asteroidInitializationPromise = (async () => {
      const catalog = await loadAsteroidCatalog();
      const entries = createAsteroidEntries(catalog);

      asteroidEntries.splice(0, asteroidEntries.length, ...entries);
      asteroidEntryMap.clear();
      asteroidEntries.forEach(entry => {
        asteroidEntryMap.set(entry.data.id, entry);
      });

      activeAsteroidIds.clear();
      hoveredAsteroidEntry = null;
      focusedAsteroidEntry = null;

      asteroidPanel = initAsteroidPanel(asteroidEntries, {
        onToggle: (id, shouldActivate) => {
          handleAsteroidToggle(id, shouldActivate);
        }
      });

      clearAsteroidFocus();
      setHoveredAsteroidEntry(null);
    })();
  }

  return asteroidInitializationPromise;
}

function updateHoveredAsteroid() {
  const meshes = getAsteroidMeshes(asteroidEntries);
  if (meshes.length === 0) {
    setHoveredAsteroidEntry(null);
    return;
  }

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(meshes, true);
  if (intersects.length === 0) {
    setHoveredAsteroidEntry(null);
    return;
  }

  const entry = findAsteroidEntryFromObject(asteroidEntries, intersects[0].object);
  setHoveredAsteroidEntry(entry || null);
}

function onMouseMove(event) {
  const isCanvasInteraction = event.target === renderer.domElement;
  if (!isCanvasInteraction) {
    setHoveredAsteroidEntry(null);
    return;
  }

  event.preventDefault();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  updateHoveredAsteroid();
}

function updateAsteroids(timing) {
  asteroidEntries.forEach(entry => updateAsteroidTransform(entry, timing));
  updateAsteroidTrajectories();
  asteroidInfoPanel?.update(focusedAsteroidEntry);
}

function animateMoons(timing) {
  const orbitFrames = timing.orbitFrames ?? 0;
  const spinFrames = timing.spinFrames ?? 0;

  if (earth.moons) {
    earth.moons.forEach((moon, index) => {
      if (!moon.mesh) {
        return;
      }

      const tiltAngle = ((moon.tilt ?? 5) * Math.PI) / 180;
      const phase = moon.initialPhase ?? index * (Math.PI / 2);
      const angle = phase + (moon.orbitSpeed ?? 0) * orbitFrames;

      const moonX = earth.planet.position.x + (moon.orbitRadius ?? 10) * Math.cos(angle);
      const moonY = (moon.orbitRadius ?? 10) * Math.sin(angle) * Math.sin(tiltAngle);
      const moonZ = earth.planet.position.z + (moon.orbitRadius ?? 10) * Math.sin(angle) * Math.cos(tiltAngle);

      moon.mesh.position.set(moonX, moonY, moonZ);

      if (moon.baseRotation === undefined) {
        moon.baseRotation = moon.mesh.rotation.y;
      }
      const spinRate = moon.spinRate ?? 0.01;
      moon.mesh.rotation.y = moon.baseRotation + spinRate * spinFrames;
    });
  }

  marsMoons.forEach((moon, index) => {
    if (!moon.mesh) {
      return;
    }

    const phase = moon.initialPhase ?? index * (Math.PI / 2);
    const angle = phase + (moon.orbitSpeed ?? 0) * orbitFrames;
    const radius = moon.orbitRadius ?? 0;

    const moonX = mars.planet.position.x + radius * Math.cos(angle);
    const moonY = radius * Math.sin(angle);
    const moonZ = mars.planet.position.z + radius * Math.sin(angle);

    moon.mesh.position.set(moonX, moonY, moonZ);

    if (moon.baseRotation === undefined) {
      moon.baseRotation = moon.mesh.rotation.y;
    }
    const spinRate = moon.spinRate ?? 0.001;
    moon.mesh.rotation.y = moon.baseRotation + spinRate * spinFrames;
  });

  if (jupiter.moons) {
    jupiter.moons.forEach((moon, index) => {
      if (!moon.mesh) {
        return;
      }

      const phase = moon.initialPhase ?? index * (Math.PI / 2);
      const angle = phase + (moon.orbitSpeed ?? 0) * orbitFrames;
      const radius = moon.orbitRadius ?? jupiter.planet.geometry.parameters.radius * 1.5;

      const moonX = jupiter.planet.position.x + radius * Math.cos(angle);
      const moonY = radius * Math.sin(angle);
      const moonZ = jupiter.planet.position.z + radius * Math.sin(angle);

      moon.mesh.position.set(moonX, moonY, moonZ);

      if (moon.baseRotation === undefined) {
        moon.baseRotation = moon.mesh.rotation.y;
      }
      const spinRate = moon.spinRate ?? 0.01;
      moon.mesh.rotation.y = moon.baseRotation + spinRate * spinFrames;
    });
  }
}

function animate(now = performance.now()) {
  const deltaMs = now - lastFrameTime;
  lastFrameTime = now;

  simulationClock.advance(deltaMs);

  const timing = getCurrentSimulationTiming();

  spinBindings.forEach(binding => {
    binding.object.rotation.y = binding.base + binding.rate * timing.spinFrames;
  });

  planetEntries.forEach(entry => {
    const { keplerElements, planetSystem } = entry;
    if (!keplerElements || !planetSystem) {
      return;
    }

    const { position } = propagateKepler(keplerElements, timing.orbitFrames);
    orbitPositionToScene(position, planetSystem.position);
  });

  synchronizeEarthVelocity(timing.orbitFrames);

  animateMoons(timing);
  updateEarthDefaultView();
  updateAsteroids(timing);

  const impactorSnapshot = impactorManagerInstance?.update({
    orbitFrames: timing.orbitFrames
  });
  if (impactorSnapshot) {
    updateImpactorCountdown(
      impactorSnapshot.remainingSeconds,
      impactorSnapshot.impacted
    );
    updateImpactMapFromSnapshot(impactorSnapshot);
  }

  if (focusedAsteroidEntry && focusedAsteroidEntry.mesh) {
    focusedAsteroidEntry.mesh.getWorldPosition(asteroidFocusPoint);

    let asteroidCameraOffset = focusedAsteroidEntry.cameraOffset;
    if (!asteroidCameraOffset) {
      asteroidCameraOffset = computeAsteroidCameraOffset(focusedAsteroidEntry);
      focusedAsteroidEntry.cameraOffset = asteroidCameraOffset;
    }

    const shouldUpdateAsteroidTarget = !isUserOrbitControlsActive || isMovingTowardsAsteroid;
    let asteroidTargetUpdated = false;

    if (shouldUpdateAsteroidTarget) {
      previousControlsTarget.copy(controls.target);
      controls.target.lerp(asteroidFocusPoint, 0.15);
      asteroidTargetUpdated = true;
    }

    if (isMovingTowardsAsteroid) {
      asteroidCameraTarget.copy(asteroidFocusPoint).add(asteroidCameraOffset);
    } else if (isManualOrbiting && asteroidTargetUpdated) {
      controlsTargetDelta.subVectors(controls.target, previousControlsTarget);
      camera.position.add(controlsTargetDelta);
    } else if (!isManualOrbiting) {
      asteroidCameraTarget.copy(asteroidFocusPoint).add(asteroidCameraOffset);
      camera.position.lerp(asteroidCameraTarget, 0.02);
    }
  } else if (!selectedPlanet && !isMovingTowardsPlanet && !isMovingTowardsAsteroid && !isZoomingOut) {
    if (!isUserOrbitControlsActive) {
      previousControlsTarget.copy(controls.target);
      controls.target.lerp(earthDefaultTargetPosition, 0.1);

      if (isManualOrbiting) {
        controlsTargetDelta.subVectors(controls.target, previousControlsTarget);
        camera.position.add(controlsTargetDelta);
      } else {
        camera.position.lerp(earthDefaultCameraPosition, 0.02);
      }
    }
  }

  if (focusedAsteroidEntry && focusedAsteroidEntry.mesh) {
    outlinePass.selectedObjects = [focusedAsteroidEntry.mesh];
  } else {
    outlinePass.selectedObjects = [];
  }

  if (isMovingTowardsPlanet) {
    camera.position.lerp(targetCameraPosition, 0.03);
    if (camera.position.distanceTo(targetCameraPosition) < 1) {
      isMovingTowardsPlanet = false;
      if (selectedPlanet) {
        showPlanetInfo(selectedPlanet.name);
      }
    }
  } else if (isMovingTowardsAsteroid) {
    camera.position.lerp(asteroidCameraTarget, 0.03);
    if (camera.position.distanceTo(asteroidCameraTarget) < 1) {
      isMovingTowardsAsteroid = false;
    }
  } else if (isZoomingOut) {
    controls.target.lerp(earthDefaultTargetPosition, 0.1);
    camera.position.lerp(zoomOutTargetPosition, 0.05);
    if (camera.position.distanceTo(zoomOutTargetPosition) < 1) {
      isZoomingOut = false;
    }
  }

  controls.update();
  requestAnimationFrame(animate);
  composer.render();
}

initializeAsteroids().catch(error => {
  console.error('Failed to initialize asteroids', error);
});

window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

if (impactorForm) {
  impactorForm.addEventListener('submit', handleImpactorSubmit);
}

if (impactorResetButton) {
  impactorResetButton.addEventListener('click', handleImpactorReset);
}

requestAnimationFrame(animate);
