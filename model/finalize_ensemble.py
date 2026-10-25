"""Evaluate a selected ensemble once on its sealed patient-separated test set."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from train import CLASSES, DATA, metrics
from train_dino import feature_frame


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("run_dir", type=Path)
    args = parser.parse_args()
    report_path = args.run_dir / "report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if isinstance(report.get("test"), dict):
        raise RuntimeError("This run's test set has already been evaluated")
    split = pd.read_csv(args.run_dir / "split.csv")
    metadata = pd.read_csv(DATA / "metadata.csv")
    test = metadata.merge(split.loc[split.split == "test", ["img_id", "patient_id"]],
                          on=["img_id", "patient_id"], validate="one_to_one")
    features = np.load(DATA / "dinov2_small_features.npz")
    positions = {name: n for n, name in enumerate(features["img_id"])}
    x = feature_frame(test, features["embedding"], positions, "full")
    model = joblib.load(args.run_dir / "ensemble.joblib")
    weight = model["logistic_weight"]
    probabilities = (weight * model["logistic"].predict_proba(x)[:, 1]
                     + (1 - weight) * model["svm"].predict_proba(x)[:, 1])
    labels = test.diagnostic.isin(report["positive_labels"]).astype(int).to_numpy()
    threshold = report["validation"]["threshold"]
    report["test"] = metrics(labels, probabilities, threshold)
    report["test_by_diagnosis"] = {
        diagnosis: {
            "n": int(sum(test.diagnostic == diagnosis)),
            "flagged": int(sum((probabilities >= threshold) & (test.diagnostic.to_numpy() == diagnosis))),
        }
        for diagnosis in sorted(CLASSES)
    }
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
