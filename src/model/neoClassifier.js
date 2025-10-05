import { InferenceSession, Tensor, env } from 'onnxruntime-web';
import modelUrl from './astratek_model.onnx?url';

const ORT_WEB_VERSION = '1.23.0'; // keep in sync with package.json

env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_WEB_VERSION}/dist/`;

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

let sessionPromise = null;

async function getSession() {
  if (!sessionPromise) {
    sessionPromise = InferenceSession.create(modelUrl, {
      executionProviders: ['wasm']
    });
  }

  return sessionPromise;
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function createInput(features) {
  const data = new Float32Array(FEATURE_ORDER.length);
  FEATURE_ORDER.forEach((name, index) => {
    const rawValue = features?.[name];
    data[index] = Number.isFinite(rawValue) ? rawValue : 0;
  });

  return new Tensor('float32', data, [1, data.length]);
}

function getFirstValue(mapLike) {
  if (!mapLike) {
    return null;
  }

  if (typeof mapLike.entries === 'function') {
    const iterator = mapLike.entries();
    const next = iterator.next();
    if (!next.done) {
      return next.value[1];
    }
  }

  const keys = Object.keys(mapLike);
  if (keys.length > 0) {
    return mapLike[keys[0]];
  }

  return null;
}

async function classifyAsteroid(features) {
  const session = await getSession();
  const inputName = session.inputNames?.[0];
  if (!inputName) {
    throw new Error('ONNX model input name could not be resolved.');
  }

  const feeds = { [inputName]: createInput(features) };

  const results = await session.run(feeds);
  const output = getFirstValue(results);
  const data = Array.from(output?.data ?? []);

  const neoProbability = data.length > 0 ? sigmoid(data[0]) : 0;
  const phaProbability = data.length > 1 ? sigmoid(data[1]) : 0;

  return {
    neoProbability,
    phaProbability,
    isNeo: neoProbability > 0.5,
    isPhaHazardous: phaProbability > 0.5
  };
}

export { classifyAsteroid, FEATURE_ORDER };
