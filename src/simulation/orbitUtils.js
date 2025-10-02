import * as THREE from 'three';
import { propagateKepler } from './kepler.js';

const DEFAULT_ORBIT_SEGMENTS = 256;

function orbitPositionToScene(position = {}, target = new THREE.Vector3()) {
  const x = position.x ?? 0;
  const y = position.y ?? 0;
  const z = position.z ?? 0;
  target.set(x, z, -y);
  return target;
}

function sampleKeplerOrbit(elements, segments = DEFAULT_ORBIT_SEGMENTS) {
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
    points.push(vector);
  }

  return points;
}

export { orbitPositionToScene, sampleKeplerOrbit };
