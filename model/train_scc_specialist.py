"""Focused BCC/SCC classifier evaluated as a second stage of six-class model."""

import json
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix, f1_score
from sklearn.pipeline import make_pipeline

from train import DATA, ROOT, SEED, split_patients
from train_dino import feature_frame, preprocess


def measures(y,pred):
    return {"accuracy":float(accuracy_score(y,pred)),
            "balanced_accuracy":float(balanced_accuracy_score(y,pred)),
            "macro_f1":float(f1_score(y,pred,average="macro")),
            "scc_recall":float(((pred=="SCC")&(y=="SCC")).sum()/max(1,(y=="SCC").sum()))}


def main():
    rows=pd.read_csv(DATA/"metadata.csv")
    parts=split_patients(rows)
    data=np.load(DATA/"dinov2_base_features.npz")
    positions={id_:i for i,id_ in enumerate(data["img_id"])}
    x=[feature_frame(part,data["embedding"],positions,"full") for part in parts]
    y=[part.diagnostic.to_numpy() for part in parts]
    baseline=joblib.load(ROOT/"runs"/"20261025-155831-multiclass-weighted"/"classifier.joblib")
    baseline_predictions=[baseline.predict(frame) for frame in x]
    image_columns=[column for column in x[0] if column.startswith("image_")]
    cancer=[np.isin(labels,["BCC","SCC"]) for labels in y]
    results=[]
    for weight in (.1,.3,1):
        for c in (.03,.1):
            model=make_pipeline(preprocess("full",image_columns).set_params(transformer_weights={"image":weight}),
                LogisticRegression(C=c,class_weight="balanced",max_iter=3000,random_state=SEED))
            model.fit(x[0][cancer[0]],y[0][cancer[0]])
            proba=model.predict_proba(x[1])[:,list(model[-1].classes_).index("SCC")]
            for threshold in (.2,.3,.4,.5,.6,.7,.8):
                prediction=baseline_predictions[1].copy()
                eligible=np.isin(prediction,["BCC","SCC"])
                prediction[eligible]=np.where(proba[eligible]>=threshold,"SCC","BCC")
                score=measures(y[1],prediction)
                label=f"weight{weight}-C{c}-threshold{threshold}"
                results.append((score["macro_f1"],score["accuracy"],label,model,threshold,score))
            top=max((result for result in results if result[2].startswith(f"weight{weight}-C{c}-")),key=lambda item:item[:2])
            print(f"weight{weight}-C{c}",top[2],{k:round(v,4) for k,v in top[5].items()},flush=True)
    selected=max(results,key=lambda item:item[:2])
    proba=selected[3].predict_proba(x[2])[:,list(selected[3][-1].classes_).index("SCC")]
    prediction=baseline_predictions[2].copy()
    eligible=np.isin(prediction,["BCC","SCC"])
    prediction[eligible]=np.where(proba[eligible]>=selected[4],"SCC","BCC")
    exploratory=measures(y[2],prediction)
    exploratory["confusion"]={"labels":sorted(set(y[2])),"matrix":confusion_matrix(y[2],prediction,labels=sorted(set(y[2]))).tolist()}
    output=ROOT/"runs"/datetime.now().strftime("%Y%m%d-%H%M%S-multiclass-scc-specialist")
    output.mkdir(parents=True,exist_ok=False)
    joblib.dump(selected[3],output/"specialist.joblib")
    report={"split":"patient-separated, original test previously inspected",
        "selection":"validation macro F1, then accuracy",
        "selected":selected[2],"validation":selected[5],"exploratory_reused_test":exploratory,
        "candidates":[{"name":item[2],"validation":item[5]} for item in results]}
    (output/"report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print("SELECTED",selected[2],"VALIDATION",selected[5],"REUSED TEST",{k:v for k,v in exploratory.items() if k!="confusion"},"SAVED",output,flush=True)


if __name__=="__main__":main()
