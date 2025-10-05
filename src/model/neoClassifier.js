import { InferenceSession, Tensor, env } from 'onnxruntime-web';
import modelUrl from './astratek_model.onnx?url';
import { FEATURE_ORDER, FEATURE_MEAN, standardizeFeatureVector } from './featureSchema.js';

const ORT_WEB_VERSION = '1.23.0'; // keep in sync with package.json

env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_WEB_VERSION}/dist/`;

let sessionPromise = null;
let inferenceQueue = Promise.resolve();

function enqueueInference(operation) {
  const next = inferenceQueue.then(operation, operation);
  inferenceQueue = next.catch(() => {});
  return next;
}

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
  const baseVector = new Float32Array(FEATURE_ORDER.length);

  FEATURE_ORDER.forEach((name, index) => {
    const rawValue = features?.[name];
    if (Number.isFinite(rawValue)) {
      baseVector[index] = rawValue;
      return;
    }

    const meanFallback = FEATURE_MEAN[index];
    baseVector[index] = Number.isFinite(meanFallback) ? meanFallback : 0;
  });

  const standardized = standardizeFeatureVector(baseVector);
  return new Tensor('float32', standardized, [1, standardized.length]);
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
  return enqueueInference(async () => {
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
  });
}

export { classifyAsteroid, FEATURE_ORDER };
