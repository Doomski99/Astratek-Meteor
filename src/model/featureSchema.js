import scalerParams from './scaler.json';

const FEATURE_ORDER = [
  'diameter',
  'diameter_sigma',
  'e',
  'a',
  'i',
  'om',
  'w',
  'ma',
  'n',
  'sigma_e',
  'sigma_a',
  'sigma_i',
  'sigma_om',
  'sigma_w',
  'sigma_ma',
  'sigma_n',
  'H',
  'H_sigma',
  'moid'
];

const FEATURE_MEAN = Float32Array.from(scalerParams?.mean ?? []);
const FEATURE_SCALE = Float32Array.from(scalerParams?.scale ?? []);

function getSafeMean(index) {
  const value = FEATURE_MEAN[index];
  return Number.isFinite(value) ? value : 0;
}

function getSafeScale(index) {
  const value = FEATURE_SCALE[index];
  if (Number.isFinite(value) && Math.abs(value) > 1e-8) {
    return value;
  }
  return 1;
}

function standardizeFeatureVector(vector) {
  const scaled = new Float32Array(vector.length);

  for (let i = 0; i < vector.length; i += 1) {
    const mean = getSafeMean(i);
    const scale = getSafeScale(i);
    scaled[i] = (vector[i] - mean) / scale;
  }

  return scaled;
}

export { FEATURE_ORDER, FEATURE_MEAN, FEATURE_SCALE, standardizeFeatureVector };
