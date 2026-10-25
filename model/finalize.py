"""Run exactly one final evaluation on a selected checkpoint's sealed test set."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import models

from train import CLASSES, DATA, Lesions, metrics, predict


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("run_dir", type=Path)
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()
    report_path = args.run_dir / "report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if isinstance(report.get("test"), dict):
        raise RuntimeError("This run's test set has already been evaluated")

    split = pd.read_csv(args.run_dir / "split.csv")
    metadata = pd.read_csv(DATA / "metadata.csv")
    test = metadata.merge(split.loc[split.split == "test", ["img_id", "patient_id"]],
                          on=["img_id", "patient_id"], validate="one_to_one")
    torch.set_num_threads(4)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = models.mobilenet_v3_small(weights=None)
    model.classifier[3] = nn.Linear(model.classifier[3].in_features, 1)
    model.load_state_dict(torch.load(args.run_dir / "best.pt", map_location=device, weights_only=True))
    model.to(device)
    loader = DataLoader(Lesions(test, False), batch_size=args.batch_size, shuffle=False)
    y, probabilities = predict(model, loader, device)
    threshold = report["validation"]["threshold"]
    report["test"] = metrics(y, probabilities, threshold)
    report["test_by_diagnosis"] = {
        diagnosis: {
            "n": int(sum(test.diagnostic == diagnosis)),
            "flagged": int(sum((probabilities >= threshold) & (test.diagnostic.to_numpy() == diagnosis))),
        }
        for diagnosis in sorted(CLASSES)
    }
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
