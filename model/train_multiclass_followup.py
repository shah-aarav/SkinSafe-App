"""Validation-only six-class follow-up with unchanged questionnaire and patient split."""

from __future__ import annotations

import json
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, balanced_accuracy_score, f1_score, classification_report
from sklearn.pipeline import make_pipeline
from sklearn.svm import SVC

from train import DATA, ROOT, SEED, split_patients
from train_dino import feature_frame, preprocess


def score(model, x, y):
    pred = model.predict(x)
    return {"accuracy": float(accuracy_score(y, pred)),
            "balanced_accuracy": float(balanced_accuracy_score(y, pred)),
            "macro_f1": float(f1_score(y, pred, average="macro"))}


def main():
    rows = pd.read_csv(DATA / "metadata.csv")
    train, val, test = split_patients(rows)
    embeddings = {}
    for name in ("small", "base"):
        data = np.load(DATA / f"dinov2_{name}_features.npz")
        embeddings[name] = (data["embedding"], {id_: i for i, id_ in enumerate(data["img_id"])})
    sets = {}
    for name, (features, positions) in embeddings.items():
        sets[name] = tuple(feature_frame(part, features, positions, "full") for part in (train, val, test))
    ys = tuple(part.diagnostic.to_numpy() for part in (train, val, test))
    candidates = []
    for name, (x_train, x_val, _) in sets.items():
        columns = [column for column in x_train if column.startswith("image_")]
        for weight in (None, "balanced"):
            for c in (.001, .01, .1, 1, 10):
                candidates.append((f"{name}-logistic-{weight}-{c}", name,
                    make_pipeline(preprocess("full", columns), LogisticRegression(
                        C=c, class_weight=weight, max_iter=3000, random_state=SEED))))
            for c in (.1, 1, 10):
                candidates.append((f"{name}-svm-{weight}-{c}", name,
                    make_pipeline(preprocess("full", columns), SVC(
                        C=c, class_weight=weight, kernel="rbf", random_state=SEED))))
    results = []
    for label, set_name, model in candidates:
        x_train, x_val, _ = sets[set_name]
        model.fit(x_train, ys[0])
        validation = score(model, x_val, ys[1])
        print(label, {key: round(value, 4) for key, value in validation.items()}, flush=True)
        results.append((validation["macro_f1"], validation["accuracy"], label, set_name, model, validation))
    selected = max(results, key=lambda row: row[:2])
    _, _, label, set_name, model, validation = selected
    exploratory = score(model, sets[set_name][2], ys[2])
    report = {"task": "Six-category lesion classification, not clinical diagnosis",
        "split": "unchanged patient-separated split; test previously inspected, so exploratory",
        "selection": "validation macro F1, then accuracy",
        "selected": label, "validation": validation,
        "exploratory_reused_test": exploratory,
        "per_class_reused_test": classification_report(ys[2], model.predict(sets[set_name][2]), output_dict=True, zero_division=0),
        "candidates": [{"name": item[2], "validation": item[5]} for item in results]}
    output = ROOT / "runs" / datetime.now().strftime("%Y%m%d-%H%M%S-multiclass-followup")
    output.mkdir(parents=True, exist_ok=False)
    joblib.dump(model, output / "classifier.joblib")
    (output / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("SELECTED", label, "VALIDATION", validation, "REUSED TEST", exploratory, "SAVED", output, flush=True)


if __name__ == "__main__":
    main()
