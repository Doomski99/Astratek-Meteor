import * as THREE from 'three';
import { propagateKepler } from './kepler.js';
import { KILOMETERS_PER_SCENE_UNIT, SECONDS_PER_FRAME } from './scales.js';

const DEFAULT_ORBIT_SEGMENTS = 256;
const SCENE_TO_KILOMETERS_PER_SECOND = KILOMETERS_PER_SCENE_UNIT / SECONDS_PER_FRAME;

function orbitVectorToScene({ x = 0, y = 0, z = 0 }, target = new THREE.Vector3()) {
  target.set(x, z, -y);
  return target;
}

function orbitPositionToScene(position = {}, target = new THREE.Vector3()) {
  const x = position.x ?? 0;
  const y = position.y ?? 0;
  const z = position.z ?? 0;
  target.set(x, z, -y);
  return target;
}

function sampleKeplerOrbitWithMeta(elements, segments = DEFAULT_ORBIT_SEGMENTS) {
  if (!elements) {
    return [];
  }

  const clampedSegments = Math.max(16, Math.floor(segments));
  const meanAnomalyAtEpoch = elements.meanAnomalyAtEpoch ?? 0;
  const epoch = elements.epoch ?? 0;
  const meanMotion = elements.meanMotion ?? 0;
  const hasMeanMotion = Number.isFinite(meanMotion) && Math.abs(meanMotion) > 1e-12;
  const points = [];
  const TWO_PI = Math.PI * 2;

  for (let index = 0; index <= clampedSegments; index += 1) {
    const progress = index / clampedSegments;
    const targetMeanAnomaly = meanAnomalyAtEpoch + TWO_PI * progress;

    let elementsForSample = elements;
    let timeForSample = epoch;

    if (hasMeanMotion) {
      timeForSample = epoch + (targetMeanAnomaly - meanAnomalyAtEpoch) / meanMotion;
    } else {
      elementsForSample = { ...elements, meanAnomalyAtEpoch: targetMeanAnomaly };
    }

    const { position } = propagateKepler(elementsForSample, timeForSample);
    const vector = new THREE.Vector3();
    orbitPositionToScene(position, vector);
    points.push({
      position: vector,
      index,
      time: timeForSample,
      meanAnomaly: targetMeanAnomaly
    });
  }

  return points;
}

function sampleKeplerOrbit(elements, segments = DEFAULT_ORBIT_SEGMENTS) {
  return sampleKeplerOrbitWithMeta(elements, segments).map(sample => sample.position);
}

function estimateOrbitalVelocity(
  elements,
  time,
  { deltaFrames = 0.01, orbitalTarget, kilometersPerSecondTarget } = {}
) {
  const orbitalVector = orbitalTarget ?? new THREE.Vector3();
  const kilometersPerSecondVector =
    kilometersPerSecondTarget === null
      ? null
      : kilometersPerSecondTarget ?? new THREE.Vector3();

  orbitalVector.set(0, 0, 0);
  if (kilometersPerSecondVector) {
    kilometersPerSecondVector.set(0, 0, 0);
  }

  if (!elements) {
    return { orbital: orbitalVector, kilometersPerSecond: kilometersPerSecondVector };
  }

  const frameTime = time ?? 0;
  const clampedDelta = Math.max(Math.abs(deltaFrames), 1e-4);
  const halfWindow = clampedDelta;

  const previousState = propagateKepler(elements, frameTime - halfWindow);
  const nextState = propagateKepler(elements, frameTime + halfWindow);

  const prevPosition = previousState.position ?? { x: 0, y: 0, z: 0 };
  const nextPosition = nextState.position ?? { x: 0, y: 0, z: 0 };
  const invTwoDelta = 1 / (2 * halfWindow);

  const vxScene = (nextPosition.x - prevPosition.x) * invTwoDelta;
  const vyScene = (nextPosition.y - prevPosition.y) * invTwoDelta;
  const vzScene = (nextPosition.z - prevPosition.z) * invTwoDelta;

  orbitalVector.set(vxScene, vyScene, vzScene);

  if (kilometersPerSecondVector) {
    kilometersPerSecondVector.set(
      vxScene * SCENE_TO_KILOMETERS_PER_SECOND,
      vyScene * SCENE_TO_KILOMETERS_PER_SECOND,
      vzScene * SCENE_TO_KILOMETERS_PER_SECOND
    );
  }

  return { orbital: orbitalVector, kilometersPerSecond: kilometersPerSecondVector };
}

function estimateOrbitIntersection(
  elementsA,
  elementsB,
  {
    segments = DEFAULT_ORBIT_SEGMENTS,
    tolerance = 0,
    orbitASamples,
    orbitBSamples
  } = {}
) {
  if (!elementsA || !elementsB) {
    return { intersects: false, minimumDistance: Infinity };
  }

  const samplesA = Array.isArray(orbitASamples) && orbitASamples.length > 0
    ? orbitASamples
    : sampleKeplerOrbitWithMeta(elementsA, segments);
  const samplesB = Array.isArray(orbitBSamples) && orbitBSamples.length > 0
    ? orbitBSamples
    : sampleKeplerOrbitWithMeta(elementsB, segments);

  if (!samplesA.length || !samplesB.length) {
    return { intersects: false, minimumDistance: Infinity };
  }

  const toleranceSquared = tolerance * tolerance;
  let minimumDistanceSquared = Infinity;
  let closestPointA = null;
  let closestPointB = null;
  let closestSampleA = null;
  let closestSampleB = null;
  let closestSampleIndexA = null;
  let closestSampleIndexB = null;

  const getSamplePosition = sample => {
    if (!sample) {
      return null;
    }

    if (sample instanceof THREE.Vector3) {
      return sample;
    }

    if (sample.position instanceof THREE.Vector3) {
      return sample.position;
    }

    return null;
  };

  for (let indexA = 0; indexA < samplesA.length; indexA += 1) {
    const sampleA = samplesA[indexA];
    const pointA = getSamplePosition(sampleA);

    if (!pointA) {
      continue;
    }

    for (let indexB = 0; indexB < samplesB.length; indexB += 1) {
      const sampleB = samplesB[indexB];
      const pointB = getSamplePosition(sampleB);

      if (!pointB) {
        continue;
      }
      const distanceSquared = pointA.distanceToSquared(pointB);

      if (distanceSquared < minimumDistanceSquared) {
        minimumDistanceSquared = distanceSquared;
        closestPointA = pointA.clone();
        closestPointB = pointB.clone();
        closestSampleA = sampleA;
        closestSampleB = sampleB;
        closestSampleIndexA = sampleA?.index ?? indexA;
        closestSampleIndexB = sampleB?.index ?? indexB;
      }

      if (minimumDistanceSquared <= toleranceSquared) {
        return {
          intersects: true,
          minimumDistance: Math.sqrt(minimumDistanceSquared),
          closestPointA,
          closestPointB,
          closestSampleA,
          closestSampleB,
          closestSampleIndexA,
          closestSampleIndexB
        };
      }
    }
  }

  return {
    intersects: minimumDistanceSquared <= toleranceSquared,
    minimumDistance: Math.sqrt(minimumDistanceSquared),
    closestPointA,
    closestPointB,
    closestSampleA,
    closestSampleB,
    closestSampleIndexA,
    closestSampleIndexB
  };
}

export {
  orbitPositionToScene,
  orbitVectorToScene,
  sampleKeplerOrbit,
  sampleKeplerOrbitWithMeta,
  estimateOrbitalVelocity,
  estimateOrbitIntersection
};
