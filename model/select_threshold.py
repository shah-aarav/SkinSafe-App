"""Select a decision threshold from validation predictions; never touches test."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from train import DATA, POSITIVE, metrics
from train_dino import feature_frame


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("run_dir", type=Path)
    parser.add_argument("--minimum-sensitivity", type=float, default=0.90)
    parser.add_argument("--commit", action="store_true")
    args = parser.parse_args()
    report_path = args.run_dir / "report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if isinstance(report.get("test"), dict):
        raise RuntimeError("Cannot change threshold after the test set was opened")

    df = pd.read_csv(DATA / "metadata.csv")
    split = pd.read_csv(args.run_dir / "split.csv")
    val = df.merge(split.loc[split.split == "val", ["img_id", "patient_id"]],
                   on=["img_id", "patient_id"], validate="one_to_one")
    features = np.load(DATA / "dinov2_small_features.npz")
    positions = {name: n for n, name in enumerate(features["img_id"])}
    x_val = feature_frame(val, features["embedding"], positions, report["clinical_features"])
    y_val = val.diagnostic.isin(POSITIVE).astype(int).to_numpy()
    model = joblib.load(args.run_dir / "classifier.joblib")
    probabilities = model.predict_proba(x_val)[:, 1]
    candidates = np.unique(np.r_[0.0, probabilities, 1.0])
    eligible = []
    for threshold in candidates:
        score = metrics(y_val, probabilities, threshold)
        if score["sensitivity_cancer"] >= args.minimum_sensitivity:
            eligible.append(score)
    best = max(eligible, key=lambda score: (
        score["accuracy"], score["sensitivity_cancer"], score["specificity_non_cancer"]
    ))
    print(json.dumps(best, indent=2))
    if args.commit:
        report["threshold_policy"] = f"max validation accuracy subject to sensitivity >= {args.minimum_sensitivity}"
        report["validation"] = best
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"Updated {report_path}")


if __name__ == "__main__":
    main()
