"""Download PAD-UFES-20 images and make a compact local training copy."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path
import time

import pandas as pd
import requests
from huggingface_hub import list_repo_tree
from PIL import Image, ImageOps


REPO = "SalmaneExploring/pad-ufes-20"
ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
BASE_URL = f"https://huggingface.co/datasets/{REPO}/resolve/main"


def fetch_image(path: str, out_dir: Path, size: int) -> None:
    out = out_dir / Path(path).name
    if out.exists():
        return
    url = f"{BASE_URL}/{path}"
    for attempt in range(4):
        try:
            response = requests.get(url, timeout=90)
            response.raise_for_status()
            with Image.open(BytesIO(response.content)) as image:
                image = ImageOps.exif_transpose(image).convert("RGB")
                image.thumbnail((size, size), Image.Resampling.LANCZOS)
                image.save(out, format="JPEG", quality=90, optimize=True)
            return
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--size", type=int, default=384)
    args = parser.parse_args()

    DATA.mkdir(exist_ok=True)
    image_dir = DATA / "images"
    image_dir.mkdir(exist_ok=True)
    metadata_path = DATA / "metadata.csv"
    if not metadata_path.exists():
        response = requests.get(f"{BASE_URL}/metadata.csv", timeout=60)
        response.raise_for_status()
        metadata_path.write_bytes(response.content)

    metadata = pd.read_csv(metadata_path)
    expected = set(metadata.img_id)
    if len(metadata) != 2298 or len(expected) != 2298:
        raise RuntimeError("Unexpected metadata size or duplicate image IDs")

    paths = [
        item.path
        for item in list_repo_tree(
            REPO, repo_type="dataset", path_in_repo="all_images", recursive=True
        )
        if getattr(item, "path", "").endswith(".png")
    ]
    by_name = {Path(path).name: path for path in paths}
    if set(by_name) != expected:
        missing = expected - set(by_name)
        raise RuntimeError(f"Mirror mismatch: {len(missing)} missing images")

    pending = [by_name[name] for name in expected if not (image_dir / name).exists()]
    print(f"Downloading/resizing {len(pending)} of {len(expected)} images", flush=True)
    failed = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(fetch_image, path, image_dir, args.size): path for path in pending}
        for n, future in enumerate(as_completed(futures), 1):
            try:
                future.result()
            except Exception as exc:
                failed.append((futures[future], str(exc)))
            if n % 100 == 0 or n == len(pending):
                print(f"Processed {n}/{len(pending)}; failed {len(failed)}", flush=True)

    if failed:
        raise RuntimeError(f"Failed downloads ({len(failed)}): {failed[:5]}")
    print(f"Ready: {len(expected)} images, {metadata.patient_id.nunique()} patients", flush=True)


if __name__ == "__main__":
    main()
