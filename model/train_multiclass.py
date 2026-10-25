"""Train a six-label SkinSafe candidate on the existing patient-separated split.

The test partition has already been opened for earlier binary experiments, so
its score here is exploratory. Model selection uses validation data only.
"""

from __future__ import annotations

import json
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, balanced_accuracy_score, classification_report, f1_score
from sklearn.pipeline import make_pipeline
from sklearn.svm import SVC

from train import DATA, ROOT, SEED, split_patients
from train_dino import feature_frame, preprocess


def score(model, x, y):
    predicted = model.predict(x)
    return {
        "accuracy": float(accuracy_score(y, predicted)),
        "balanced_accuracy": float(balanced_accuracy_score(y, predicted)),
        "macro_f1": float(f1_score(y, predicted, average="macro")),
        "per_class": classification_report(y, predicted, output_dict=True, zero_division=0),
    }


def main():
    df = pd.read_csv(DATA / "metadata.csv")
    features = np.load(DATA / "dinov2_small_features.npz")
    positions = {name: n for n, name in enumerate(features["img_id"])}
    if set(df.img_id) != set(positions):
        raise RuntimeError("Feature/image ID mismatch")
    train, val, test = split_patients(df)
    def matrix(rows):
        return feature_frame(rows, features["embedding"], positions, "full"), rows.diagnostic.to_numpy()
    x_train, y_train = matrix(train)
    x_val, y_val = matrix(val)
    x_test, y_test = matrix(test)
    image_columns = [f"image_{n}" for n in range(features["embedding"].shape[1])]

    candidates = []
    for c in (0.01, 0.1, 1.0):
        candidates.append((f"logistic_C_{c}", make_pipeline(
            preprocess("full", image_columns),
            LogisticRegression(C=c, class_weight="balanced", max_iter=3000, random_state=SEED),
        )))
    for c in (0.3, 1.0):
        candidates.append((f"svm_C_{c}", make_pipeline(
            preprocess("full", image_columns),
            SVC(C=c, kernel="rbf", class_weight="balanced", probability=True, random_state=SEED),
        )))

    results = []
    for name, model in candidates:
        model.fit(x_train, y_train)
        validation = score(model, x_val, y_val)
        print(name, {key: round(validation[key], 4) for key in ("accuracy", "balanced_accuracy", "macro_f1")}, flush=True)
        results.append((validation["macro_f1"], validation["accuracy"], name, model, validation))
    _, _, name, model, validation = max(results, key=lambda item: item[:2])
    exploratory_test = score(model, x_test, y_test)
    run_dir = ROOT / "runs" / datetime.now().strftime("%Y%m%d-%H%M%S-multiclass")
    run_dir.mkdir(parents=True, exist_ok=False)
    joblib.dump(model, run_dir / "classifier.joblib")
    report = {
        "task": "Six-category lesion classification, not clinical diagnosis",
        "dataset": "PAD-UFES-20",
        "labels": sorted(df.diagnostic.unique().tolist()),
        "split": "patient-separated, same split as binary model",
        "selected_model": name,
        "selection_metric": "validation macro F1, then validation accuracy",
        "validation": validation,
        "exploratory_reused_test": exploratory_test,
        "candidates": [{"name": item[2], "validation_macro_f1": item[4]["macro_f1"], "validation_accuracy": item[4]["accuracy"]} for item in results],
    }
    (run_dir / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Saved {run_dir}", flush=True)
    print("Exploratory reused-test:", {key: round(exploratory_test[key], 4) for key in ("accuracy", "balanced_accuracy", "macro_f1")}, flush=True)
    print("Per-class recall:", {label: round(exploratory_test["per_class"][label]["recall"], 4) for label in report["labels"]}, flush=True)


if __name__ == "__main__":
    main()
