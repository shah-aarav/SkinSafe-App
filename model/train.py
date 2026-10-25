"""Patient-separated, image-only PAD-UFES-20 baseline."""

from __future__ import annotations

import argparse
import json
import random
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from PIL import Image
from sklearn.metrics import accuracy_score, confusion_matrix, roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms


ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
POSITIVE = {"BCC", "SCC", "MEL"}
CLASSES = {"BCC", "SCC", "MEL", "ACK", "NEV", "SEK"}
SEED = 2026


class Lesions(Dataset):
    def __init__(self, rows: pd.DataFrame, training: bool):
        self.rows = rows.reset_index(drop=True)
        ops = [transforms.Resize((224, 224))]
        if training:
            ops += [
                transforms.RandomHorizontalFlip(),
                transforms.RandomVerticalFlip(),
                transforms.RandomRotation(20),
                transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.1),
            ]
        ops += [
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
        self.transform = transforms.Compose(ops)

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int):
        row = self.rows.iloc[index]
        with Image.open(DATA / "images" / row.img_id) as image:
            x = self.transform(image.convert("RGB"))
        return x, torch.tensor(float(row.diagnostic in POSITIVE), dtype=torch.float32)


def split_patients(df: pd.DataFrame):
    labels = df.diagnostic.isin(POSITIVE).astype(int)
    outer = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED)
    train_val_ids, test_ids = next(outer.split(df, labels, df.patient_id))
    train_val = df.iloc[train_val_ids].reset_index(drop=True)
    inner = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=SEED + 1)
    inner_labels = train_val.diagnostic.isin(POSITIVE).astype(int)
    train_ids, val_ids = next(inner.split(train_val, inner_labels, train_val.patient_id))
    train, val, test = train_val.iloc[train_ids], train_val.iloc[val_ids], df.iloc[test_ids]
    train, val, test = (part.reset_index(drop=True) for part in (train, val, test))
    ids = [set(part.patient_id) for part in (train, val, test)]
    assert not (ids[0] & ids[1] or ids[0] & ids[2] or ids[1] & ids[2])
    assert sum(map(len, (train, val, test))) == len(df)
    return train, val, test


def predict(model, loader, device):
    model.eval()
    probabilities, labels = [], []
    with torch.inference_mode():
        for x, y in loader:
            probabilities.extend(torch.sigmoid(model(x.to(device)).flatten()).cpu().numpy())
            labels.extend(y.numpy())
    return np.asarray(labels, dtype=int), np.asarray(probabilities)


def metrics(y, prob, threshold):
    pred = (prob >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    return {
        "accuracy": float(accuracy_score(y, pred)),
        "roc_auc": float(roc_auc_score(y, prob)),
        "sensitivity_cancer": float(tp / (tp + fn)) if tp + fn else None,
        "specificity_non_cancer": float(tn / (tn + fp)) if tn + fp else None,
        "true_positive": int(tp),
        "false_positive": int(fp),
        "false_negative": int(fn),
        "true_negative": int(tn),
        "threshold": float(threshold),
    }


def choose_threshold(y, prob):
    # Select on validation data only; maximize balanced accuracy.
    candidates = np.arange(0.05, 0.951, 0.01)
    return float(max(candidates, key=lambda t: (
        (metrics(y, prob, t)["sensitivity_cancer"] +
         metrics(y, prob, t)["specificity_non_cancer"]) / 2
    )))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--threads", type=int, default=4)
    args = parser.parse_args()
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    torch.set_num_threads(args.threads)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}", flush=True)

    df = pd.read_csv(DATA / "metadata.csv")
    if set(df.diagnostic) != CLASSES:
        raise ValueError(f"Unexpected diagnostics: {set(df.diagnostic)}")
    missing = [name for name in df.img_id if not (DATA / "images" / name).exists()]
    if missing:
        raise FileNotFoundError(f"Missing {len(missing)} images; run prepare_data.py")
    train, val, test = split_patients(df)
    for name, part in (("train", train), ("val", val), ("test", test)):
        print(f"{name}: {len(part)} images, {part.patient_id.nunique()} patients, "
              f"{part.diagnostic.isin(POSITIVE).sum()} cancer images", flush=True)

    run_dir = ROOT / "runs" / datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir.mkdir(parents=True, exist_ok=False)
    pd.DataFrame({"img_id": df.img_id, "patient_id": df.patient_id,
                  "split": np.select([df.img_id.isin(train.img_id), df.img_id.isin(val.img_id)],
                                     ["train", "val"], default="test")}).to_csv(run_dir / "split.csv", index=False)
    train_loader = DataLoader(Lesions(train, True), batch_size=args.batch_size,
                              shuffle=True, num_workers=args.workers)
    val_loader = DataLoader(Lesions(val, False), batch_size=args.batch_size,
                            num_workers=args.workers)

    model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
    model.classifier[3] = nn.Linear(model.classifier[3].in_features, 1)
    for parameter in model.features.parameters():
        parameter.requires_grad = False
    model.to(device)
    positives = train.diagnostic.isin(POSITIVE).sum()
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([(len(train) - positives) / positives], device=device))
    optimizer = torch.optim.AdamW(model.classifier.parameters(), lr=0.001, weight_decay=0.01)

    best_auc = -1.0
    stale = 0
    for epoch in range(1, args.epochs + 1):
        if epoch == 4:
            for parameter in model.features[-2:].parameters():
                parameter.requires_grad = True
            optimizer = torch.optim.AdamW((p for p in model.parameters() if p.requires_grad),
                                          lr=0.0001, weight_decay=0.01)
        model.train()
        # Frozen blocks must not update their batch-normalization statistics.
        model.features.eval()
        if epoch >= 4:
            model.features[-2:].train()
        total_loss = 0.0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad(set_to_none=True)
            loss = loss_fn(model(x).flatten(), y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(y)
        y_val, p_val = predict(model, val_loader, device)
        auc = roc_auc_score(y_val, p_val)
        threshold = choose_threshold(y_val, p_val)
        result = metrics(y_val, p_val, threshold)
        print(f"epoch {epoch}: loss={total_loss / len(train):.4f} "
              f"val_auc={auc:.4f} val_accuracy={result['accuracy']:.4f} "
              f"val_sensitivity={result['sensitivity_cancer']:.4f}", flush=True)
        if auc > best_auc + 0.0005:
            best_auc = auc
            stale = 0
            torch.save(model.state_dict(), run_dir / "best.pt")
        else:
            stale += 1
            if stale >= 4:
                break

    model.load_state_dict(torch.load(run_dir / "best.pt", map_location=device, weights_only=True))
    y_val, p_val = predict(model, val_loader, device)
    threshold = choose_threshold(y_val, p_val)
    report = {
        "dataset": "PAD-UFES-20",
        "model": "MobileNetV3-small, ImageNet pretrained, image-only",
        "split": "patient-separated stratified group 60/20/20 approximately",
        "positive_labels": sorted(POSITIVE),
        "seed": SEED,
        "validation": metrics(y_val, p_val, threshold),
        "test": "sealed until model and threshold are selected",
    }
    (run_dir / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2), flush=True)
    print(f"Saved to {run_dir}", flush=True)


if __name__ == "__main__":
    main()
