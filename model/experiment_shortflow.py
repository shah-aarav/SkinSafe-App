"""Patient-grouped train/CV study of shorter clinical input sets.

The test partition is intentionally excluded. CV ranks configurations inside
the original train partition; the original validation partition is reported
as a one-time confirmation of the selected set.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVC

from train import DATA, POSITIVE, ROOT, SEED, metrics, split_patients

EMBED_PATH = DATA / "dinov2_small_features.npz"
SETS = {
    "image_only": ([], []),
    "age_plus_region": (["age"], ["region"]),
    "age_region_symptoms": (["age"], ["region", "itch", "grew", "hurt", "changed", "bleed", "elevation"]),
    "region_symptoms": ([], ["region", "itch", "grew", "hurt", "changed", "bleed", "elevation"]),
    "age_plus_symptoms": (["age"], ["itch", "grew", "hurt", "changed", "bleed", "elevation"]),
    "full": (["age", "diameter_1", "diameter_2"], ["region", "itch", "grew", "hurt", "changed", "bleed", "elevation", "gender", "fitspatrick", "skin_cancer_history", "cancer_history"]),
}


def make_xy(rows, embeddings, pos, name):
    x = pd.DataFrame(embeddings[[pos[i] for i in rows.img_id]],
                     columns=[f"im_{i}" for i in range(embeddings.shape[1])])
    numeric, categorical = SETS[name]
    for c in numeric:
        x[c] = pd.to_numeric(rows[c].reset_index(drop=True), errors="coerce")
    for c in categorical:
        x[c] = rows[c].reset_index(drop=True).astype("string").fillna("unknown")
    y = rows.diagnostic.isin(POSITIVE).astype(int).to_numpy()
    return x, y


def model_for(name, kind, c, image_cols):
    numeric, categorical = SETS[name]
    if name == "image_only":
        prep = StandardScaler()
    else:
        prep = ColumnTransformer([
            ("image", StandardScaler(), image_cols),
            ("numeric", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), numeric),
            ("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical),
        ])
    if kind == "logistic":
        clf = LogisticRegression(C=c, class_weight="balanced", max_iter=2000, random_state=SEED)
    else:
        clf = SVC(C=c, kernel="rbf", class_weight="balanced", probability=True, random_state=SEED)
    return make_pipeline(prep, clf)


def best_operating_point(y, p):
    # Fixed clinical constraint selected before this experiment.
    candidates = np.unique(np.r_[0.0, p, 1.0])
    valid = [metrics(y, p, t) for t in candidates]
    valid = [m for m in valid if m["sensitivity_cancer"] >= .90]
    return max(valid, key=lambda m: (m["accuracy"], m["sensitivity_cancer"]))


def main():
    df = pd.read_csv(DATA / "metadata.csv")
    feats = np.load(EMBED_PATH)
    pos = {v: i for i, v in enumerate(feats["img_id"])}
    train, val, _test = split_patients(df)
    image_cols = [f"im_{i}" for i in range(feats["embedding"].shape[1])]
    cv = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=SEED + 19)
    out = []
    # Model family and regularization grids are deliberately small and fixed.
    specs = [("logistic", c) for c in (.003, .03, .3)] + [("rbf_svm", c) for c in (.3, 3.0)]
    for set_name in SETS:
        x, y = make_xy(train, feats["embedding"], pos, set_name)
        oof = {}
        for kind, c in specs:
            pred = np.full(len(train), np.nan)
            for fit_idx, hold_idx in cv.split(x, y, train.patient_id):
                m = model_for(set_name, kind, c, image_cols)
                m.fit(x.iloc[fit_idx], y[fit_idx])
                pred[hold_idx] = m.predict_proba(x.iloc[hold_idx])[:, 1]
            oof[f"{kind}_C{c}"] = pred
            score = best_operating_point(y, pred)
            out.append({"feature_set": set_name, "model": kind, "C": c,
                        "cv_accuracy_sens_ge_90": score["accuracy"],
                        "cv_sensitivity_at_selected_threshold": score["sensitivity_cancer"],
                        "cv_specificity": score["specificity_non_cancer"],
                        "cv_auc": float(roc_auc_score(y, pred)),
                        "cv_threshold": score["threshold"],
                        "cv_folds": 4, "cv_grouped_by": "patient_id"})
        print(set_name, "done", flush=True)

    table = pd.DataFrame(out).sort_values(["cv_accuracy_sens_ge_90", "cv_auc"], ascending=False)
    # Pick within CV. Validate the top configuration per feature set once.
    confirmation = []
    for name in SETS:
        row = table[table.feature_set == name].iloc[0]
        kind, c = row.model, float(row.C)
        xtr, ytr = make_xy(train, feats["embedding"], pos, name)
        xva, yva = make_xy(val, feats["embedding"], pos, name)
        m = model_for(name, kind, c, image_cols)
        m.fit(xtr, ytr)
        p = m.predict_proba(xva)[:, 1]
        score = best_operating_point(yva, p)
        confirmation.append({"feature_set": name, "model": kind, "C": c,
                             "validation_accuracy_sens_ge_90": score["accuracy"],
                             "validation_sensitivity": score["sensitivity_cancer"],
                             "validation_specificity": score["specificity_non_cancer"],
                             "validation_auc": float(roc_auc_score(yva, p)),
                             "validation_threshold": score["threshold"]})
    run_dir = ROOT / "runs" / "shortflow-cv-20261014"
    run_dir.mkdir(exist_ok=True)
    table.to_csv(run_dir / "grouped_cv.csv", index=False)
    (run_dir / "validation_confirmation.json").write_text(json.dumps(confirmation, indent=2), encoding="utf-8")
    (run_dir / "README.md").write_text(
        "Short questionnaire study. All tuning used original train partition with 4-fold StratifiedGroupKFold grouped by patient. Original validation partition is reported as confirmation; held-out test partition was excluded and not loaded into this script. Threshold maximizes accuracy subject to cancer sensitivity >= 0.90. CV folds are pooled out-of-fold predictions, so the operating threshold is chosen on pooled CV predictions and may be optimistic. Validation threshold is selected on validation only for descriptive comparison. No test result is produced.\n",
        encoding="utf-8")
    print(table.head(12).to_string(index=False))
    print(json.dumps(confirmation, indent=2))


if __name__ == "__main__":
    main()
