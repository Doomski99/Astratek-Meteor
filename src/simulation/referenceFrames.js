import * as THREE from 'three';

const earthVelocityOrbital = new THREE.Vector3();
const earthVelocityKilometersPerSecond = new THREE.Vector3();

const earthVelocitySnapshot = {
  orbital: { x: 0, y: 0, z: 0 },
  kilometersPerSecond: { x: 0, y: 0, z: 0 },
  speedKilometersPerSecond: 0
};

function copyVectorComponents(target, source) {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
}

function applySourceToVector(target, source) {
  if (source instanceof THREE.Vector3) {
    target.copy(source);
    return;
  }

  const x = Number.isFinite(source?.x) ? source.x : 0;
  const y = Number.isFinite(source?.y) ? source.y : 0;
  const z = Number.isFinite(source?.z) ? source.z : 0;
  target.set(x, y, z);
}

function updateEarthVelocity({ orbital, kilometersPerSecond } = {}) {
  applySourceToVector(earthVelocityOrbital, orbital);
  copyVectorComponents(earthVelocitySnapshot.orbital, earthVelocityOrbital);

  applySourceToVector(earthVelocityKilometersPerSecond, kilometersPerSecond);
  copyVectorComponents(earthVelocitySnapshot.kilometersPerSecond, earthVelocityKilometersPerSecond);
  earthVelocitySnapshot.speedKilometersPerSecond = earthVelocityKilometersPerSecond.length();
}

function resetEarthVelocity() {
  earthVelocityOrbital.set(0, 0, 0);
  earthVelocityKilometersPerSecond.set(0, 0, 0);
  copyVectorComponents(earthVelocitySnapshot.orbital, earthVelocityOrbital);
  copyVectorComponents(earthVelocitySnapshot.kilometersPerSecond, earthVelocityKilometersPerSecond);
  earthVelocitySnapshot.speedKilometersPerSecond = 0;
}

const earthVelocityVectors = {
  orbital: earthVelocityOrbital,
  kilometersPerSecond: earthVelocityKilometersPerSecond
};

function getEarthVelocityVectors() {
  return earthVelocityVectors;
}

function getEarthVelocitySnapshot() {
  return earthVelocitySnapshot;
}

export {
  updateEarthVelocity,
  resetEarthVelocity,
  getEarthVelocityVectors,
  getEarthVelocitySnapshot
};
