"""Bounded grouped-CV comparison of stronger classifiers on existing DINO features.

The original held-out test split is not loaded. All model selection is inside
the original training partition, grouped by patient; original validation is
reported once after CV ranking.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesClassifier, HistGradientBoostingClassifier, RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, VotingClassifier
from sklearn.impute import SimpleImputer
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.svm import SVC

from train import DATA, POSITIVE, ROOT, SEED, metrics, split_patients

CLINICAL_NUMERIC = ["age", "diameter_1", "diameter_2"]
CLINICAL_CATEGORICAL = ["region", "itch", "grew", "hurt", "changed", "bleed", "elevation", "gender", "fitspatrick", "skin_cancer_history", "cancer_history"]


def matrix(rows, embeddings, positions):
    x = pd.DataFrame(embeddings[[positions[name] for name in rows.img_id]], columns=[f"image_{i}" for i in range(embeddings.shape[1])])
    for c in CLINICAL_NUMERIC:
        x[c] = pd.to_numeric(rows[c].reset_index(drop=True), errors="coerce")
    for c in CLINICAL_CATEGORICAL:
        x[c] = rows[c].reset_index(drop=True).astype("string").fillna("unknown")
    y = rows.diagnostic.isin(POSITIVE).astype(int).to_numpy()
    return x, y


def threshold_score(y, p):
    candidates = np.unique(np.r_[0., p, 1.])
    eligible = [metrics(y, p, t) for t in candidates]
    eligible = [m for m in eligible if m["sensitivity_cancer"] >= .90]
    return max(eligible, key=lambda m: (m["accuracy"], m["sensitivity_cancer"]))


def subtype_sens(rows, prob, threshold):
    positive = rows.diagnostic.isin(POSITIVE).to_numpy()
    flags = prob >= threshold
    result = {}
    for diagnosis in ("BCC", "MEL", "SCC"):
        mask = rows.diagnostic.eq(diagnosis).to_numpy()
        result[diagnosis] = {"n": int(mask.sum()), "sensitivity": float(flags[mask].mean()) if mask.any() else None}
    return result


def candidates(seed):
    return {
        "logistic_C003": LogisticRegression(C=.03, class_weight="balanced", max_iter=2500, random_state=seed),
        "logistic_C01": LogisticRegression(C=.1, class_weight="balanced", max_iter=2500, random_state=seed),
        "random_forest": RandomForestClassifier(n_estimators=180, min_samples_leaf=3, max_features=.35, class_weight="balanced", n_jobs=4, random_state=seed),
        "extra_trees": ExtraTreesClassifier(n_estimators=180, min_samples_leaf=3, max_features=.35, class_weight="balanced", n_jobs=4, random_state=seed),
        "hist_gradient_boost": HistGradientBoostingClassifier(max_iter=100, max_leaf_nodes=15, learning_rate=.08, l2_regularization=1., random_state=seed),
        "gradient_boost": GradientBoostingClassifier(n_estimators=100, max_depth=2, learning_rate=.05, min_samples_leaf=8, random_state=seed),
        "mlp": MLPClassifier(hidden_layer_sizes=(128, 32), alpha=1., learning_rate_init=.0005, max_iter=180, early_stopping=True, validation_fraction=.15, n_iter_no_change=15, random_state=seed),
        "lda_shrinkage": LinearDiscriminantAnalysis(solver="lsqr", shrinkage="auto"),
        "rbf_svm": SVC(C=1., kernel="rbf", class_weight="balanced", probability=True, random_state=seed),
    }


def build(estimator, image_columns):
    prep = ColumnTransformer([
        ("image", StandardScaler(), image_columns),
        ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), CLINICAL_NUMERIC),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CLINICAL_CATEGORICAL),
    ])
    return make_pipeline(prep, estimator)


def main():
    df = pd.read_csv(DATA / "metadata.csv")
    features = np.load(DATA / "dinov2_small_features.npz")
    positions = {name: i for i, name in enumerate(features["img_id"])}
    train, val, _test = split_patients(df)
    x_train, y_train = matrix(train, features["embedding"], positions)
    x_val, y_val = matrix(val, features["embedding"], positions)
    image_columns = [f"image_{i}" for i in range(features["embedding"].shape[1])]
    cv = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=SEED + 73)
    results, oof_probs = [], {}
    for name, estimator in candidates(SEED).items():
        pred = np.full(len(train), np.nan)
        for fit_idx, hold_idx in cv.split(x_train, y_train, train.patient_id):
            model = build(estimator, image_columns)
            model.fit(x_train.iloc[fit_idx], y_train[fit_idx])
            pred[hold_idx] = model.predict_proba(x_train.iloc[hold_idx])[:, 1]
        oof_probs[name] = pred
        score = threshold_score(y_train, pred)
        results.append({"model": name, "cv_accuracy_sens_ge_90": score["accuracy"],
                        "cv_sensitivity": score["sensitivity_cancer"], "cv_specificity": score["specificity_non_cancer"],
                        "cv_auc": float(roc_auc_score(y_train, pred)), "cv_threshold": score["threshold"],
                        "cv_tp": score["true_positive"], "cv_fp": score["false_positive"],
                        "cv_fn": score["false_negative"], "cv_tn": score["true_negative"],
                        "cv_n": len(y_train), "cv_patients": int(train.patient_id.nunique()),
                        "cv_grouped_by": "patient_id", "folds": 4})
        print(name, "CV complete", flush=True)

    # Two fixed soft-voting blends, constructed from the strongest distinct
    # CV-ranked candidates. These are evaluated on OOF predictions, then the
    # selected recipe is confirmed once on the original validation partition.
    ranked = sorted(results, key=lambda r: (r["cv_accuracy_sens_ge_90"], r["cv_auc"]), reverse=True)
    top = [r["model"] for r in ranked[:3]]
    blend = np.mean([oof_probs[n] for n in top], axis=0)
    bs = threshold_score(y_train, blend)
    results.append({"model": "equal_blend_" + "_".join(top), "cv_accuracy_sens_ge_90": bs["accuracy"],
                    "cv_sensitivity": bs["sensitivity_cancer"], "cv_specificity": bs["specificity_non_cancer"],
                    "cv_auc": float(roc_auc_score(y_train, blend)), "cv_threshold": bs["threshold"],
                    "cv_tp": bs["true_positive"], "cv_fp": bs["false_positive"],
                    "cv_fn": bs["false_negative"], "cv_tn": bs["true_negative"],
                    "cv_n": len(y_train), "cv_patients": int(train.patient_id.nunique()),
                    "cv_grouped_by": "patient_id", "folds": 4})

    # Confirmation only for top 3 individual estimators and fixed equal blend.
    confirm = []
    chosen = [(r["model"], [r["model"]]) for r in ranked[:3]] + [(results[-1]["model"], top)]
    for name, model_names in chosen:
        if len(model_names) == 1:
            est = candidates(SEED)[model_names[0]]
            model = build(est, image_columns)
            model.fit(x_train, y_train)
            p = model.predict_proba(x_val)[:, 1]
        else:
            ps = []
            for mn in model_names:
                model = build(candidates(SEED)[mn], image_columns)
                model.fit(x_train, y_train)
                ps.append(model.predict_proba(x_val)[:, 1])
            p = np.mean(ps, axis=0)
        s = threshold_score(y_val, p)
        confirm.append({"model": name, **{f"validation_{k}": v for k, v in s.items()},
                        "validation_n": len(y_val), "validation_patients": int(val.patient_id.nunique()),
                        "validation_auc": float(roc_auc_score(y_val, p)),
                        "validation_subtype_sensitivity": subtype_sens(val, p, s["threshold"])})

    run_dir = ROOT / "runs" / "strong-models-cv-20261014"
    run_dir.mkdir(exist_ok=True)
    table = pd.DataFrame(results).sort_values(["cv_accuracy_sens_ge_90", "cv_auc"], ascending=False)
    table.to_csv(run_dir / "grouped_cv.csv", index=False)
    (run_dir / "validation_confirmation.json").write_text(json.dumps(confirm, indent=2), encoding="utf-8")
    (run_dir / "README.md").write_text(
        "Bounded classifier comparison using existing DINOv2-S features and full clinical fields. Original held-out test split was not loaded. Four-fold StratifiedGroupKFold over original training partition, grouped by patient_id. Model ranking uses pooled OOF predictions and the fixed policy of maximizing accuracy subject to cancer sensitivity >= 0.90. The original validation split is used once to confirm top CV-ranked models/blend; validation thresholds are descriptive. CV threshold selection is itself optimistic because it is selected on pooled OOF labels. Small MEL validation count makes melanoma sensitivity imprecise. No external dataset or new model weights were used.\n",
        encoding="utf-8")
    print(table.head(7).to_string(index=False))
    print(json.dumps(confirm, indent=2))


if __name__ == "__main__":
    main()
