"""Tree-model comparison using compressed image features plus questionnaire.

PCA is fitted on training patients only. Candidate selection and early stopping
use validation patients. The previously inspected test partition is reported
only for the validation-selected candidate, as an exploratory comparison.
"""

import json
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
from catboost import CatBoostClassifier
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, balanced_accuracy_score, classification_report, f1_score
from sklearn.preprocessing import StandardScaler

from train import DATA, ROOT, SEED, split_patients
from train_dino import CLINICAL


def measures(y, pred):
    return {"accuracy":float(accuracy_score(y,pred)),
            "balanced_accuracy":float(balanced_accuracy_score(y,pred)),
            "macro_f1":float(f1_score(y,pred,average="macro"))}


def main():
    rows=pd.read_csv(DATA/"metadata.csv")
    parts=split_patients(rows)
    features=np.load(DATA/"dinov2_base_features.npz")
    positions={name:i for i,name in enumerate(features["img_id"])}
    images=[features["embedding"][[positions[name] for name in part.img_id]] for part in parts]
    scaler=StandardScaler().fit(images[0])
    scaled=[scaler.transform(image) for image in images]
    numeric,categorical=CLINICAL["full"]
    imputer=SimpleImputer(strategy="median").fit(parts[0][numeric])
    metadata=[]
    for part in parts:
        frame=pd.DataFrame(imputer.transform(part[numeric]),columns=numeric)
        for column in categorical:
            frame[column]=part[column].reset_index(drop=True).astype("string").fillna("UNK").astype(str)
        metadata.append(frame)
    results=[]
    for dimensions in (64,128):
        pca=PCA(n_components=dimensions,random_state=SEED).fit(scaled[0])
        x=[]
        for meta,image in zip(metadata,scaled):
            frame=meta.copy()
            principal=pca.transform(image)
            for index in range(dimensions):frame[f"pc_{index}"]=principal[:,index]
            x.append(frame)
        for depth in (4,6):
            for weight in (None,"Balanced"):
                model=CatBoostClassifier(iterations=700,depth=depth,learning_rate=.045,
                    loss_function="MultiClass",eval_metric="Accuracy",auto_class_weights=weight,
                    l2_leaf_reg=4,random_seed=SEED,verbose=False,thread_count=4)
                model.fit(x[0],parts[0].diagnostic,cat_features=categorical,
                          eval_set=(x[1],parts[1].diagnostic),early_stopping_rounds=80,verbose=False)
                scores=measures(parts[1].diagnostic,model.predict(x[1]).ravel())
                label=f"pca{dimensions}-depth{depth}-weight{weight}"
                print(label,model.best_iteration_,{k:round(v,4) for k,v in scores.items()},flush=True)
                results.append((scores["macro_f1"],scores["accuracy"],label,model,pca,dimensions,scores,x[2]))
    selected=max(results,key=lambda item:item[:2])
    prediction=selected[3].predict(selected[7]).ravel()
    exploratory=measures(parts[2].diagnostic,prediction)
    exploratory["per_class"]=classification_report(parts[2].diagnostic,prediction,output_dict=True,zero_division=0)
    output=ROOT/"runs"/datetime.now().strftime("%Y%m%d-%H%M%S-multiclass-catboost")
    output.mkdir(parents=True,exist_ok=False)
    joblib.dump({"model":selected[3],"pca":selected[4],"scaler":scaler,"imputer":imputer},output/"classifier.joblib")
    report={"split":"patient-separated, test previously inspected",
        "selection":"validation macro F1, then accuracy; early stopping on validation",
        "selected":selected[2],"validation":selected[6],"exploratory_reused_test":exploratory,
        "candidates":[{"name":row[2],"validation":row[6]} for row in results]}
    (output/"report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print("SELECTED",selected[2],"VALIDATION",selected[6],"REUSED TEST",{k:v for k,v in exploratory.items() if k!="per_class"},"SAVED",output,flush=True)


if __name__=="__main__":main()
