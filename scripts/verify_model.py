#!/usr/bin/env python3
"""Offline verification helper for the asteroid ONNX classifier."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Dict, Iterable, List, Sequence

import numpy as np
import onnxruntime as ort

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CATALOG = REPO_ROOT / 'static' / 'data' / 'asteroids.csv'
DEFAULT_MODEL = REPO_ROOT / 'src' / 'model' / 'astratek_model.onnx'
SCALER_PATH = REPO_ROOT / 'src' / 'model' / 'scaler.json'

with SCALER_PATH.open('r', encoding='utf-8') as scaler_file:
    scaler_params = json.load(scaler_file)

FEATURE_ORDER: Sequence[str] = [
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
    'moid',
]

SCALER_MEAN = np.array(scaler_params.get('mean', []), dtype=np.float32)
SCALER_SCALE = np.array(scaler_params.get('scale', []), dtype=np.float32)
SAFE_SCALE = np.where(np.abs(SCALER_SCALE) > 1e-8, SCALER_SCALE, 1.0)


def parse_float(value: str | float | None) -> float | None:
    if value is None:
        return None

    if isinstance(value, (int, float)):
        return float(value)

    try:
        stripped = value.strip()
    except AttributeError:
        return None

    if stripped == '' or stripped.lower() == 'nan':
        return None

    try:
        return float(stripped)
    except ValueError:
        return None


def build_feature_vector(row: Dict[str, str]) -> np.ndarray:
    values = np.zeros(len(FEATURE_ORDER), dtype=np.float32)

    for index, name in enumerate(FEATURE_ORDER):
        parsed = parse_float(row.get(name))
        if parsed is None:
            fallback = SCALER_MEAN[index] if np.isfinite(SCALER_MEAN[index]) else 0.0
            values[index] = float(fallback)
        else:
            values[index] = parsed

    if values[0] > 0 and values[1] <= 0:
        values[1] = max(values[0] * 0.05, 0.01)

    return (values - SCALER_MEAN) / SAFE_SCALE


def load_catalog(path: Path) -> List[Dict[str, str]]:
    with path.open('r', encoding='utf-8', newline='') as csv_file:
        reader = csv.DictReader(csv_file)
        return [row for row in reader]


def sigmoid_array(logits: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-logits))


def classify_rows(
    session: ort.InferenceSession,
    rows: Sequence[Dict[str, str]],
) -> np.ndarray:
    input_name = session.get_inputs()[0].name
    feature_matrix = np.stack([build_feature_vector(row) for row in rows]).astype(np.float32)
    logits = session.run(None, {input_name: feature_matrix})[0]
    return sigmoid_array(logits)


def summarise_results(
    rows: Sequence[Dict[str, str]],
    probabilities: np.ndarray,
    threshold: float,
) -> List[Dict[str, object]]:
    summaries: List[Dict[str, object]] = []

    for row, probs in zip(rows, probabilities):
        neo_prob = float(probs[0])
        pha_prob = float(probs[1])
        summaries.append(
            {
                'id': (row.get('spkid') or row.get('id') or '').strip(),
                'name': (row.get('full_name') or row.get('name') or '').strip(),
                'neo_probability': neo_prob,
                'pha_probability': pha_prob,
                'neo_prediction': 'Y' if neo_prob >= threshold else 'N',
                'pha_prediction': 'Y' if pha_prob >= threshold else 'N',
            }
        )

    return summaries


def format_percentage(value: float) -> str:
    percent = value * 100
    if percent > 0 and percent < 0.01:
        return '<0.01%'
    if percent < 100 and percent > 99.99:
        return '>99.99%'
    precision = 2 if percent < 10 else 1
    return f'{percent:.{precision}f}%'


def print_summary_table(rows: Iterable[Dict[str, object]], limit: int, sort_key: str) -> None:
    sorted_rows = sorted(rows, key=lambda entry: entry.get(sort_key, 0), reverse=True)
    header = f"Top {limit} asteroids by {sort_key.replace('_', ' ')}"
    print(header)
    print('-' * len(header))
    print(f"{'ID':>10}  {'Name':<28}  {'NEO':>6}  {'PHA':>6}  {'NEO%':>8}  {'PHA%':>8}")

    for entry in sorted_rows[:limit]:
        neo_pct = format_percentage(float(entry['neo_probability']))
        pha_pct = format_percentage(float(entry['pha_probability']))
        print(
            f"{entry['id']:>10}  {entry['name']:<28}  "
            f"{entry['neo_prediction']:>6}  {entry['pha_prediction']:>6}  "
            f"{neo_pct:>8}  {pha_pct:>8}"
        )


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description='Run the ONNX classifier against the asteroid catalog.'
    )
    parser.add_argument(
        '--catalog',
        type=Path,
        default=DEFAULT_CATALOG,
        help=f'Path to the asteroid CSV (default: {DEFAULT_CATALOG})',
    )
    parser.add_argument(
        '--model',
        type=Path,
        default=DEFAULT_MODEL,
        help=f'Path to the ONNX model (default: {DEFAULT_MODEL})',
    )
    parser.add_argument(
        '--threshold',
        type=float,
        default=0.5,
        help='Probability threshold for yes/no predictions (default: 0.5)',
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=10,
        help='Number of rows to print in the summary table (default: 10)',
    )
    parser.add_argument(
        '--sort',
        choices=['neo_probability', 'pha_probability'],
        default='neo_probability',
        help='Which probability to sort by before printing (default: neo_probability)',
    )
    return parser


def main() -> None:
    parser = create_parser()
    args = parser.parse_args()

    rows = load_catalog(args.catalog)
    if not rows:
        raise SystemExit(f'No rows found in {args.catalog}')

    session = ort.InferenceSession(args.model.as_posix())
    probabilities = classify_rows(session, rows)
    summaries = summarise_results(rows, probabilities, threshold=args.threshold)

    print_summary_table(summaries, args.limit, args.sort)


if __name__ == '__main__':
    main()
