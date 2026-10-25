"""Small, predeclared HistGradientBoosting search on train-only grouped CV."""
from __future__ import annotations

import json
from itertools import product

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer

from train import DATA, POSITIVE, ROOT, SEED, metrics, split_patients
from experiment_strong_models import matrix, threshold_score, subtype_sens


def build(params, image_cols):
    prep = ColumnTransformer([
        ("image", StandardScaler(), image_cols),
        ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), ["age", "diameter_1", "diameter_2"]),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False),
         ["region", "itch", "grew", "hurt", "changed", "bleed", "elevation", "gender", "fitspatrick", "skin_cancer_history", "cancer_history"]),
    ])
    return make_pipeline(prep, HistGradientBoostingClassifier(**params, random_state=SEED))


def main():
    df = pd.read_csv(DATA / "metadata.csv")
    feat = np.load(DATA / "dinov2_small_features.npz")
    positions = {name: i for i, name in enumerate(feat["img_id"])}
    train, val, _test = split_patients(df)
    xtr, ytr = matrix(train, feat["embedding"], positions)
    xva, yva = matrix(val, feat["embedding"], positions)
    image_cols = [f"image_{i}" for i in range(feat["embedding"].shape[1])]
    # 12 fixed configurations; all ranking uses train-only pooled OOF predictions.
    params_list = [dict(max_iter=iters, max_leaf_nodes=leaves, learning_rate=lr,
                        l2_regularization=l2, early_stopping=False)
                   for iters, leaves, lr, l2 in product((100, 200), (7, 15, 31), (.05,), (1., 10.))]
    cv = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=SEED + 91)
    results, predictions = [], []
    for n, params in enumerate(params_list, 1):
        pred = np.full(len(train), np.nan)
        for fit_i, hold_i in cv.split(xtr, ytr, train.patient_id):
            m = build(params, image_cols)
            m.fit(xtr.iloc[fit_i], ytr[fit_i])
            pred[hold_i] = m.predict_proba(xtr.iloc[hold_i])[:, 1]
        score = threshold_score(ytr, pred)
        results.append({"config": f"hgb{n:02d}", **params,
                        "cv_accuracy_sens_ge_90": score["accuracy"],
                        "cv_sensitivity": score["sensitivity_cancer"],
                        "cv_specificity": score["specificity_non_cancer"],
                        "cv_auc": float(roc_auc_score(ytr, pred)),
                        "cv_threshold": score["threshold"], "cv_n": len(ytr),
                        "cv_patients": int(train.patient_id.nunique()), "folds": 4,
                        "grouped_by": "patient_id"})
        predictions.append(pred)
        print(f"HGB configuration {n}/{len(params_list)} complete", flush=True)
    table = pd.DataFrame(results).sort_values(["cv_accuracy_sens_ge_90", "cv_auc"], ascending=False)
    best = table.iloc[0]
    params = {k: best[k] for k in ("max_iter", "max_leaf_nodes", "learning_rate", "l2_regularization", "early_stopping")}
    params = {k: (int(v) if k in ("max_iter", "max_leaf_nodes") else (bool(v) if k == "early_stopping" else float(v))) for k, v in params.items()}
    model = build(params, image_cols)
    model.fit(xtr, ytr)
    p = model.predict_proba(xva)[:, 1]
    s = threshold_score(yva, p)
    conf = {"selected_by": "highest pooled 4-fold train-only grouped-CV accuracy subject to cancer sensitivity >= 0.90",
            "params": params, "validation": s, "validation_auc": float(roc_auc_score(yva, p)),
            "validation_n": len(yva), "validation_patients": int(val.patient_id.nunique()),
            "validation_subtype_sensitivity": subtype_sens(val, p, s["threshold"]),
            "test": "not loaded or used"}
    out = ROOT / "runs" / "hgb-search-cv-20261014"
    out.mkdir(exist_ok=True)
    table.to_csv(out / "grouped_cv.csv", index=False)
    (out / "validation_confirmation.json").write_text(json.dumps(conf, indent=2), encoding="utf-8")
    (out / "README.md").write_text(
        "Predeclared 12-configuration HistGradientBoosting search. Four-fold StratifiedGroupKFold on the original training partition only, grouped by patient_id. The original validation partition is used for a single confirmation of the top pooled-OOF CV configuration. Thresholds maximize accuracy subject to cancer sensitivity >= 0.90; threshold selection on pooled CV predictions is optimistic. The original test split is not loaded.\n",
        encoding="utf-8")
    print(table.head(5).to_string(index=False))
    print(json.dumps(conf, indent=2))


if __name__ == "__main__":
    main()
