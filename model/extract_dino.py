"""Extract DINOv2-S image embeddings without using lesion labels."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms

from train import DATA


class Photos(Dataset):
    def __init__(self, names):
        self.names = list(names)
        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])

    def __len__(self):
        return len(self.names)

    def __getitem__(self, index):
        with Image.open(DATA / "images" / self.names[index]) as image:
            return self.transform(image.convert("RGB"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--threads", type=int, default=4)
    args = parser.parse_args()
    out = DATA / "dinov2_small_features.npz"
    if out.exists():
        raise FileExistsError(f"Features already exist: {out}")
    torch.set_num_threads(args.threads)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Loading DINOv2-S on {device}", flush=True)
    model = torch.hub.load("facebookresearch/dinov2", "dinov2_vits14", trust_repo=True)
    model.eval().to(device)
    metadata = pd.read_csv(DATA / "metadata.csv")
    names = metadata.img_id.tolist()
    loader = DataLoader(Photos(names), batch_size=args.batch_size, shuffle=False)
    features = []
    with torch.inference_mode():
        for batch, images in enumerate(loader, 1):
            embeddings = model(images.to(device))
            features.append(embeddings.cpu().numpy())
            if batch % 10 == 0 or batch == len(loader):
                print(f"Encoded {min(batch * args.batch_size, len(names))}/{len(names)}", flush=True)
    array = np.concatenate(features).astype(np.float32)
    assert len(array) == len(names)
    np.savez_compressed(out, img_id=np.asarray(names), embedding=array)
    print(f"Saved {array.shape} embeddings to {out}", flush=True)


if __name__ == "__main__":
    main()
