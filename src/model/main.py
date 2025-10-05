import numpy as np
import onnxruntime as ort
from typing import Dict, List, Optional, Tuple

def load_scaler_npz(path: str) -> Tuple[np.ndarray, np.ndarray]:
    """Load scaler mean/scale saved with numpy.savez (keys: 'mean','scale')."""
    npz = np.load(path)
    return npz['mean'].astype(np.float32), npz['scale'].astype(np.float32)

def preprocess_row(feature_dict: Dict[str, float],
                   feature_order: List[str],
                   mean: Optional[np.ndarray] = None,
                   scale: Optional[np.ndarray] = None) -> np.ndarray:
    """
    Convert single-row features (dict) into a (1, n_features) float32 array
    following feature_order. If mean/scale provided, apply StandardScaler:
      (x - mean) / scale
    Missing features are filled with mean (if given) or 0.0.
    """
    vals = []
    for i, fname in enumerate(feature_order):
        v = feature_dict.get(fname, np.nan)
        if np.isnan(v):
            if mean is not None:
                v = float(mean[i])
            else:
                v = 0.0
        vals.append(float(v))
    arr = np.asarray(vals, dtype=np.float32).reshape(1, -1)
    if mean is not None and scale is not None:
        arr = (arr - mean.reshape(1, -1)) / (scale.reshape(1, -1) + 1e-12)
    return arr

def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))

def predict_one_onnx(model_path: str,
                     feature_dict: Dict[str, float],
                     feature_order: List[str],
                     scaler_npz: Optional[str] = None,
                     threshold: float = 0.5) -> Dict[str, Dict]:
    """
    Run ONNX inference for a single row provided as a dict.
    - model_path: path to astratek__model.onnx
    - feature_order: list of feature names in the same order used during training
    - scaler_npz: optional path to numpy .npz with 'mean' and 'scale' arrays
    Returns dict: {'neo': {'pred':'Y'/'N','prob':float}, 'pha': {...}}
    """
    mean = scale = None
    if scaler_npz:
        mean, scale = load_scaler_npz(scaler_npz)

    x = preprocess_row(feature_dict, feature_order, mean, scale)  # (1, n)
    sess = ort.InferenceSession(model_path)
    inp_name = sess.get_inputs()[0].name
    outputs = sess.run(None, {inp_name: x})
    logits = np.asarray(outputs[0], dtype=np.float32)  # shape (1,2) expected
    probs = sigmoid(logits).reshape(-1)
    preds = (probs >= threshold).astype(int)

    def label(b: int) -> str:
        return 'Y' if int(b) == 1 else 'N'

    return {
        'neo': {'pred': label(preds[0]), 'prob': float(probs[0])},
        'pha': {'pred': label(preds[1]), 'prob': float(probs[1])}
    }

# Example usage (called from web handler):
# feature_order = ['col1','col2',... ]  # must match training order
# incoming_row = {'col1': 0.12, 'col2': 3.4, ...}
# result = predict_one_onnx("astratek__model.onnx", incoming_row, feature_order, scaler_npz="scaler.npz", threshold=0.6)
# print(result)