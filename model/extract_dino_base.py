"""Extract frozen DINOv2-B photo embeddings for a stronger-encoder experiment."""

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader

from extract_dino import Photos
from train import DATA


def main():
    output = DATA / "dinov2_base_features.npz"
    if output.exists():
        raise FileExistsError(output)
    torch.set_num_threads(4)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    encoder = torch.hub.load("facebookresearch/dinov2", "dinov2_vitb14", trust_repo=True)
    encoder.eval().to(device)
    names = pd.read_csv(DATA / "metadata.csv").img_id.tolist()
    loader = DataLoader(Photos(names), batch_size=8, shuffle=False)
    chunks = []
    with torch.inference_mode():
        for index, images in enumerate(loader, 1):
            chunks.append(encoder(images.to(device)).cpu().numpy())
            if index % 20 == 0 or index == len(loader):
                print(f"Encoded {min(index * 8, len(names))}/{len(names)}", flush=True)
    features = np.concatenate(chunks).astype(np.float32)
    assert len(features) == len(names)
    np.savez_compressed(output, img_id=np.asarray(names), embedding=features)
    print(f"Saved {features.shape} to {output}", flush=True)


if __name__ == "__main__":
    main()
