"""Fit a supervised classifier on frozen DINOv2-S image embeddings."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVC

from train import DATA, POSITIVE, ROOT, SEED, choose_threshold, metrics, split_patients

CLINICAL = {
    "none": ([], []),
    "compact": (["age"], ["region", "itch", "grew", "hurt", "changed", "bleed", "elevation"]),
    "full": (["age", "diameter_1", "diameter_2"],
             ["region", "itch", "grew", "hurt", "changed", "bleed", "elevation",
              "gender", "fitspatrick", "skin_cancer_history", "cancer_history"]),
}


def feature_frame(rows, embeddings, positions, clinical):
    x = pd.DataFrame(
        embeddings[[positions[name] for name in rows.img_id]],
        columns=[f"image_{n}" for n in range(embeddings.shape[1])],
    )
    numeric, categorical = CLINICAL[clinical]
    for column in numeric:
        x[column] = pd.to_numeric(rows[column].reset_index(drop=True), errors="coerce")
    for column in categorical:
        x[column] = rows[column].reset_index(drop=True).astype("string").fillna("unknown")
    return x


def preprocess(clinical, image_columns):
    numeric, categorical = CLINICAL[clinical]
    if clinical == "none":
        return StandardScaler()
    return ColumnTransformer([
        ("image", StandardScaler(), image_columns),
        ("numeric", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), numeric),
        ("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical),
    ])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--clinical", choices=CLINICAL, default="none")
    args = parser.parse_args()
    df = pd.read_csv(DATA / "metadata.csv")
    features = np.load(DATA / "dinov2_small_features.npz")
    positions = {name: n for n, name in enumerate(features["img_id"])}
    if set(df.img_id) != set(positions):
        raise RuntimeError("Feature/image ID mismatch")
    embeddings = features["embedding"]
    train, val, test = split_patients(df)

    def x_y(rows):
        x = feature_frame(rows, embeddings, positions, args.clinical)
        y = rows.diagnostic.isin(POSITIVE).astype(int).to_numpy()
        return x, y

    x_train, y_train = x_y(train)
    x_val, y_val = x_y(val)
    image_columns = [f"image_{n}" for n in range(embeddings.shape[1])]
    candidates = []
    for c in (0.001, 0.01, 0.1, 1.0, 10.0):
        model = make_pipeline(preprocess(args.clinical, image_columns), LogisticRegression(
            C=c, class_weight="balanced", max_iter=2000, random_state=SEED
        ))
        model.fit(x_train, y_train)
        probabilities = model.predict_proba(x_val)[:, 1]
        threshold = choose_threshold(y_val, probabilities)
        score = metrics(y_val, probabilities, threshold)
        print(f"logistic C={c}: {score}", flush=True)
        candidates.append((score["roc_auc"], model, score, f"logistic C={c}"))
    for c in (0.1, 1.0, 10.0):
        model = make_pipeline(preprocess(args.clinical, image_columns), SVC(
            C=c, kernel="rbf", class_weight="balanced", probability=True,
            random_state=SEED
        ))
        model.fit(x_train, y_train)
        probabilities = model.predict_proba(x_val)[:, 1]
        threshold = choose_threshold(y_val, probabilities)
        score = metrics(y_val, probabilities, threshold)
        print(f"RBF-SVM C={c}: {score}", flush=True)
        candidates.append((score["roc_auc"], model, score, f"RBF-SVM C={c}"))

    _, best_model, best_score, best_name = max(candidates, key=lambda item: item[0])
    run_dir = ROOT / "runs" / datetime.now().strftime(f"%Y%m%d-%H%M%S-dino-{args.clinical}")
    run_dir.mkdir(parents=True, exist_ok=False)
    joblib.dump(best_model, run_dir / "classifier.joblib")
    pd.DataFrame({
        "img_id": df.img_id,
        "patient_id": df.patient_id,
        "split": np.select([df.img_id.isin(train.img_id), df.img_id.isin(val.img_id)],
                           ["train", "val"], default="test"),
    }).to_csv(run_dir / "split.csv", index=False)
    report = {
        "dataset": "PAD-UFES-20",
        "model": "DINOv2-S frozen image embeddings + trained classifier",
        "clinical_features": args.clinical,
        "split": "patient-separated stratified group 60/20/20 approximately",
        "positive_labels": sorted(POSITIVE),
        "seed": SEED,
        "selected_classifier": best_name,
        "validation": best_score,
        "test": "sealed until model and threshold are selected",
    }
    (run_dir / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Saved {run_dir}", flush=True)


if __name__ == "__main__":
    main()
