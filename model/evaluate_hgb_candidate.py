"""Evaluate the preselected HGB recipe; reused held-out split is exploratory."""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

from experiment_strong_models import build, candidates, matrix, subtype_sens, threshold_score
from train import DATA, ROOT, SEED, metrics, split_patients


def main():
    rows = pd.read_csv(DATA / "metadata.csv")
    train, val, test = split_patients(rows)
    features = np.load(DATA / "dinov2_small_features.npz")
    positions = {name: i for i, name in enumerate(features["img_id"])}
    x_train, y_train = matrix(train, features["embedding"], positions)
    x_val, y_val = matrix(val, features["embedding"], positions)
    x_test, y_test = matrix(test, features["embedding"], positions)
    image_columns = [f"image_{i}" for i in range(features["embedding"].shape[1])]
    model = build(candidates(SEED)["hist_gradient_boost"], image_columns)
    model.fit(x_train, y_train)
    val_prob = model.predict_proba(x_val)[:, 1]
    threshold = threshold_score(y_val, val_prob)["threshold"]
    test_prob = model.predict_proba(x_test)[:, 1]
    report = {
        "model": "DINOv2-S frozen embeddings + HGB, full questionnaire",
        "selection": "HGB was shortlisted in patient-grouped training CV. Threshold chosen on validation at >=90% cancer sensitivity.",
        "caution": "The held-out split was previously opened for another model. This comparison is exploratory, not a fresh independent test.",
        "validation": metrics(y_val, val_prob, threshold),
        "test_reused": metrics(y_test, test_prob, threshold),
        "validation_roc_auc": float(roc_auc_score(y_val, val_prob)),
        "test_roc_auc": float(roc_auc_score(y_test, test_prob)),
        "validation_by_diagnosis": subtype_sens(val, val_prob, threshold),
        "test_by_diagnosis": subtype_sens(test, test_prob, threshold),
        "samples": {"train": len(train), "validation": len(val), "test": len(test)},
    }
    out = ROOT / "runs" / "hgb-candidate-20261016"
    out.mkdir(exist_ok=True)
    joblib.dump(model, out / "classifier.joblib")
    (out / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
