"""Train a two-classifier, image-plus-clinical ensemble on patient-separated data."""

from __future__ import annotations

import json
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.svm import SVC

from train import DATA, POSITIVE, ROOT, SEED, metrics, split_patients
from train_dino import feature_frame, preprocess


def threshold_for_validation(y, probabilities, min_sensitivity=0.90):
    candidates = np.unique(np.r_[0.0, probabilities, 1.0])
    scores = [metrics(y, probabilities, t) for t in candidates]
    eligible = [s for s in scores if s["sensitivity_cancer"] >= min_sensitivity]
    return max(eligible, key=lambda s: (s["accuracy"], s["sensitivity_cancer"]))


def main():
    df = pd.read_csv(DATA / "metadata.csv")
    features = np.load(DATA / "dinov2_small_features.npz")
    positions = {name: n for n, name in enumerate(features["img_id"])}
    train, val, test = split_patients(df)
    x_train = feature_frame(train, features["embedding"], positions, "full")
    x_val = feature_frame(val, features["embedding"], positions, "full")
    y_train = train.diagnostic.isin(POSITIVE).astype(int).to_numpy()
    y_val = val.diagnostic.isin(POSITIVE).astype(int).to_numpy()
    image_columns = [f"image_{n}" for n in range(features["embedding"].shape[1])]

    logistic = make_pipeline(preprocess("full", image_columns), LogisticRegression(
        C=0.01, class_weight="balanced", max_iter=2000, random_state=SEED
    ))
    svm = make_pipeline(preprocess("full", image_columns), SVC(
        C=1.0, kernel="rbf", class_weight="balanced", probability=True, random_state=SEED
    ))
    logistic.fit(x_train, y_train)
    svm.fit(x_train, y_train)
    p_logistic = logistic.predict_proba(x_val)[:, 1]
    p_svm = svm.predict_proba(x_val)[:, 1]
    candidates = []
    for weight in np.arange(0.0, 1.01, 0.1):
        probabilities = weight * p_logistic + (1 - weight) * p_svm
        score = threshold_for_validation(y_val, probabilities)
        print(f"logistic_weight={weight:.1f}: {score}", flush=True)
        candidates.append((score["accuracy"], score["sensitivity_cancer"],
                           score["roc_auc"], weight, score))
    _, _, _, best_weight, best_score = max(candidates, key=lambda item: item[:3])

    run_dir = ROOT / "runs" / datetime.now().strftime("%Y%m%d-%H%M%S-ensemble-full")
    run_dir.mkdir(parents=True, exist_ok=False)
    joblib.dump({"logistic": logistic, "svm": svm, "logistic_weight": best_weight},
                run_dir / "ensemble.joblib")
    pd.DataFrame({
        "img_id": df.img_id,
        "patient_id": df.patient_id,
        "split": np.select([df.img_id.isin(train.img_id), df.img_id.isin(val.img_id)],
                           ["train", "val"], default="test"),
    }).to_csv(run_dir / "split.csv", index=False)
    report = {
        "dataset": "PAD-UFES-20",
        "model": "DINOv2-S image embeddings plus self-reported clinical fields; logistic/SVM ensemble",
        "clinical_features": "full",
        "positive_labels": sorted(POSITIVE),
        "seed": SEED,
        "threshold_policy": "max validation accuracy subject to cancer sensitivity >= 0.90",
        "validation": best_score,
        "test": "sealed until model and threshold are selected",
    }
    (run_dir / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Saved {run_dir}", flush=True)


if __name__ == "__main__":
    main()
