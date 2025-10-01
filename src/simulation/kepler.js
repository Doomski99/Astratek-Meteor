const TWO_PI = Math.PI * 2;
const DEG2RAD = Math.PI / 180;

function normalizeAngle(angle) {
  return angle - TWO_PI * Math.floor((angle + Math.PI) / TWO_PI);
}

function solveKepler(eccentricity, meanAnomaly, { tolerance = 1e-9, maxIterations = 30 } = {}) {
  if (!isFinite(eccentricity) || !isFinite(meanAnomaly)) {
    return 0;
  }

  const e = Math.min(Math.max(eccentricity, 0), 0.999999999999);
  const m = normalizeAngle(meanAnomaly);
  let estimate = m;

  if (e > 0.8) {
    estimate = m < 0 ? -Math.PI : Math.PI;
  }

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const f = estimate - e * Math.sin(estimate) - m;
    const fPrime = 1 - e * Math.cos(estimate);
    const delta = f / fPrime;
    estimate -= delta;

    if (Math.abs(delta) < tolerance) {
      break;
    }
  }

  return estimate;
}

function createKeplerElements(orbit = {}) {
  const semiMajorAxis = orbit.semiMajorAxis ?? 0;
  const eccentricity = orbit.eccentricity ?? 0;
  const inclination = (orbit.inclination ?? 0) * DEG2RAD;
  const longitudeOfAscendingNode = (orbit.longitudeOfAscendingNode ?? 0) * DEG2RAD;
  const argumentOfPeriapsis = (orbit.argumentOfPeriapsis ?? 0) * DEG2RAD;
  const meanAnomalyAtEpoch = (orbit.meanAnomalyAtEpoch ?? 0) * DEG2RAD;
  const period = orbit.period;
  const providedMeanMotion = orbit.meanMotion;
  const meanMotion =
    typeof providedMeanMotion === 'number'
      ? providedMeanMotion
      : typeof period === 'number' && period !== 0
        ? TWO_PI / period
        : 0;
  const epoch = orbit.epoch ?? 0;
  const sqrtOneMinusESquared = Math.sqrt(Math.max(0, 1 - eccentricity * eccentricity));

  return {
    semiMajorAxis,
    eccentricity,
    inclination,
    longitudeOfAscendingNode,
    argumentOfPeriapsis,
    meanAnomalyAtEpoch,
    meanMotion,
    epoch,
    sqrtOneMinusESquared
  };
}

function propagateKepler(elements, time) {
  if (!elements) {
    return {
      position: { x: 0, y: 0, z: 0 },
      meanAnomaly: 0,
      eccentricAnomaly: 0,
      trueAnomaly: 0
    };
  }

  const meanMotion = elements.meanMotion ?? 0;
  const deltaTime = (time ?? 0) - (elements.epoch ?? 0);
  const meanAnomaly = elements.meanAnomalyAtEpoch + meanMotion * deltaTime;
  const eccentricAnomaly = solveKepler(elements.eccentricity ?? 0, meanAnomaly);
  const cosE = Math.cos(eccentricAnomaly);
  const sinE = Math.sin(eccentricAnomaly);
  const sqrtOneMinusESquared =
    elements.sqrtOneMinusESquared ?? Math.sqrt(Math.max(0, 1 - (elements.eccentricity ?? 0) ** 2));
  const xOrbit = elements.semiMajorAxis * (cosE - (elements.eccentricity ?? 0));
  const yOrbit = elements.semiMajorAxis * sqrtOneMinusESquared * sinE;

  const cosOmega = Math.cos(elements.longitudeOfAscendingNode ?? 0);
  const sinOmega = Math.sin(elements.longitudeOfAscendingNode ?? 0);
  const cosI = Math.cos(elements.inclination ?? 0);
  const sinI = Math.sin(elements.inclination ?? 0);
  const cosW = Math.cos(elements.argumentOfPeriapsis ?? 0);
  const sinW = Math.sin(elements.argumentOfPeriapsis ?? 0);

  const x =
    xOrbit * (cosOmega * cosW - sinOmega * sinW * cosI) +
    yOrbit * (-cosOmega * sinW - sinOmega * cosW * cosI);
  const y =
    xOrbit * (sinOmega * cosW + cosOmega * sinW * cosI) +
    yOrbit * (-sinOmega * sinW + cosOmega * cosW * cosI);
  const z = xOrbit * (sinW * sinI) + yOrbit * (cosW * sinI);

  const trueAnomaly = Math.atan2(sqrtOneMinusESquared * sinE, cosE - (elements.eccentricity ?? 0));

  return {
    position: { x, y, z },
    meanAnomaly,
    eccentricAnomaly,
    trueAnomaly
  };
}

export {
  normalizeAngle,
  solveKepler,
  createKeplerElements,
  propagateKepler
};
