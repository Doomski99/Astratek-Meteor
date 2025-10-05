import * as THREE from 'three';

import {
  EARTH_RADIUS_SCENE_UNITS,
  KILOMETERS_PER_SCENE_UNIT,
  SECONDS_PER_FRAME
} from './scales.js';
import {
  createImpactOverlayMesh,
  createTrajectoryLine,
  disposeObject
} from './asteroids.js';
import { propagateKepler } from './kepler.js';
import { orbitPositionToScene, estimateOrbitalVelocity, sampleKeplerOrbit } from './orbitUtils.js';
import { getImpactYieldCategory } from '../data/impactYieldCategories.js';

const MEGATON_JOULES = 4.184e15;
const EARTH_RADIUS_KILOMETERS = 6371;
const EARTH_RADIUS_SCENE_KILOMETERS = EARTH_RADIUS_SCENE_UNITS * KILOMETERS_PER_SCENE_UNIT;
const DEFAULT_LEAD_TIME_SECONDS = 60 * 24 * 60 * 60;
const MIN_FRAMES_UNTIL_IMPACT = 1200;
const SOLAR_MU_KM3_PER_S2 = 1.32712440018e11;
const EARTH_MU_KM3_PER_S2 = 398600.4418;
const SEA_LEVEL_AIR_DENSITY_KG_PER_M3 = 1.225;
const ATMOSPHERIC_SCALE_HEIGHT_KM = 8.5;
const ATMOSPHERIC_ENTRY_ALTITUDE_KM = 120;
const DRAG_COEFFICIENT = 0.75;
const TWO_PI = Math.PI * 2;

const tempOrbitVector = new THREE.Vector3();
const tempVelocity = new THREE.Vector3();
const tempSceneVector = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempQuaternion2 = new THREE.Quaternion();
const tempOrbitVector2 = new THREE.Vector3();
const kHat = new THREE.Vector3(0, 0, 1);
const yAxis = new THREE.Vector3(0, 1, 0);
const tempVectorA = new THREE.Vector3();
const tempVectorB = new THREE.Vector3();
const tempVectorC = new THREE.Vector3();
const tempEntryVelocity = new THREE.Vector3();
const tempEntryNormal = new THREE.Vector3();

function ensureOrthogonalBasis(normal) {
  const safeNormal = normal.clone().normalize();
  let seed = new THREE.Vector3(
    THREE.MathUtils.randFloatSpread(2),
    THREE.MathUtils.randFloatSpread(2),
    THREE.MathUtils.randFloatSpread(2)
  );

  if (seed.lengthSq() < 1e-4 || Math.abs(seed.dot(safeNormal)) > 0.95) {
    seed.set(safeNormal.y || 1, safeNormal.z || 0.5, safeNormal.x || 0.25);
  }

  const tangent1 = seed.clone().cross(safeNormal).normalize();
  if (tangent1.lengthSq() < 1e-8) {
    tangent1.set(-safeNormal.z, safeNormal.x, safeNormal.y).normalize();
  }

  const tangent2 = safeNormal.clone().cross(tangent1).normalize();
  return { tangent1, tangent2, normal: safeNormal };
}

function createApproachVelocity(impactNormal, speedKmPerSecond) {
  const { tangent1, tangent2, normal } = ensureOrthogonalBasis(impactNormal);

  const tangentialFraction = THREE.MathUtils.randFloat(0.15, 0.75);
  const tangentialAngle = THREE.MathUtils.randFloat(0, TWO_PI);
  const radialFraction = Math.sqrt(Math.max(1 - tangentialFraction * tangentialFraction, 0.05));

  const tangentialComponent = tangent1
    .clone()
    .multiplyScalar(Math.cos(tangentialAngle))
    .add(tangent2.clone().multiplyScalar(Math.sin(tangentialAngle)));

  const approachDirection = normal
    .clone()
    .multiplyScalar(-radialFraction)
    .add(tangentialComponent.multiplyScalar(tangentialFraction))
    .normalize();

  return approachDirection.multiplyScalar(speedKmPerSecond);
}

function computeAtmosphericDensityKgPerM3(altitudeKm) {
  if (!Number.isFinite(altitudeKm) || altitudeKm >= 200) {
    return 0;
  }

  if (altitudeKm <= 0) {
    return SEA_LEVEL_AIR_DENSITY_KG_PER_M3;
  }

  return SEA_LEVEL_AIR_DENSITY_KG_PER_M3 * Math.exp(-altitudeKm / ATMOSPHERIC_SCALE_HEIGHT_KM);
}

function sampleVelocitiesAtFrame(impactorElements, earthElements, frame) {
  const impactorVelocityTarget = tempVectorA.set(0, 0, 0);
  const earthVelocityTarget = tempVectorB.set(0, 0, 0);

  const impactorResult = estimateOrbitalVelocity(impactorElements, frame, {
    kilometersPerSecondTarget: impactorVelocityTarget
  });
  const earthResult = estimateOrbitalVelocity(earthElements, frame, {
    kilometersPerSecondTarget: earthVelocityTarget
  });

  const impactorVelocity = (impactorResult.kilometersPerSecond ?? impactorVelocityTarget).clone();
  const earthVelocity = (earthResult.kilometersPerSecond ?? earthVelocityTarget).clone();
  const relativeVelocity = impactorVelocity.clone().sub(earthVelocity);

  return { impactorVelocity, earthVelocity, relativeVelocity };
}

function logVelocityDebug(label, vectorKmPerSecond) {
  if (!vectorKmPerSecond) {
    return;
  }

  const formatted = vectorKmPerSecond
    .toArray()
    .map(component => Number(component.toFixed(3)));
  console.log(`[Impactor] ${label}:`, formatted, 'km/s');
}

function formatVector(vector, fractionDigits = 3) {
  if (!vector?.toArray) {
    return [0, 0, 0];
  }

  return vector
    .toArray()
    .map(component => Number(component.toFixed(fractionDigits)));
}

function sampleSurfaceSeparation(earthElements, impactorElements, frame) {
  const earthState = propagateKepler(earthElements, frame);
  const impactorState = propagateKepler(impactorElements, frame);

  const earthVector = new THREE.Vector3(
    earthState.position.x ?? 0,
    earthState.position.y ?? 0,
    earthState.position.z ?? 0
  );

  const impactorVector = new THREE.Vector3(
    impactorState.position.x ?? 0,
    impactorState.position.y ?? 0,
    impactorState.position.z ?? 0
  );

  const relativeVector = impactorVector.clone().sub(earthVector);
  const separationSceneUnits = relativeVector.length();

  return {
    frame,
    earthVector,
    impactorVector,
    relativeVector,
    separationSceneUnits,
    surfaceDeltaSceneUnits: separationSceneUnits - EARTH_RADIUS_SCENE_UNITS
  };
}

function estimateImpactEpochFrame({
  earthElements,
  impactorElements,
  initialFrame,
  minFrame = 0,
  toleranceSceneUnits = 1e-4,
  searchRadiusFrames
}) {
  if (!earthElements || !impactorElements) {
    return null;
  }

  const safeInitialFrame = Number.isFinite(initialFrame) ? initialFrame : 0;
  const radius = Math.max(
    Number.isFinite(searchRadiusFrames) ? searchRadiusFrames : Math.abs(safeInitialFrame - minFrame) * 0.5,
    240
  );

  const startFrame = Math.max(minFrame, safeInitialFrame - radius);
  const endFrame = safeInitialFrame + radius;
  const step = Math.max(Math.floor(radius / 12), 20);

  const initialSample = sampleSurfaceSeparation(earthElements, impactorElements, safeInitialFrame);
  let bestSample = initialSample;

  let previousSample = sampleSurfaceSeparation(earthElements, impactorElements, startFrame);
  if (Math.abs(previousSample.surfaceDeltaSceneUnits) < Math.abs(bestSample.surfaceDeltaSceneUnits)) {
    bestSample = previousSample;
  }

  let lowerSample = null;
  let upperSample = null;

  for (let frame = startFrame + step; frame <= endFrame; frame += step) {
    const sample = sampleSurfaceSeparation(earthElements, impactorElements, frame);

    if (Math.abs(sample.surfaceDeltaSceneUnits) < Math.abs(bestSample.surfaceDeltaSceneUnits)) {
      bestSample = sample;
    }

    const signProduct = previousSample.surfaceDeltaSceneUnits * sample.surfaceDeltaSceneUnits;
    if (signProduct <= 0) {
      lowerSample = previousSample;
      upperSample = sample;
      break;
    }

    previousSample = sample;
  }

  if (!lowerSample || !upperSample) {
    return {
      frame: bestSample.frame,
      surfaceDeltaKm: bestSample.surfaceDeltaSceneUnits * KILOMETERS_PER_SCENE_UNIT
    };
  }

  let low = lowerSample;
  let high = upperSample;
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const midFrame = (low.frame + high.frame) / 2;
    const midSample = sampleSurfaceSeparation(earthElements, impactorElements, midFrame);

    if (Math.abs(midSample.surfaceDeltaSceneUnits) < Math.abs(bestSample.surfaceDeltaSceneUnits)) {
      bestSample = midSample;
    }

    if (Math.abs(midSample.surfaceDeltaSceneUnits) <= toleranceSceneUnits) {
      bestSample = midSample;
      break;
    }

    const lowSign = low.surfaceDeltaSceneUnits;
    const midSign = midSample.surfaceDeltaSceneUnits;
    if (lowSign * midSign <= 0) {
      high = midSample;
    } else {
      low = midSample;
    }
  }

  return {
    frame: bestSample.frame,
    surfaceDeltaKm: bestSample.surfaceDeltaSceneUnits * KILOMETERS_PER_SCENE_UNIT
  };
}

const MAX_SURFACE_DISTANCE_KM = EARTH_RADIUS_KILOMETERS * Math.PI;
const HEMISPHERE_SURFACE_DISTANCE_KM = EARTH_RADIUS_KILOMETERS * Math.PI * 0.5;

const EFFECT_ZONE_STYLES = {
  'blast-100': {
    fillColor: 0xff5722,
    outlineColor: 0xffab91,
    opacity: 0.55,
    featherDegrees: 3,
    defaultSeverity: 'critical'
  },
  'blast-35': {
    fillColor: 0xff7043,
    outlineColor: 0xffccbc,
    opacity: 0.45,
    featherDegrees: 4,
    defaultSeverity: 'critical'
  },
  'blast-10': {
    fillColor: 0xff9800,
    outlineColor: 0xffe0b2,
    opacity: 0.35,
    featherDegrees: 5,
    defaultSeverity: 'high'
  },
  'thermal-100': {
    fillColor: 0xffb74d,
    outlineColor: 0xffecb3,
    opacity: 0.32,
    featherDegrees: 4,
    defaultSeverity: 'high'
  },
  'thermal-20': {
    fillColor: 0xffd180,
    outlineColor: 0xfff0c2,
    opacity: 0.28,
    featherDegrees: 5,
    defaultSeverity: 'area'
  },
  'thermal-2': {
    fillColor: 0xffe0b2,
    outlineColor: 0xfff7e1,
    opacity: 0.24,
    featherDegrees: 6,
    defaultSeverity: 'area'
  },
  'crater-final': {
    fillColor: 0x9e9e9e,
    outlineColor: 0xe0e0e0,
    opacity: 0.5,
    featherDegrees: 2,
    defaultSeverity: 'critical'
  },
  'seismic-mmi': {
    fillColor: 0x7e57c2,
    outlineColor: 0xd1c4e9,
    opacity: 0.26,
    featherDegrees: 6,
    defaultSeverity: 'high'
  },
  'tsunami-near': {
    fillColor: 0x2196f3,
    outlineColor: 0xbbdefb,
    opacity: 0.24,
    featherDegrees: 5,
    defaultSeverity: 'critical'
  }
};

const DEFAULT_EFFECT_ZONE_STYLE = {
  fillColor: 0xffffff,
  outlineColor: 0xffffff,
  opacity: 0.2,
  featherDegrees: 5,
  defaultSeverity: 'high'
};

function clampRadiusKm(radiusKm) {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
    return 0;
  }

  return Math.min(radiusKm, MAX_SURFACE_DISTANCE_KM);
}

function deriveRepresentativeRadiusKm(range) {
  if (!range || typeof range !== 'object') {
    return 0;
  }

  const qualifier = range.qualifier;
  if (qualifier === 'global' || qualifier === 'planetary') {
    return MAX_SURFACE_DISTANCE_KM;
  }
  if (qualifier === 'hemisphere') {
    return HEMISPHERE_SURFACE_DISTANCE_KM;
  }
  if (qualifier === 'atLeast') {
    if (Number.isFinite(range.min)) {
      return range.min;
    }
    if (Number.isFinite(range.max)) {
      return range.max;
    }
    return 0;
  }

  const { min, max } = range;
  if (Number.isFinite(min) && Number.isFinite(max)) {
    return (min + max) / 2;
  }
  if (Number.isFinite(max)) {
    return max;
  }
  if (Number.isFinite(min)) {
    return min;
  }
  return 0;
}

function formatKilometers(value) {
  if (!Number.isFinite(value)) {
    return '';
  }

  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  if (value >= 100) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  if (value >= 10) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  if (value >= 1) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatRadiusLabel(range, fallbackRadiusKm) {
  if (!range || typeof range !== 'object') {
    if (Number.isFinite(fallbackRadiusKm) && fallbackRadiusKm > 0) {
      return `${formatKilometers(fallbackRadiusKm)} km`;
    }
    return null;
  }

  const qualifier = range.qualifier;
  if (qualifier === 'global') {
    return 'Global';
  }
  if (qualifier === 'planetary') {
    return 'Planetary-scale';
  }
  if (qualifier === 'hemisphere') {
    return 'Hemispheric (~10,000 km)';
  }
  if (qualifier === 'atLeast') {
    if (Number.isFinite(range.min)) {
      return `≥${formatKilometers(range.min)} km`;
    }
    if (Number.isFinite(range.max)) {
      return `≥${formatKilometers(range.max)} km`;
    }
    return '≥Global';
  }

  const { min, max } = range;
  if (Number.isFinite(min) && Number.isFinite(max)) {
    if (min === max) {
      return `${formatKilometers(min)} km`;
    }
    return `${formatKilometers(min)}–${formatKilometers(max)} km`;
  }
  if (Number.isFinite(max)) {
    return `${formatKilometers(max)} km`;
  }
  if (Number.isFinite(min)) {
    return `${formatKilometers(min)} km`;
  }
  if (Number.isFinite(fallbackRadiusKm) && fallbackRadiusKm > 0) {
    return `${formatKilometers(fallbackRadiusKm)} km`;
  }
  return null;
}

function wrapAngle(angle) {
  if (!Number.isFinite(angle)) {
    return 0;
  }

  let wrapped = angle % TWO_PI;
  if (wrapped < 0) {
    wrapped += TWO_PI;
  }
  return wrapped;
}

function sceneToOrbitVector(sceneVector, target = new THREE.Vector3()) {
  const source = sceneVector ?? new THREE.Vector3();
  target.set(source.x ?? 0, -(source.z ?? 0), source.y ?? 0);
  return target;
}

function computeEntryAngleSin(relativeVelocity, surfaceNormal) {
  if (
    !(relativeVelocity instanceof THREE.Vector3) ||
    !(surfaceNormal instanceof THREE.Vector3)
  ) {
    return 0;
  }

  tempEntryVelocity.copy(relativeVelocity);
  const speed = tempEntryVelocity.length();
  if (!Number.isFinite(speed) || speed <= 0) {
    return 0;
  }

  tempEntryNormal.copy(surfaceNormal);
  const normalLength = tempEntryNormal.length();
  if (!Number.isFinite(normalLength) || normalLength <= 0) {
    return 0;
  }

  const downwardNormal = tempEntryNormal.multiplyScalar(-1 / normalLength);
  tempEntryVelocity.multiplyScalar(1 / speed);
  const cosine = THREE.MathUtils.clamp(tempEntryVelocity.dot(downwardNormal), 0, 1);

  return cosine;
}

function computeYieldMegatons(
  massKg,
  velocityKmPerSecond,
  couplingEfficiency = 1,
  entryAngleSin = 1
) {
  const safeMassKg = Number.isFinite(massKg) && massKg > 0 ? massKg : 0;
  const safeVelocityKmPerSecond =
    Number.isFinite(velocityKmPerSecond) && velocityKmPerSecond > 0
      ? velocityKmPerSecond
      : 0;
  const clampedCoupling = Math.min(Math.max(couplingEfficiency ?? 1, 0), 1);
  const clampedEntryAngleSin = Math.min(Math.max(entryAngleSin ?? 0, 0), 1);

  const speedMetersPerSecond = safeVelocityKmPerSecond * 1000;
  const kineticEnergyJoules = 0.5 * safeMassKg * speedMetersPerSecond * speedMetersPerSecond;
  const coupledEnergyJoules = kineticEnergyJoules * clampedCoupling * clampedEntryAngleSin;

  return coupledEnergyJoules / MEGATON_JOULES;
}

function computeEffectBands(yieldMegatons) {
  const safeYield = Math.max(Number.isFinite(yieldMegatons) ? yieldMegatons : 0, 0);
  const category = getImpactYieldCategory(safeYield);
  const effectZones = Array.isArray(category?.effectZones) ? category.effectZones : [];

  const bands = effectZones
    .map(zone => {
      const style = EFFECT_ZONE_STYLES[zone.id] ?? DEFAULT_EFFECT_ZONE_STYLE;
      const radiusEstimateKm = clampRadiusKm(deriveRepresentativeRadiusKm(zone.radius));
      if (!Number.isFinite(radiusEstimateKm) || radiusEstimateKm <= 0) {
        return null;
      }

      const angularRadiusRad = Math.min((radiusEstimateKm / EARTH_RADIUS_KILOMETERS) || 0, Math.PI);
      if (angularRadiusRad <= 0) {
        return null;
      }

      const radiusLabel = zone.radiusLabel ?? formatRadiusLabel(zone.radius, radiusEstimateKm);

      return {
        id: zone.id,
        label: zone.label,
        severity: zone.severity ?? style.defaultSeverity,
        description: zone.description ?? '',
        radiusKm: radiusEstimateKm,
        radiusMinKm: Number.isFinite(zone.radius?.min) ? zone.radius.min : null,
        radiusMaxKm: Number.isFinite(zone.radius?.max) ? zone.radius.max : null,
        radiusQualifier: zone.radius?.qualifier ?? null,
        radiusLabel,
        fillColor: zone.fillColor ?? style.fillColor,
        outlineColor: zone.outlineColor ?? style.outlineColor,
        opacity: zone.opacity ?? style.opacity,
        featherDegrees: zone.featherDegrees ?? style.featherDegrees,
        featherRadians: zone.featherRadians ?? style.featherRadians,
        color: zone.fillColor ?? style.fillColor,
        angularRadiusRad,
        categoryId: category?.id,
        categoryName: category?.name,
        categoryRangeLabel: category?.rangeLabel,
        categoryDescription: category?.description
      };
    })
    .filter(Boolean);

  return { category, bands };
}

function createKeplerFromState(positionKm, velocityKmPerSecond, epochFrame) {
  const rVec = positionKm.clone();
  const vVec = velocityKmPerSecond.clone();

  const radius = rVec.length();
  const speedSquared = vVec.lengthSq();
  const mu = SOLAR_MU_KM3_PER_S2;

  const angularMomentum = rVec.clone().cross(vVec);
  const angularMomentumMagnitude = angularMomentum.length();

  const eccentricityVector = rVec
    .clone()
    .multiplyScalar(speedSquared / mu - 1 / radius)
    .sub(vVec.clone().multiplyScalar(rVec.dot(vVec) / mu));
  let eccentricity = eccentricityVector.length();
  if (eccentricity >= 0.999) {
    const scale = 0.999 / eccentricity;
    eccentricityVector.multiplyScalar(scale);
    eccentricity = 0.999;
  } else if (eccentricity < 1e-6) {
    eccentricity = 0;
  }

  const specificEnergy = 0.5 * speedSquared - mu / radius;
  const semiMajorAxisKm = specificEnergy !== 0 ? -mu / (2 * specificEnergy) : Infinity;
  if (!Number.isFinite(semiMajorAxisKm) || semiMajorAxisKm <= 0) {
    throw new Error('Unable to compute a bound impact trajectory with the provided parameters.');
  }

  const nodeVector = kHat.clone().cross(angularMomentum);
  const nodeMagnitude = nodeVector.length();

  const inclination = angularMomentumMagnitude > 0
    ? Math.acos(Math.min(Math.max(angularMomentum.z / angularMomentumMagnitude, -1), 1))
    : 0;

  let longitudeOfAscendingNode = 0;
  if (nodeMagnitude > 1e-8) {
    const cosOmega = Math.min(Math.max(nodeVector.x / nodeMagnitude, -1), 1);
    longitudeOfAscendingNode = Math.acos(cosOmega);
    if (nodeVector.y < 0) {
      longitudeOfAscendingNode = TWO_PI - longitudeOfAscendingNode;
    }
  }

  let argumentOfPeriapsis = 0;
  if (nodeMagnitude > 1e-8 && eccentricity > 1e-8) {
    const cosArgPeri = Math.min(
      Math.max(nodeVector.dot(eccentricityVector) / (nodeMagnitude * eccentricity), -1),
      1
    );
    argumentOfPeriapsis = Math.acos(cosArgPeri);
    if (eccentricityVector.z < 0) {
      argumentOfPeriapsis = TWO_PI - argumentOfPeriapsis;
    }
  } else if (eccentricity > 1e-8) {
    argumentOfPeriapsis = Math.atan2(eccentricityVector.y, eccentricityVector.x);
  }

  let trueAnomaly = 0;
  if (eccentricity > 1e-8) {
    const cosNu = Math.min(
      Math.max(eccentricityVector.dot(rVec) / (eccentricity * radius), -1),
      1
    );
    trueAnomaly = Math.acos(cosNu);
    if (rVec.dot(vVec) < 0) {
      trueAnomaly = TWO_PI - trueAnomaly;
    }
  } else if (nodeMagnitude > 1e-8) {
    const cosNu = Math.min(Math.max(nodeVector.dot(rVec) / (nodeMagnitude * radius), -1), 1);
    trueAnomaly = Math.acos(cosNu);
    if (rVec.z < 0) {
      trueAnomaly = TWO_PI - trueAnomaly;
    }
  }

  let meanAnomaly = wrapAngle(trueAnomaly);
  if (eccentricity < 1 - 1e-8) {
    const cosE = (eccentricity + Math.cos(trueAnomaly)) / (1 + eccentricity * Math.cos(trueAnomaly));
    const sinE =
      (Math.sqrt(Math.max(0, 1 - eccentricity * eccentricity)) * Math.sin(trueAnomaly)) /
      (1 + eccentricity * Math.cos(trueAnomaly));
    const eccentricAnomaly = Math.atan2(sinE, cosE);
    meanAnomaly = wrapAngle(eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly));
  }

  const semiMajorAxisScene = semiMajorAxisKm / KILOMETERS_PER_SCENE_UNIT;
  const safeSemiMajorAxisKm = Math.max(semiMajorAxisKm, 1);
  const meanMotionRadPerSecond = Math.sqrt(mu / (safeSemiMajorAxisKm * safeSemiMajorAxisKm * safeSemiMajorAxisKm));
  const meanMotion = meanMotionRadPerSecond * SECONDS_PER_FRAME;

  return {
    semiMajorAxis: semiMajorAxisScene,
    eccentricity,
    inclination,
    longitudeOfAscendingNode,
    argumentOfPeriapsis,
    meanAnomalyAtEpoch: meanAnomaly,
    meanMotion,
    epoch: epochFrame,
    sqrtOneMinusESquared: Math.sqrt(Math.max(0, 1 - eccentricity * eccentricity))
  };
}

function buildImpactorState({
  scene,
  earthMesh,
  earthOrbitElements,
  config,
  currentOrbitFrame
}) {
  if (!earthOrbitElements) {
    throw new Error('Earth orbital elements are unavailable.');
  }

  const {
    name,
    massKg,
    diameterMeters,
    velocityKmPerSecond,
    leadTimeSeconds = DEFAULT_LEAD_TIME_SECONDS,
    couplingEfficiency,
    densityKgPerM3,
    asteroidType
  } = config;

  if (!Number.isFinite(velocityKmPerSecond) || velocityKmPerSecond <= 0) {
    throw new Error('Velocity must be a positive number.');
  }

  const safeCouplingEfficiency = Number.isFinite(couplingEfficiency)
    ? Math.min(Math.max(couplingEfficiency, 0), 1)
    : 1;

  const radiusMeters = Math.max(Number.isFinite(diameterMeters) ? diameterMeters / 2 : 0, 0);
  const crossSectionAreaM2 = Math.PI * radiusMeters * radiusMeters;

  const latitude = THREE.MathUtils.randFloatSpread(180);
  const longitude = THREE.MathUtils.randFloatSpread(360);
  const latRad = THREE.MathUtils.degToRad(latitude);
  const lonRad = THREE.MathUtils.degToRad(longitude);

  if (earthMesh) {
    earthMesh.updateWorldMatrix(true, false);
  }

  const impactNormalScene = new THREE.Vector3(
    Math.cos(latRad) * Math.cos(lonRad),
    Math.sin(latRad),
    Math.cos(latRad) * Math.sin(lonRad)
  ).normalize();

  const earthRadiusScene = EARTH_RADIUS_SCENE_UNITS;

  const leadTime = Math.max(Number.isFinite(leadTimeSeconds) ? leadTimeSeconds : 0, 0);
  let framesUntilImpact = Math.max(
    Math.round((leadTime || DEFAULT_LEAD_TIME_SECONDS) / SECONDS_PER_FRAME),
    MIN_FRAMES_UNTIL_IMPACT
  );
  const currentFrame = currentOrbitFrame ?? 0;
  let impactEpochFrame = currentFrame + framesUntilImpact;

  const impactNormalSceneWorld = impactNormalScene.clone();
  if (earthMesh) {
    earthMesh.getWorldQuaternion(tempQuaternion);
    const spinRate = Number.isFinite(earthMesh.userData?.spinRate)
      ? earthMesh.userData.spinRate
      : 0;
    const additionalSpin = spinRate * framesUntilImpact;
    if (Math.abs(additionalSpin) > 1e-6) {
      tempQuaternion2.setFromAxisAngle(yAxis, additionalSpin);
      tempQuaternion.multiply(tempQuaternion2);
    }
    impactNormalSceneWorld.applyQuaternion(tempQuaternion);
  }
  impactNormalSceneWorld.normalize();

  const impactNormalOrbit = sceneToOrbitVector(
    impactNormalSceneWorld,
    tempOrbitVector
  ).normalize();

  let earthStateAtImpact = propagateKepler(earthOrbitElements, impactEpochFrame);
  let earthPositionOrbit = tempOrbitVector.clone().set(
    earthStateAtImpact.position.x ?? 0,
    earthStateAtImpact.position.y ?? 0,
    earthStateAtImpact.position.z ?? 0
  );
  let earthPositionKm = earthPositionOrbit.clone().multiplyScalar(KILOMETERS_PER_SCENE_UNIT);
  let earthScenePositionAtImpact = orbitPositionToScene(
    earthStateAtImpact.position,
    tempSceneVector.clone()
  );

  const earthVelocitySeedResult = estimateOrbitalVelocity(earthOrbitElements, impactEpochFrame, {
    kilometersPerSecondTarget: tempVelocity
  });
  const earthVelocitySeedKmPerSecond =
    (earthVelocitySeedResult.kilometersPerSecond ?? tempVelocity).clone();

  const impactOffsetKm = impactNormalOrbit.clone().multiplyScalar(EARTH_RADIUS_SCENE_KILOMETERS);
  const impactPositionKm = earthPositionKm.clone().add(impactOffsetKm);

  let relativeVelocityKm = createApproachVelocity(impactNormalOrbit, velocityKmPerSecond);

  const orbitRadiusKm = Math.max(earthPositionKm.length(), 1);
  const escapeSpeed = Math.sqrt((2 * SOLAR_MU_KM3_PER_S2) / orbitRadiusKm) * 0.98;
  const earthSpeed = earthVelocitySeedKmPerSecond.length();
  const availableAdditionalSpeed = Math.max(escapeSpeed - earthSpeed, 1);
  const relativeSpeed = relativeVelocityKm.length();
  if (relativeSpeed > availableAdditionalSpeed) {
    relativeVelocityKm.multiplyScalar(availableAdditionalSpeed / relativeSpeed);
  }

  const impactVelocityKm = earthVelocitySeedKmPerSecond.clone().add(relativeVelocityKm);

  const keplerElements = createKeplerFromState(impactPositionKm, impactVelocityKm, impactEpochFrame);

  const impactEpochEstimate = estimateImpactEpochFrame({
    earthElements: earthOrbitElements,
    impactorElements: keplerElements,
    initialFrame: impactEpochFrame,
    minFrame: currentFrame
  });

  if (impactEpochEstimate && Number.isFinite(impactEpochEstimate.frame)) {
    impactEpochFrame = impactEpochEstimate.frame;
    framesUntilImpact = Math.max(Math.round(impactEpochFrame - currentFrame), 0);
    earthStateAtImpact = propagateKepler(earthOrbitElements, impactEpochFrame);
    earthPositionOrbit = tempOrbitVector2.set(
      earthStateAtImpact.position.x ?? 0,
      earthStateAtImpact.position.y ?? 0,
      earthStateAtImpact.position.z ?? 0
    );
    earthPositionKm = earthPositionOrbit.clone().multiplyScalar(KILOMETERS_PER_SCENE_UNIT);
    earthScenePositionAtImpact = orbitPositionToScene(
      earthStateAtImpact.position,
      tempSceneVector.clone()
    );

    console.log(
      '[Impactor] Refined impact epoch frame:',
      Number(impactEpochFrame.toFixed(3)),
      'surface delta (km):',
      Number((impactEpochEstimate.surfaceDeltaKm ?? 0).toFixed(4))
    );
  }

  const earthVelocityImpactResult = estimateOrbitalVelocity(earthOrbitElements, impactEpochFrame, {
    kilometersPerSecondTarget: new THREE.Vector3()
  });
  const earthVelocityKmPerSecond = earthVelocityImpactResult.kilometersPerSecond ?? new THREE.Vector3();

  const impactorVelocityImpactResult = estimateOrbitalVelocity(keplerElements, impactEpochFrame, {
    kilometersPerSecondTarget: new THREE.Vector3()
  });
  const impactorVelocityKmPerSecond =
    impactorVelocityImpactResult.kilometersPerSecond ?? new THREE.Vector3();

  const relativeVelocityAtImpactKmPerSecond = impactorVelocityKmPerSecond
    .clone()
    .sub(earthVelocityKmPerSecond);

  const entryAngleSin = computeEntryAngleSin(
    relativeVelocityAtImpactKmPerSecond,
    impactNormalOrbit
  );
  if (Number.isFinite(entryAngleSin)) {
    const clamped = Math.min(Math.max(entryAngleSin, 0), 1);
    const entryAngleDeg = THREE.MathUtils.radToDeg(Math.asin(clamped));
    console.log(
      '[Impactor] Entry angle vs surface:',
      Number(entryAngleDeg.toFixed(2)),
      'deg (sinθ =',
      Number(entryAngleSin.toFixed(3)),
      ')'
    );
  }

  const impactSpeedKmPerSecond = relativeVelocityAtImpactKmPerSecond.length();
  const yieldMegatons = computeYieldMegatons(
    massKg,
    impactSpeedKmPerSecond,
    safeCouplingEfficiency,
    entryAngleSin
  );
  const { category: impactCategory, bands: effectBands } = computeEffectBands(yieldMegatons);

  logVelocityDebug('Earth heliocentric velocity @ impact', earthVelocityKmPerSecond);
  logVelocityDebug('Impactor heliocentric velocity @ impact', impactorVelocityKmPerSecond);
  logVelocityDebug(
    'Impactor relative velocity vs Earth before atmosphere',
    relativeVelocityAtImpactKmPerSecond
  );

  console.log('[Impactor] Generated Keplerian elements:', {
    semiMajorAxisKm: Number((keplerElements.semiMajorAxis * KILOMETERS_PER_SCENE_UNIT).toFixed(2)),
    eccentricity: Number(keplerElements.eccentricity.toFixed(4)),
    inclinationDeg: Number(THREE.MathUtils.radToDeg(keplerElements.inclination).toFixed(3)),
    longitudeOfAscendingNodeDeg: Number(
      THREE.MathUtils.radToDeg(keplerElements.longitudeOfAscendingNode).toFixed(3)
    ),
    argumentOfPeriapsisDeg: Number(
      THREE.MathUtils.radToDeg(keplerElements.argumentOfPeriapsis).toFixed(3)
    ),
    meanAnomalyDeg: Number(THREE.MathUtils.radToDeg(keplerElements.meanAnomalyAtEpoch).toFixed(3))
  });

  const { position: currentOrbitPosition } = propagateKepler(keplerElements, currentFrame);
  const startScenePosition = orbitPositionToScene(currentOrbitPosition, new THREE.Vector3());

  const geometry = new THREE.IcosahedronGeometry(
    Math.min(Math.max((diameterMeters / 2000) / KILOMETERS_PER_SCENE_UNIT, 0.05), 2.5),
    2
  );
  const material = new THREE.MeshStandardMaterial({
    color: 0xff5533,
    emissive: 0x331100,
    emissiveIntensity: 0.6,
    roughness: 0.7,
    metalness: 0.1,
    flatShading: true
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name || 'Impactor';
  mesh.userData.isImpactor = true;
  mesh.position.copy(startScenePosition);
  scene.add(mesh);

  let trajectoryLine = null;
  const trajectorySegments = 512;
  const trajectoryPoints = sampleKeplerOrbit(keplerElements, trajectorySegments).map(point =>
    point.clone()
  );

  if (trajectoryPoints.length >= 2) {
    trajectoryLine = createTrajectoryLine(trajectoryPoints);
    trajectoryLine.material.color.setHex(0xff7043);
    trajectoryLine.material.opacity = 0.85;
    trajectoryLine.material.needsUpdate = true;
    trajectoryLine.userData.impactorTrajectory = true;
    scene.add(trajectoryLine);
  }

  const impactScenePosition = orbitPositionToScene(
    propagateKepler(keplerElements, impactEpochFrame).position,
    new THREE.Vector3()
  );

  const overlaySeedWorldPoint = impactNormalScene.clone().multiplyScalar(earthRadiusScene);
  if (earthMesh) {
    earthMesh.localToWorld(overlaySeedWorldPoint);
  }

  const overlayImpactSceneAtEpoch = earthScenePositionAtImpact
    .clone()
    .add(impactNormalSceneWorld.clone().multiplyScalar(earthRadiusScene));
  const overlayDeltaAtImpact = overlayImpactSceneAtEpoch.clone().sub(impactScenePosition);

  console.log('[Impactor] Overlay impact point (seed frame):', formatVector(overlaySeedWorldPoint));
  console.log(
    '[Impactor] Overlay impact point (impact epoch):',
    formatVector(overlayImpactSceneAtEpoch)
  );
  console.log(
    '[Impactor] Impactor scene position (impact epoch):',
    formatVector(impactScenePosition)
  );
  console.log('[Impactor] Overlay/impactor delta at impact epoch:', formatVector(overlayDeltaAtImpact));

  const earthVelocityAtImpactClone = earthVelocityKmPerSecond.clone();
  const impactorVelocityAtImpactClone = impactorVelocityKmPerSecond.clone();
  const relativeVelocityAtImpactClone = relativeVelocityAtImpactKmPerSecond.clone();
  const timeToImpactSeconds = Math.max((impactEpochFrame - currentFrame) * SECONDS_PER_FRAME, 0);

  return {
    mesh,
    overlay: null,
    trajectoryLine,
    effectBands,
    yieldMegatons,
    impactCategory,
    impactNormalScene,
    impactNormalOrbit: impactNormalOrbit.clone(),
    keplerElements,
    impactEpochFrame,
    name: name || 'Impactor',
    massKg,
    diameterMeters,
    velocityKmPerSecond,
    latitude,
    longitude,
    timeToImpactSeconds,
    impacted: false,
    previousOrbitFrame: currentFrame,
    impactScenePosition,
    earthVelocityKmPerSecondAtImpact: earthVelocityAtImpactClone,
    impactorVelocityKmPerSecondAtImpact: impactorVelocityAtImpactClone,
    relativeVelocityKmPerSecond: relativeVelocityAtImpactClone,
    impactVelocityKmPerSecond: impactSpeedKmPerSecond,
    entryAngleSin,
    couplingEfficiency: safeCouplingEfficiency,
    densityKgPerM3: Number.isFinite(densityKgPerM3) && densityKgPerM3 > 0 ? densityKgPerM3 : null,
    asteroidType: asteroidType ?? null,
    dragCoefficient: DRAG_COEFFICIENT,
    crossSectionAreaM2,
    dragStartAltitudeKm: ATMOSPHERIC_ENTRY_ALTITUDE_KM,
    dragActive: false,
    dragRelativePositionKm: null,
    dragRelativeVelocityKmPerSecond: null,
    atmosphericEntryFrame: null,
    elapsedSeconds: 0,
    initialTimeToImpactSeconds: timeToImpactSeconds,
    earthRadiusScene,
    mitigationStatus: null
  };
}

function disposeImpactor(state, { scene, earthMesh }) {
  if (!state) {
    return;
  }

  if (state.mesh) {
    scene.remove(state.mesh);
    state.mesh.geometry?.dispose();
    state.mesh.material?.dispose?.();
  }

  if (state.overlay) {
    if (state.overlay.parent) {
      state.overlay.parent.remove(state.overlay);
    }
    disposeObject(state.overlay);
  }

  if (state.trajectoryLine) {
    if (state.trajectoryLine.parent) {
      state.trajectoryLine.parent.remove(state.trajectoryLine);
    }
    disposeObject(state.trajectoryLine);
  }
}

function createImpactorManager({ scene, earthMesh, earthOrbitElements }) {
  let currentState = null;
  const snapshot = {
    remainingSeconds: null,
    impacted: false,
    latitude: null,
    longitude: null,
    yieldMegatons: null,
    effectBands: [],
    name: null,
    impactCategory: null,
    mitigationStatus: null
  };

  function clearSnapshot() {
    snapshot.remainingSeconds = null;
    snapshot.impacted = false;
    snapshot.latitude = null;
    snapshot.longitude = null;
    snapshot.yieldMegatons = null;
    snapshot.effectBands = [];
    snapshot.name = null;
    snapshot.impactCategory = null;
    snapshot.mitigationStatus = null;
  }

  function rebuildOverlay(state) {
    if (!state) {
      return;
    }

    const overlayParent = earthMesh ?? scene;

    if (state.overlay) {
      if (state.overlay.parent) {
        state.overlay.parent.remove(state.overlay);
      }
      disposeObject(state.overlay);
      state.overlay = null;
    }

    const impactNormal = state.impactNormalScene?.clone?.();
    if (!(impactNormal instanceof THREE.Vector3)) {
      return;
    }

    const earthRadiusScene = Number.isFinite(state.earthRadiusScene)
      ? state.earthRadiusScene
      : EARTH_RADIUS_SCENE_UNITS;

    const overlayEntry = {
      data: { tntYieldMt: state.yieldMegatons ?? 0 },
      earthOrbitIntersection: {
        intersects: true,
        impactNormal,
        impactPoint: impactNormal.clone().multiplyScalar(earthRadiusScene)
      }
    };

    const overlay = createImpactOverlayMesh(overlayEntry, earthRadiusScene, {
      bands: state.effectBands
    });

    if (overlay) {
      overlayParent.add(overlay);
      state.overlay = overlay;
    }
  }

  function applyImpactOutputs(state, { yieldMegatons, impactCategory, effectBands }) {
    if (!state) {
      return;
    }

    const safeYield = Number.isFinite(yieldMegatons) ? yieldMegatons : 0;
    const safeBands = Array.isArray(effectBands) ? effectBands : [];

    state.yieldMegatons = safeYield;
    state.effectBands = safeBands;
    state.impactCategory = impactCategory ?? null;

    snapshot.yieldMegatons = safeYield;
    snapshot.effectBands = safeBands.map(band => ({ ...band }));
    snapshot.name = state.name;
    snapshot.mitigationStatus = state.mitigationStatus
      ? { ...state.mitigationStatus }
      : null;

    if (state.impactCategory) {
      snapshot.impactCategory = {
        id: state.impactCategory.id,
        name: state.impactCategory.name,
        rangeLabel: state.impactCategory.rangeLabel,
        description: state.impactCategory.description
      };
    } else {
      snapshot.impactCategory = null;
    }

    rebuildOverlay(state);
  }

  function getSnapshot() {
    if (!currentState) {
      return null;
    }
    return {
      remainingSeconds: snapshot.remainingSeconds,
      impacted: snapshot.impacted,
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
      yieldMegatons: snapshot.yieldMegatons,
      effectBands: snapshot.effectBands.map(band => ({ ...band })),
      name: snapshot.name,
      impactCategory: snapshot.impactCategory
        ? { ...snapshot.impactCategory }
        : null,
      mitigationStatus: snapshot.mitigationStatus
        ? { ...snapshot.mitigationStatus }
        : null
    };
  }

  function reset() {
    const hadImpactor = !!currentState;

    if (currentState) {
      disposeImpactor(currentState, { scene, earthMesh });
    }

    currentState = null;
    clearSnapshot();
    return hadImpactor;
  }

  function applyKineticDeflection({ currentOrbitFrame } = {}) {
    if (!currentState) {
      throw new Error('No active impactor is available for deflection.');
    }

    if (currentState.impacted) {
      throw new Error('The impactor has already impacted Earth.');
    }

    const frame = Number.isFinite(currentOrbitFrame)
      ? currentOrbitFrame
      : currentState.previousOrbitFrame ?? currentState.keplerElements?.epoch ?? 0;

    const { position } = propagateKepler(currentState.keplerElements, frame);
    const positionKm = new THREE.Vector3(
      position.x ?? 0,
      position.y ?? 0,
      position.z ?? 0
    ).multiplyScalar(KILOMETERS_PER_SCENE_UNIT);

    const impactorVelocitySeed = estimateOrbitalVelocity(currentState.keplerElements, frame, {
      kilometersPerSecondTarget: new THREE.Vector3()
    });
    const impactorVelocityKmPerSecond = (impactorVelocitySeed.kilometersPerSecond ?? new THREE.Vector3()).clone();

    const earthVelocitySeed = estimateOrbitalVelocity(earthOrbitElements, frame, {
      kilometersPerSecondTarget: new THREE.Vector3()
    });
    const earthVelocityKmPerSecond = (earthVelocitySeed.kilometersPerSecond ?? new THREE.Vector3()).clone();

    const relativeVelocity = impactorVelocityKmPerSecond.clone().sub(earthVelocityKmPerSecond);
    const impactNormal = currentState.impactNormalOrbit?.clone?.() ?? new THREE.Vector3(0, 1, 0);

    let deflectionDirection = relativeVelocity.clone().cross(impactNormal).normalize();
    if (deflectionDirection.lengthSq() < 1e-8) {
      deflectionDirection = relativeVelocity.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
      if (deflectionDirection.lengthSq() < 1e-8) {
        deflectionDirection.set(1, 0, 0);
      }
    }

    const deltaVBase = 0.12; // km/s
    let appliedDeltaV = null;
    let bestElements = null;
    let bestMissDistanceKm = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const magnitude = deltaVBase * Math.pow(2, attempt);
      const deltaVelocity = deflectionDirection.clone().multiplyScalar(magnitude);

      let candidateElements = null;
      try {
        candidateElements = createKeplerFromState(
          positionKm,
          impactorVelocityKmPerSecond.clone().add(deltaVelocity),
          frame
        );
      } catch (error) {
        console.warn('[Impactor] Deflection attempt failed', error);
        continue;
      }

      const candidateEstimate = estimateImpactEpochFrame({
        earthElements: earthOrbitElements,
        impactorElements: candidateElements,
        initialFrame: currentState.impactEpochFrame,
        minFrame: frame
      });

      const candidateMissDistanceKm = candidateEstimate?.surfaceDeltaKm ?? Infinity;

      if (!Number.isFinite(candidateMissDistanceKm) || candidateMissDistanceKm > 50) {
        bestElements = candidateElements;
        bestMissDistanceKm = Number.isFinite(candidateMissDistanceKm)
          ? candidateMissDistanceKm
          : null;
        appliedDeltaV = magnitude;
        break;
      }

      if (
        bestElements === null ||
        (Number.isFinite(candidateMissDistanceKm) &&
          (!Number.isFinite(bestMissDistanceKm) || candidateMissDistanceKm > bestMissDistanceKm))
      ) {
        bestElements = candidateElements;
        bestMissDistanceKm = candidateMissDistanceKm;
        appliedDeltaV = magnitude;
      }
    }

    if (!bestElements) {
      throw new Error('Unable to compute a deflected trajectory for the impactor.');
    }

    if (Number.isFinite(bestMissDistanceKm) && Math.abs(bestMissDistanceKm) <= 50) {
      throw new Error('The kinetic deflection was insufficient to avoid impact.');
    }

    const missDistanceKm = Number.isFinite(bestMissDistanceKm)
      ? Math.abs(bestMissDistanceKm)
      : null;

    currentState.keplerElements = bestElements;
    currentState.impactEpochFrame = Infinity;
    currentState.impacted = false;
    currentState.dragActive = false;
    currentState.dragRelativePositionKm = null;
    currentState.dragRelativeVelocityKmPerSecond = null;
    currentState.timeToImpactSeconds = null;
    currentState.mitigationStatus = {
      type: 'deflected',
      missDistanceKm,
      deltaVelocityKmPerSecond: appliedDeltaV ?? null,
      appliedAtFrame: frame
    };
    currentState.effectBands = [];
    currentState.yieldMegatons = 0;
    currentState.impactCategory = null;
    currentState.impactScenePosition = null;
    currentState.previousOrbitFrame = frame;

    if (currentState.trajectoryLine) {
      if (currentState.trajectoryLine.parent) {
        currentState.trajectoryLine.parent.remove(currentState.trajectoryLine);
      }
      disposeObject(currentState.trajectoryLine);
      currentState.trajectoryLine = null;
    }

    const deflectedTrajectoryPoints = sampleKeplerOrbit(currentState.keplerElements, 512).map(point =>
      point.clone()
    );
    if (deflectedTrajectoryPoints.length >= 2) {
      currentState.trajectoryLine = createTrajectoryLine(deflectedTrajectoryPoints);
      currentState.trajectoryLine.material.color.setHex(0x7bd6ff);
      currentState.trajectoryLine.material.opacity = 0.85;
      currentState.trajectoryLine.material.needsUpdate = true;
      currentState.trajectoryLine.userData.impactorTrajectory = true;
      scene.add(currentState.trajectoryLine);
    }

    applyImpactOutputs(currentState, {
      yieldMegatons: 0,
      impactCategory: null,
      effectBands: []
    });

    snapshot.remainingSeconds = null;
    snapshot.impacted = false;
    snapshot.mitigationStatus = currentState.mitigationStatus
      ? { ...currentState.mitigationStatus }
      : null;

    return {
      missDistanceKm,
      deltaVelocityKmPerSecond: appliedDeltaV ?? null
    };
  }

  function spawn(config, { currentOrbitFrame } = {}) {
    reset();

    const state = buildImpactorState({
      scene,
      earthMesh,
      earthOrbitElements,
      config,
      currentOrbitFrame
    });

    currentState = state;
    snapshot.remainingSeconds = state.timeToImpactSeconds;
    snapshot.impacted = state.impacted;
    snapshot.latitude = state.latitude;
    snapshot.longitude = state.longitude;
    snapshot.name = state.name;
    snapshot.mitigationStatus = null;
    state.mitigationStatus = null;

    applyImpactOutputs(currentState, {
      yieldMegatons: state.yieldMegatons,
      impactCategory: state.impactCategory,
      effectBands: state.effectBands
    });

    const impactCategorySummary = snapshot.impactCategory
      ? { ...snapshot.impactCategory }
      : null;

    return {
      yieldMegatons: state.yieldMegatons,
      latitude: state.latitude,
      longitude: state.longitude,
      effectBands: state.effectBands,
      timeToImpactSeconds: state.timeToImpactSeconds,
      name: state.name,
      impactCategory: impactCategorySummary,
      mitigationStatus: null
    };
  }

  function update({ orbitFrames } = {}) {
    if (!currentState) {
      return null;
    }

    const frame = orbitFrames ?? currentState.previousOrbitFrame ?? 0;
    const previousFrame = currentState.previousOrbitFrame ?? frame;
    currentState.previousOrbitFrame = frame;

    const deltaFrames = Math.max(frame - previousFrame, 0);
    const deltaSeconds = deltaFrames * SECONDS_PER_FRAME;
    currentState.elapsedSeconds = (currentState.elapsedSeconds ?? 0) + deltaSeconds;

    const earthState = propagateKepler(earthOrbitElements, frame);
    const earthScenePosition = orbitPositionToScene(earthState.position, new THREE.Vector3());

    const targetFrame = currentState.dragActive
      ? frame
      : Math.min(frame, currentState.impactEpochFrame);
    const { position } = propagateKepler(currentState.keplerElements, targetFrame);
    const keplerScenePosition = orbitPositionToScene(position, new THREE.Vector3());

    if (!currentState.dragActive && !currentState.impacted) {
      const velocitySample = sampleVelocitiesAtFrame(
        currentState.keplerElements,
        earthOrbitElements,
        targetFrame
      );
      currentState.relativeVelocityKmPerSecond = velocitySample.relativeVelocity.clone();
      currentState.impactVelocityKmPerSecond =
        currentState.relativeVelocityKmPerSecond.length();
      if (currentState.impactNormalOrbit) {
        currentState.entryAngleSin = computeEntryAngleSin(
          currentState.relativeVelocityKmPerSecond,
          currentState.impactNormalOrbit
        );
      }

      const relativeScene = tempVectorA.copy(keplerScenePosition).sub(earthScenePosition);
      const relativeKm = tempVectorB.copy(relativeScene).multiplyScalar(KILOMETERS_PER_SCENE_UNIT);
      const altitudeKm = relativeKm.length() - EARTH_RADIUS_KILOMETERS;

      if (
        Number.isFinite(altitudeKm) &&
        altitudeKm <= currentState.dragStartAltitudeKm &&
        currentState.crossSectionAreaM2 > 0 &&
        currentState.massKg > 0
      ) {
        currentState.dragActive = true;
        currentState.dragRelativePositionKm = relativeKm.clone();
        currentState.dragRelativeVelocityKmPerSecond = velocitySample.relativeVelocity.clone();
        currentState.atmosphericEntryFrame = frame;
        console.log(
          '[Impactor] Atmospheric drag engaged at altitude',
          Number(altitudeKm.toFixed(2)),
          'km'
        );
      } else {
        currentState.mesh.position.copy(keplerScenePosition);
      }
    }

    if (currentState.dragActive && !currentState.impacted) {
      if (!currentState.dragRelativePositionKm) {
        currentState.dragRelativePositionKm = new THREE.Vector3();
      }
      if (!currentState.dragRelativeVelocityKmPerSecond) {
        currentState.dragRelativeVelocityKmPerSecond = new THREE.Vector3();
      }

      if (deltaSeconds > 0) {
        const relativePositionKm = currentState.dragRelativePositionKm;
        const radiusKm = relativePositionKm.length();

        if (radiusKm > 0) {
          const altitudeKm = radiusKm - EARTH_RADIUS_KILOMETERS;
          const airDensity = computeAtmosphericDensityKgPerM3(altitudeKm);
          const relativeVelocityKmPerSecond = currentState.dragRelativeVelocityKmPerSecond;
          const speedKmPerSecond = relativeVelocityKmPerSecond.length();

          const dragAccelerationVector = tempVectorA.set(0, 0, 0);
          if (
            airDensity > 0 &&
            speedKmPerSecond > 0 &&
            currentState.crossSectionAreaM2 > 0 &&
            currentState.massKg > 0
          ) {
            const speedMetersPerSecond = speedKmPerSecond * 1000;
            const dragForce =
              0.5 *
              airDensity *
              speedMetersPerSecond *
              speedMetersPerSecond *
              currentState.dragCoefficient *
              currentState.crossSectionAreaM2;
            const dragAccelerationKmPerS2 = (dragForce / currentState.massKg) / 1000;
            dragAccelerationVector.copy(relativeVelocityKmPerSecond)
              .normalize()
              .multiplyScalar(-dragAccelerationKmPerS2);
          }

          const gravityAcceleration = tempVectorB
            .copy(relativePositionKm)
            .multiplyScalar(
              -EARTH_MU_KM3_PER_S2 /
                Math.pow(Math.max(radiusKm, EARTH_RADIUS_KILOMETERS), 3)
            );

          const totalAcceleration = tempVectorC
            .copy(gravityAcceleration)
            .add(dragAccelerationVector)
            .multiplyScalar(deltaSeconds);
          currentState.dragRelativeVelocityKmPerSecond.add(totalAcceleration);
          currentState.dragRelativePositionKm.add(
            tempVectorC.copy(currentState.dragRelativeVelocityKmPerSecond).multiplyScalar(deltaSeconds)
          );
        }
      }

      let radiusKm = currentState.dragRelativePositionKm.length();
      if (radiusKm <= EARTH_RADIUS_KILOMETERS) {
        const impactSpeedKmPerSecond = currentState.dragRelativeVelocityKmPerSecond.length();
        const impactEntryAngleSin = computeEntryAngleSin(
          currentState.dragRelativeVelocityKmPerSecond,
          currentState.dragRelativePositionKm
        );
        currentState.entryAngleSin = impactEntryAngleSin;
        currentState.impactVelocityKmPerSecond = impactSpeedKmPerSecond;
        const impactYieldMegatons = computeYieldMegatons(
          currentState.massKg,
          impactSpeedKmPerSecond,
          currentState.couplingEfficiency,
          impactEntryAngleSin
        );
        const { category: impactCategoryFinal, bands: impactBandsFinal } =
          computeEffectBands(impactYieldMegatons);
        applyImpactOutputs(currentState, {
          yieldMegatons: impactYieldMegatons,
          impactCategory: impactCategoryFinal,
          effectBands: impactBandsFinal
        });

        if (radiusKm > 0) {
          tempVectorA.copy(currentState.dragRelativePositionKm).normalize();
        } else {
          tempVectorA.set(0, 1, 0);
        }
        currentState.dragRelativePositionKm.copy(
          tempVectorA.multiplyScalar(EARTH_RADIUS_KILOMETERS)
        );
        currentState.impacted = true;
        currentState.dragRelativeVelocityKmPerSecond.set(0, 0, 0);
      }

      const relativeSceneUnits = tempVectorA
        .copy(currentState.dragRelativePositionKm)
        .multiplyScalar(1 / KILOMETERS_PER_SCENE_UNIT);
      const worldPosition = tempVectorB.copy(earthScenePosition).add(relativeSceneUnits);
      currentState.mesh.position.copy(worldPosition);
      currentState.impactScenePosition = worldPosition.clone();
      currentState.relativeVelocityKmPerSecond = currentState.dragRelativeVelocityKmPerSecond.clone();
      currentState.impactVelocityKmPerSecond =
        currentState.relativeVelocityKmPerSecond.length();
      currentState.entryAngleSin = computeEntryAngleSin(
        currentState.dragRelativeVelocityKmPerSecond,
        currentState.dragRelativePositionKm
      );
    }

    if (!currentState.dragActive && frame >= currentState.impactEpochFrame && !currentState.impacted) {
      const finalSpeedKmPerSecond =
        currentState.relativeVelocityKmPerSecond?.length?.() ?? 0;
      currentState.impactVelocityKmPerSecond = finalSpeedKmPerSecond;
      const finalEntryAngleSin = computeEntryAngleSin(
        currentState.relativeVelocityKmPerSecond,
        currentState.impactNormalOrbit
      );
      currentState.entryAngleSin = finalEntryAngleSin;
      const finalYieldMegatons = computeYieldMegatons(
        currentState.massKg,
        finalSpeedKmPerSecond,
        currentState.couplingEfficiency,
        finalEntryAngleSin
      );
      const { category: finalCategory, bands: finalBands } = computeEffectBands(finalYieldMegatons);
      applyImpactOutputs(currentState, {
        yieldMegatons: finalYieldMegatons,
        impactCategory: finalCategory,
        effectBands: finalBands
      });
      currentState.impacted = true;
      currentState.mesh.position.copy(currentState.impactScenePosition);
    }

    let remainingSeconds = 0;
    if (currentState.impacted) {
      remainingSeconds = 0;
    } else if (currentState.dragActive) {
      const radiusKm = currentState.dragRelativePositionKm?.length?.() ?? EARTH_RADIUS_KILOMETERS;
      const altitudeKm = Math.max(radiusKm - EARTH_RADIUS_KILOMETERS, 0);
      const speedKmPerSecond = currentState.dragRelativeVelocityKmPerSecond?.length?.() ?? 0;
      if (speedKmPerSecond > 1e-5) {
        remainingSeconds = altitudeKm / speedKmPerSecond;
      } else {
        const remainingFrames = Math.max(currentState.impactEpochFrame - frame, 0);
        remainingSeconds = remainingFrames * SECONDS_PER_FRAME;
      }
    } else {
      const remainingFrames = Math.max(currentState.impactEpochFrame - frame, 0);
      remainingSeconds = remainingFrames * SECONDS_PER_FRAME;
    }

    if (currentState.mitigationStatus?.type === 'deflected') {
      remainingSeconds = null;
    }

    snapshot.remainingSeconds = remainingSeconds;
    snapshot.impacted = currentState.impacted;
    snapshot.mitigationStatus = currentState.mitigationStatus
      ? { ...currentState.mitigationStatus }
      : null;

    return getSnapshot();
  }

  function getActiveImpactorMesh() {
    return currentState?.mesh ?? null;
  }

  function getActiveImpactorName() {
    return currentState?.name ?? null;
  }

  return {
    spawn,
    reset,
    update,
    getSnapshot,
    getActiveImpactorMesh,
    getActiveImpactorName,
    applyKineticDeflection
  };
}

export {
  createImpactorManager,
  computeYieldMegatons
};
