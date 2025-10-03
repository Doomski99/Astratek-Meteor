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

const MEGATON_JOULES = 4.184e15;
const EARTH_RADIUS_KILOMETERS = 6371;
const DEFAULT_START_DISTANCE_MULTIPLIER = 28;

const tempEarthWorldPosition = new THREE.Vector3();

function computeYieldMegatons(massKg, velocityKmPerSecond) {
  const speedMetersPerSecond = velocityKmPerSecond * 1000;
  const energyJoules = 0.5 * massKg * speedMetersPerSecond * speedMetersPerSecond;
  return energyJoules / MEGATON_JOULES;
}

function computeEffectBands(yieldMegatons) {
  const safeYield = Math.max(yieldMegatons, 0.001);
  const yieldCubeRoot = Math.cbrt(safeYield);
  const yieldExponentFourTenths = Math.pow(safeYield, 0.4);

  const bands = [
    {
      id: 'fireball',
      label: 'Fireball',
      radiusKm: 0.9 * yieldExponentFourTenths,
      color: 0xffa726,
      opacity: 0.35
    },
    {
      id: 'severe-blast',
      label: 'Severe Blast Damage',
      radiusKm: 2.4 * yieldCubeRoot,
      color: 0xff7043,
      opacity: 0.25
    },
    {
      id: 'moderate-blast',
      label: 'Moderate Blast Damage',
      radiusKm: 4.1 * yieldCubeRoot,
      color: 0xf4511e,
      opacity: 0.2
    },
    {
      id: 'thermal',
      label: 'Thermal Radiation',
      radiusKm: 7.2 * yieldExponentFourTenths,
      color: 0xffcc80,
      opacity: 0.18
    }
  ];

  return bands
    .map(band => ({
      ...band,
      angularRadiusRad: Math.min((band.radiusKm / EARTH_RADIUS_KILOMETERS) || 0, Math.PI)
    }))
    .filter(band => band.radiusKm > 0.01 && band.angularRadiusRad > 0);
}

function buildImpactorState({
  scene,
  earthMesh,
  config,
  currentOrbitFrame
}) {
  const {
    name,
    massKg,
    diameterMeters,
    velocityKmPerSecond,
    startDistanceMultiplier = DEFAULT_START_DISTANCE_MULTIPLIER
  } = config;

  const yieldMegatons = computeYieldMegatons(massKg, velocityKmPerSecond);
  const effectBands = computeEffectBands(yieldMegatons);

  const latitude = THREE.MathUtils.randFloatSpread(180);
  const longitude = THREE.MathUtils.randFloatSpread(360);
  const latRad = THREE.MathUtils.degToRad(latitude);
  const lonRad = THREE.MathUtils.degToRad(longitude);

  const impactNormal = new THREE.Vector3(
    Math.cos(latRad) * Math.cos(lonRad),
    Math.sin(latRad),
    Math.cos(latRad) * Math.sin(lonRad)
  ).normalize();

  const earthRadius = EARTH_RADIUS_SCENE_UNITS;
  const startDistance = earthRadius * Math.max(startDistanceMultiplier, 2);
  const impactPointRelative = impactNormal.clone().multiplyScalar(earthRadius);
  const startRelativePosition = impactNormal.clone().multiplyScalar(-startDistance);

  const speedSceneUnitsPerSecond = velocityKmPerSecond / KILOMETERS_PER_SCENE_UNIT;
  const relativeVelocity = impactPointRelative
    .clone()
    .sub(startRelativePosition)
    .normalize()
    .multiplyScalar(speedSceneUnitsPerSecond);

  const overlayEntry = {
    data: { tntYieldMt: yieldMegatons },
    earthOrbitIntersection: {
      intersects: true,
      impactNormal,
      impactPoint: impactPointRelative.clone()
    }
  };

  const overlay = createImpactOverlayMesh(overlayEntry, earthRadius, {
    bands: effectBands
  });

  if (overlay) {
    (earthMesh ?? scene).add(overlay);
  }

  const trajectoryLine = createTrajectoryLine([
    startRelativePosition.clone(),
    impactPointRelative.clone()
  ]);
  if (trajectoryLine) {
    trajectoryLine.material.color.setHex(0xff7043);
    trajectoryLine.material.opacity = 0.85;
    trajectoryLine.material.needsUpdate = true;
    trajectoryLine.userData.impactorTrajectory = true;
    (earthMesh ?? scene).add(trajectoryLine);
  }

  const diameterKilometers = diameterMeters / 1000;
  const radiusSceneUnits = Math.min(
    Math.max((diameterKilometers / KILOMETERS_PER_SCENE_UNIT) / 2, 0.05),
    2.5
  );

  const geometry = new THREE.IcosahedronGeometry(radiusSceneUnits, 2);
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

  if (earthMesh) {
    earthMesh.getWorldPosition(tempEarthWorldPosition);
  } else {
    tempEarthWorldPosition.set(0, 0, 0);
  }

  mesh.position.copy(tempEarthWorldPosition).add(startRelativePosition);
  scene.add(mesh);

  return {
    mesh,
    overlay,
    trajectoryLine,
    effectBands,
    yieldMegatons,
    impactNormal,
    impactPointRelative,
    relativePosition: startRelativePosition,
    relativeVelocity,
    speedSceneUnitsPerSecond,
    startDistance,
    name: name || 'Impactor',
    massKg,
    diameterMeters,
    velocityKmPerSecond,
    latitude,
    longitude,
    timeToImpactSeconds:
      speedSceneUnitsPerSecond > 0
        ? Math.max(startDistance - earthRadius, 0) / speedSceneUnitsPerSecond
        : Infinity,
    impacted: false,
    previousOrbitFrame: currentOrbitFrame ?? 0
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

function createImpactorManager({ scene, earthMesh }) {
  let currentState = null;
  const snapshot = {
    remainingSeconds: null,
    impacted: false,
    latitude: null,
    longitude: null,
    yieldMegatons: null,
    effectBands: [],
    name: null
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
      name: snapshot.name
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
    return true;
  }

  function spawn(config, { currentOrbitFrame } = {}) {
    reset();

    const state = buildImpactorState({
      scene,
      earthMesh,
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

    return {
      yieldMegatons: state.yieldMegatons,
      latitude: state.latitude,
      longitude: state.longitude,
      effectBands: state.effectBands,
      timeToImpactSeconds: state.timeToImpactSeconds,
      name: state.name
    };
  }

  function update({ orbitFrames } = {}) {
    if (!currentState) {
      return null;
    }

    const currentOrbit = orbitFrames ?? currentState.previousOrbitFrame;
    const deltaFrames = currentOrbit - (currentState.previousOrbitFrame ?? currentOrbit);
    currentState.previousOrbitFrame = currentOrbit;

    const deltaSeconds = deltaFrames * SECONDS_PER_FRAME;
    if (deltaSeconds > 0 && !currentState.impacted) {
      currentState.relativePosition.addScaledVector(currentState.relativeVelocity, deltaSeconds);
      const distance = currentState.relativePosition.length();
      const earthRadius = EARTH_RADIUS_SCENE_UNITS;
      if (distance <= earthRadius) {
        currentState.relativePosition.copy(currentState.impactNormal).multiplyScalar(earthRadius);
        currentState.impacted = true;
      }
    }

    if (earthMesh) {
      earthMesh.getWorldPosition(tempEarthWorldPosition);
    } else {
      tempEarthWorldPosition.set(0, 0, 0);
    }

    if (currentState.mesh) {
      currentState.mesh.position.copy(tempEarthWorldPosition).add(currentState.relativePosition);
    }

    const earthRadius = EARTH_RADIUS_SCENE_UNITS;
    const distanceToSurface = Math.max(currentState.relativePosition.length() - earthRadius, 0);
    const remainingSeconds =
      currentState.speedSceneUnitsPerSecond > 0
        ? distanceToSurface / currentState.speedSceneUnitsPerSecond
        : 0;

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
