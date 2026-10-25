"""Fuse DINOv2-S and -B image embeddings with the existing questionnaire."""

import json
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, balanced_accuracy_score, classification_report, f1_score
from sklearn.pipeline import make_pipeline

from train import DATA, ROOT, SEED, split_patients
from train_dino import feature_frame, preprocess


def main():
    rows = pd.read_csv(DATA / "metadata.csv")
    train, val, test = split_patients(rows)
    data = {}
    for name in ("small", "base"):
        features = np.load(DATA / f"dinov2_{name}_features.npz")
        data[name] = (features["embedding"], {id_: i for i, id_ in enumerate(features["img_id"])})

    def matrix(part):
        base, base_positions = data["base"]
        small, small_positions = data["small"]
        frame = feature_frame(part, base, base_positions, "full")
        frame = pd.concat([frame, pd.DataFrame(
            small[[small_positions[id_] for id_ in part.img_id]],
            columns=[f"small_image_{i}" for i in range(small.shape[1])])], axis=1)
        return frame

    x_train, x_val, x_test = [matrix(part) for part in (train, val, test)]
    image_columns = [column for column in x_train if column.startswith(("image_", "small_image_"))]
    results = []
    for weight in (.1, .2, .3, .5):
        for c in (.03, .1):
            model = make_pipeline(preprocess("full", image_columns).set_params(transformer_weights={"image":weight}),
                LogisticRegression(C=c, max_iter=3000, random_state=SEED))
            model.fit(x_train, train.diagnostic)
            pred = model.predict(x_val)
            metrics = {"accuracy":float(accuracy_score(val.diagnostic,pred)),
                "balanced_accuracy":float(balanced_accuracy_score(val.diagnostic,pred)),
                "macro_f1":float(f1_score(val.diagnostic,pred,average="macro"))}
            name = f"fused-weight-{weight}-C-{c}"
            print(name, {key:round(value,4) for key,value in metrics.items()},flush=True)
            results.append((metrics["macro_f1"], metrics["accuracy"],name,model,metrics))
    selected=max(results,key=lambda item:item[:2])
    prediction=selected[3].predict(x_test)
    exploratory={"accuracy":float(accuracy_score(test.diagnostic,prediction)),
        "balanced_accuracy":float(balanced_accuracy_score(test.diagnostic,prediction)),
        "macro_f1":float(f1_score(test.diagnostic,prediction,average="macro")),
        "per_class":classification_report(test.diagnostic,prediction,output_dict=True,zero_division=0)}
    output=ROOT/"runs"/datetime.now().strftime("%Y%m%d-%H%M%S-multiclass-fused")
    output.mkdir(parents=True,exist_ok=False)
    joblib.dump(selected[3],output/"classifier.joblib")
    report={"split":"patient-separated, previously inspected test partition",
        "selection":"validation macro F1, then accuracy","selected":selected[2],
        "validation":selected[4],"exploratory_reused_test":exploratory,
        "candidates":[{"name":row[2],"validation":row[4]} for row in results]}
    (output/"report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print("SELECTED",selected[2],"VALIDATION",selected[4],"REUSED TEST",{k:v for k,v in exploratory.items() if k!="per_class"},"SAVED",output,flush=True)


if __name__=="__main__":
    main()
