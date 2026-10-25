"""Patient-grouped comparison for frozen DINOv2-B plus the unchanged questions.

The original test partition was opened during previous model work. Any test
number here is exploratory and must not be described as a fresh holdout.
"""

import json

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.svm import SVC

from experiment_strong_models import subtype_sens, threshold_score
from train import DATA, POSITIVE, ROOT, SEED, metrics, split_patients
from train_dino import feature_frame, preprocess


def build(name, columns):
    if name == "logistic":
        head = LogisticRegression(C=.01, class_weight="balanced", max_iter=2000, random_state=SEED)
    else:
        head = SVC(C=1., kernel="rbf", class_weight="balanced", probability=True, random_state=SEED)
    return make_pipeline(preprocess("full", columns), head)


def main():
    rows = pd.read_csv(DATA / "metadata.csv")
    train, val, test = split_patients(rows)
    features = np.load(DATA / "dinov2_base_features.npz")
    positions = {name: i for i, name in enumerate(features["img_id"])}
    x = {part: feature_frame(frame, features["embedding"], positions, "full")
         for part, frame in (("train", train), ("val", val), ("test", test))}
    y = {part: frame.diagnostic.isin(POSITIVE).astype(int).to_numpy()
         for part, frame in (("train", train), ("val", val), ("test", test))}
    columns = [f"image_{i}" for i in range(features["embedding"].shape[1])]
    cv = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=SEED + 73)
    oof = {name: np.full(len(train), np.nan) for name in ("logistic", "svm")}
    for fold, (fit_idx, hold_idx) in enumerate(cv.split(x["train"], y["train"], train.patient_id), 1):
        for name in oof:
            model = build(name, columns)
            model.fit(x["train"].iloc[fit_idx], y["train"][fit_idx])
            oof[name][hold_idx] = model.predict_proba(x["train"].iloc[hold_idx])[:, 1]
        print(f"Grouped fold {fold}/4 complete", flush=True)

    weights = {"logistic": 1., "svm": 0., "equal_blend": .5}
    cv_report = []
    for name, weight in weights.items():
        probability = weight * oof["logistic"] + (1 - weight) * oof["svm"]
        score = threshold_score(y["train"], probability)
        cv_report.append({"candidate": name, "weight": weight, "score": score,
                          "melanoma": subtype_sens(train, probability, score["threshold"])["MEL"]})
    chosen = max(cv_report, key=lambda item: (item["score"]["accuracy"],
                                             item["melanoma"]["sensitivity"]))
    fitted = {}
    for name in ("logistic", "svm"):
        fitted[name] = build(name, columns)
        fitted[name].fit(x["train"], y["train"])
    weight = chosen["weight"]
    probability = {part: weight * fitted["logistic"].predict_proba(x[part])[:, 1]
                        + (1 - weight) * fitted["svm"].predict_proba(x[part])[:, 1]
                   for part in ("val", "test")}
    threshold = threshold_score(y["val"], probability["val"])["threshold"]
    report = {
        "model": "DINOv2-B frozen embeddings plus unchanged full questionnaire",
        "selection": "Head/weight ranked on 4-fold patient-grouped training CV; threshold selected on validation subject to >=90% cancer sensitivity.",
        "caution": "Original test partition was previously opened. Test comparison is exploratory, not a fresh independent estimate.",
        "cv_candidates": cv_report,
        "chosen": chosen["candidate"],
        "weight": weight,
        "threshold": threshold,
        "validation": metrics(y["val"], probability["val"], threshold),
        "validation_by_diagnosis": subtype_sens(val, probability["val"], threshold),
        "test_reused": metrics(y["test"], probability["test"], threshold),
        "test_by_diagnosis": subtype_sens(test, probability["test"], threshold),
        "samples": {"train": len(train), "validation": len(val), "test": len(test)},
    }
    out = ROOT / "runs" / "dino-base-candidate-20261016"
    out.mkdir(exist_ok=True)
    joblib.dump({"logistic": fitted["logistic"], "svm": fitted["svm"],
                 "logistic_weight": weight}, out / "ensemble.joblib")
    (out / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    main()
