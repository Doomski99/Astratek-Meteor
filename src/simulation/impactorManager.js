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
import { orbitPositionToScene, estimateOrbitalVelocity } from './orbitUtils.js';
import { getImpactYieldCategory } from '../data/impactYieldCategories.js';

const MEGATON_JOULES = 4.184e15;
const EARTH_RADIUS_KILOMETERS = 6371;
const EARTH_RADIUS_SCENE_KILOMETERS = EARTH_RADIUS_SCENE_UNITS * KILOMETERS_PER_SCENE_UNIT;
const DEFAULT_LEAD_TIME_SECONDS = 7 * 24 * 60 * 60;
const SOLAR_MU_KM3_PER_S2 = 1.32712440018e11;
const TWO_PI = Math.PI * 2;

const tempOrbitVector = new THREE.Vector3();
const tempVelocity = new THREE.Vector3();
const kHat = new THREE.Vector3(0, 0, 1);

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

function logVelocityDebug(label, vectorKmPerSecond) {
  if (!vectorKmPerSecond) {
    return;
  }

  const formatted = vectorKmPerSecond
    .toArray()
    .map(component => Number(component.toFixed(3)));
  console.log(`[Impactor] ${label}:`, formatted, 'km/s');
}

const BASE_EFFECT_BANDS = [
  {
    id: 'fireball',
    defaultLabel: 'Fireball (Total Destruction)',
    fillColor: 0xff5722,
    outlineColor: 0xffab91,
    opacity: 0.5,
    featherDegrees: 3,
    defaultSeverity: 'critical',
    radiusCalculator: ({ yieldExponentFourTenths }) => 0.9 * yieldExponentFourTenths
  },
  {
    id: 'severe-blast',
    defaultLabel: 'Severe Blast Damage',
    fillColor: 0xff7043,
    outlineColor: 0xffccbc,
    opacity: 0.38,
    featherDegrees: 4,
    defaultSeverity: 'high',
    radiusCalculator: ({ yieldCubeRoot }) => 2.4 * yieldCubeRoot
  },
  {
    id: 'moderate-blast',
    defaultLabel: 'Moderate Blast Damage',
    fillColor: 0xff9800,
    outlineColor: 0xffe0b2,
    opacity: 0.3,
    featherDegrees: 5,
    defaultSeverity: 'elevated',
    radiusCalculator: ({ yieldCubeRoot }) => 4.1 * yieldCubeRoot
  },
  {
    id: 'thermal',
    defaultLabel: 'Thermal Radiation',
    fillColor: 0xffe082,
    outlineColor: 0xfff3e0,
    opacity: 0.22,
    featherDegrees: 6,
    defaultSeverity: 'area',
    radiusCalculator: ({ yieldExponentFourTenths }) => 7.2 * yieldExponentFourTenths
  }
];

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

function computeYieldMegatons(massKg, velocityKmPerSecond) {
  const speedMetersPerSecond = velocityKmPerSecond * 1000;
  const energyJoules = 0.5 * massKg * speedMetersPerSecond * speedMetersPerSecond;
  return energyJoules / MEGATON_JOULES;
}

function computeEffectBands(yieldMegatons) {
  const safeYield = Math.max(yieldMegatons, 0.001);
  const yieldCubeRoot = Math.cbrt(safeYield);
  const yieldExponentFourTenths = Math.pow(safeYield, 0.4);
  const category = getImpactYieldCategory(safeYield);

  const bands = BASE_EFFECT_BANDS.map(base => {
    const radiusKm = base.radiusCalculator({ yieldCubeRoot, yieldExponentFourTenths, safeYield });
    const categoryEffect = category?.effects?.[base.id] ?? null;
    const label = categoryEffect?.title ?? base.defaultLabel;
    const severity = categoryEffect?.severity ?? base.defaultSeverity;
    const description = categoryEffect?.description ?? '';

    const angularRadiusRad = Math.min((radiusKm / EARTH_RADIUS_KILOMETERS) || 0, Math.PI);
    return {
      id: base.id,
      label,
      severity,
      description,
      radiusKm,
      fillColor: base.fillColor,
      outlineColor: base.outlineColor,
      opacity: base.opacity,
      featherDegrees: base.featherDegrees,
      color: base.fillColor,
      angularRadiusRad,
      categoryId: category?.id,
      categoryName: category?.name,
      categoryRangeLabel: category?.rangeLabel,
      categoryDescription: category?.description
    };
  }).filter(band => band.radiusKm > 0.01 && band.angularRadiusRad > 0);

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
    leadTimeSeconds = DEFAULT_LEAD_TIME_SECONDS
  } = config;

  if (!Number.isFinite(velocityKmPerSecond) || velocityKmPerSecond <= 0) {
    throw new Error('Velocity must be a positive number.');
  }

  const yieldMegatons = computeYieldMegatons(massKg, velocityKmPerSecond);
  const { category: impactCategory, bands: effectBands } = computeEffectBands(yieldMegatons);

  const latitude = THREE.MathUtils.randFloatSpread(180);
  const longitude = THREE.MathUtils.randFloatSpread(360);
  const latRad = THREE.MathUtils.degToRad(latitude);
  const lonRad = THREE.MathUtils.degToRad(longitude);

  const impactNormalScene = new THREE.Vector3(
    Math.cos(latRad) * Math.cos(lonRad),
    Math.sin(latRad),
    Math.cos(latRad) * Math.sin(lonRad)
  ).normalize();

  const impactNormalOrbit = sceneToOrbitVector(impactNormalScene, tempOrbitVector).normalize();

  const earthRadiusScene = EARTH_RADIUS_SCENE_UNITS;

  const leadTime = Math.max(Number.isFinite(leadTimeSeconds) ? leadTimeSeconds : 0, 0);
  const framesUntilImpact = Math.max(
    Math.round((leadTime || DEFAULT_LEAD_TIME_SECONDS) / SECONDS_PER_FRAME),
    300
  );
  const currentFrame = currentOrbitFrame ?? 0;
  const impactEpochFrame = currentFrame + framesUntilImpact;

  const earthStateAtImpact = propagateKepler(earthOrbitElements, impactEpochFrame);
  const earthPositionOrbit = tempOrbitVector.clone().set(
    earthStateAtImpact.position.x ?? 0,
    earthStateAtImpact.position.y ?? 0,
    earthStateAtImpact.position.z ?? 0
  );
  const earthPositionKm = earthPositionOrbit.clone().multiplyScalar(KILOMETERS_PER_SCENE_UNIT);

  const earthVelocityResult = estimateOrbitalVelocity(earthOrbitElements, impactEpochFrame, {
    kilometersPerSecondTarget: tempVelocity
  });
  const earthVelocityKmPerSecond = (earthVelocityResult.kilometersPerSecond ?? tempVelocity).clone();

  const impactOffsetKm = impactNormalOrbit.clone().multiplyScalar(EARTH_RADIUS_SCENE_KILOMETERS);
  const impactPositionKm = earthPositionKm.clone().add(impactOffsetKm);

  let relativeVelocityKm = createApproachVelocity(impactNormalOrbit, velocityKmPerSecond);

  const orbitRadiusKm = Math.max(earthPositionKm.length(), 1);
  const escapeSpeed = Math.sqrt((2 * SOLAR_MU_KM3_PER_S2) / orbitRadiusKm) * 0.98;
  const earthSpeed = earthVelocityKmPerSecond.length();
  const availableAdditionalSpeed = Math.max(escapeSpeed - earthSpeed, 1);
  const relativeSpeed = relativeVelocityKm.length();
  if (relativeSpeed > availableAdditionalSpeed) {
    relativeVelocityKm.multiplyScalar(availableAdditionalSpeed / relativeSpeed);
  }

  const impactVelocityKm = earthVelocityKmPerSecond.clone().add(relativeVelocityKm);

  logVelocityDebug('Earth heliocentric velocity', earthVelocityKmPerSecond);
  logVelocityDebug('Impactor heliocentric velocity', impactVelocityKm);

  const keplerElements = createKeplerFromState(impactPositionKm, impactVelocityKm, impactEpochFrame);

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

  const overlayEntry = {
    data: { tntYieldMt: yieldMegatons },
    earthOrbitIntersection: {
      intersects: true,
      impactNormal: impactNormalScene.clone(),
      impactPoint: impactNormalScene.clone().multiplyScalar(earthRadiusScene)
    }
  };

  const overlay = createImpactOverlayMesh(overlayEntry, earthRadiusScene, {
    bands: effectBands
  });

  if (overlay) {
    (earthMesh ?? scene).add(overlay);
  }

  let trajectoryLine = null;
  const trajectoryPoints = [];
  const sampleCount = 256;
  for (let index = 0; index <= sampleCount; index += 1) {
    const progress = index / sampleCount;
    const sampleFrame = currentFrame + progress * (impactEpochFrame - currentFrame);
    const { position: samplePosition } = propagateKepler(keplerElements, sampleFrame);
    const scenePoint = orbitPositionToScene(samplePosition, new THREE.Vector3());
    trajectoryPoints.push(scenePoint.clone());
  }

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

  return {
    mesh,
    overlay,
    trajectoryLine,
    effectBands,
    yieldMegatons,
    impactCategory,
    impactNormalScene,
    keplerElements,
    impactEpochFrame,
    name: name || 'Impactor',
    massKg,
    diameterMeters,
    velocityKmPerSecond,
    latitude,
    longitude,
    timeToImpactSeconds: framesUntilImpact * SECONDS_PER_FRAME,
    impacted: false,
    previousOrbitFrame: currentFrame,
    impactScenePosition
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
    impactCategory: null
  };

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
      effectBands: snapshot.effectBands,
      name: snapshot.name,
      impactCategory: snapshot.impactCategory
    };
  }

  function reset() {
    if (!currentState) {
      return false;
    }

    disposeImpactor(currentState, { scene, earthMesh });
    currentState = null;
    snapshot.remainingSeconds = null;
    snapshot.impacted = false;
    snapshot.latitude = null;
    snapshot.longitude = null;
    snapshot.yieldMegatons = null;
    snapshot.effectBands = [];
    snapshot.name = null;
    snapshot.impactCategory = null;
    return true;
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
    snapshot.yieldMegatons = state.yieldMegatons;
    snapshot.effectBands = state.effectBands;
    snapshot.name = state.name;

    const impactCategorySummary = state.impactCategory
      ? {
          id: state.impactCategory.id,
          name: state.impactCategory.name,
          rangeLabel: state.impactCategory.rangeLabel,
          description: state.impactCategory.description
        }
      : null;

    snapshot.impactCategory = impactCategorySummary;

    return {
      yieldMegatons: state.yieldMegatons,
      latitude: state.latitude,
      longitude: state.longitude,
      effectBands: state.effectBands,
      timeToImpactSeconds: state.timeToImpactSeconds,
      name: state.name,
      impactCategory: impactCategorySummary
    };
  }

  function update({ orbitFrames } = {}) {
    if (!currentState) {
      return null;
    }

    const frame = orbitFrames ?? currentState.previousOrbitFrame ?? 0;
    currentState.previousOrbitFrame = frame;

    const targetFrame = Math.min(frame, currentState.impactEpochFrame);
    const { position } = propagateKepler(currentState.keplerElements, targetFrame);
    orbitPositionToScene(position, currentState.mesh.position);

    if (frame >= currentState.impactEpochFrame) {
      currentState.impacted = true;
      currentState.mesh.position.copy(currentState.impactScenePosition);
    }

    const remainingFrames = Math.max(currentState.impactEpochFrame - frame, 0);
    const remainingSeconds = remainingFrames * SECONDS_PER_FRAME;

    snapshot.remainingSeconds = remainingSeconds;
    snapshot.impacted = currentState.impacted;

    return getSnapshot();
  }

  return {
    spawn,
    reset,
    update,
    getSnapshot
  };
}

export {
  createImpactorManager,
  computeYieldMegatons
};
