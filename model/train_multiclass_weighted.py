"""Test whether questionnaire features were drowned out by the image vector.

Only the training and validation partitions are loaded. The previously opened
test partition is intentionally not revisited during this search.
"""

import json
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, balanced_accuracy_score, f1_score
from sklearn.pipeline import make_pipeline
from sklearn.svm import SVC

from train import DATA, ROOT, SEED, split_patients
from train_dino import feature_frame, preprocess


def main():
    rows = pd.read_csv(DATA / "metadata.csv")
    train, validation, _ = split_patients(rows)
    features = np.load(DATA / "dinov2_base_features.npz")
    positions = {name: i for i, name in enumerate(features["img_id"])}
    x_train = feature_frame(train, features["embedding"], positions, "full")
    x_val = feature_frame(validation, features["embedding"], positions, "full")
    y_train, y_val = train.diagnostic.to_numpy(), validation.diagnostic.to_numpy()
    columns = [column for column in x_train if column.startswith("image_")]
    results = []
    for weight in (.03, .1, .3, 1, 3):
        for name, estimator in (
            ("logistic-C.01", LogisticRegression(C=.01, max_iter=3000, random_state=SEED)),
            ("logistic-C.1", LogisticRegression(C=.1, max_iter=3000, random_state=SEED)),
            ("logistic-balanced-C.01", LogisticRegression(C=.01, class_weight="balanced", max_iter=3000, random_state=SEED)),
            ("svm-C1", SVC(C=1, kernel="rbf", random_state=SEED)),
        ):
            prep = preprocess("full", columns).set_params(transformer_weights={"image": weight})
            model = make_pipeline(prep, estimator)
            model.fit(x_train, y_train)
            prediction = model.predict(x_val)
            metrics = {"accuracy": float(accuracy_score(y_val, prediction)),
                       "balanced_accuracy": float(balanced_accuracy_score(y_val, prediction)),
                       "macro_f1": float(f1_score(y_val, prediction, average="macro"))}
            label = f"{name}-imageweight-{weight}"
            print(label, {key: round(value, 4) for key, value in metrics.items()}, flush=True)
            results.append((metrics["macro_f1"], metrics["accuracy"], label, model, metrics))
    selected = max(results, key=lambda item: item[:2])
    output = ROOT / "runs" / datetime.now().strftime("%Y%m%d-%H%M%S-multiclass-weighted")
    output.mkdir(parents=True, exist_ok=False)
    joblib.dump(selected[3], output / "classifier.joblib")
    report = {"selection": "validation macro F1, then validation accuracy; patient-separated",
              "test_partition": "not inspected in this experiment",
              "selected": selected[2], "validation": selected[4],
              "candidates": [{"name": item[2], "validation": item[4]} for item in results]}
    (output / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("SELECTED", selected[2], selected[4], "SAVED", output, flush=True)


if __name__ == "__main__":
    main()
