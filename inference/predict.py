"""Local JSON-lines inference worker for the trained SkinSafe research model."""

import base64
import io
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import torch
from PIL import Image, ImageOps
from torchvision import transforms

Image.MAX_IMAGE_PIXELS = 25_000_000

MODEL_DIR = Path(__file__).resolve().parents[2] / "skincheck-model"
RUN_DIR = MODEL_DIR / "runs" / "20261013-195001-ensemble-full"
THRESHOLD = 0.4004852127991104
REGIONS = {name.title(): name for name in (
    "ABDOMEN", "ARM", "BACK", "CHEST", "EAR", "FACE", "FOOT",
    "FOREARM", "HAND", "LIP", "NECK", "NOSE", "SCALP", "THIGH"
)}
YES_NO = {"Yes": "True", "No": "False", "Not sure": "UNK"}
SYMPTOMS = {
    "itch": "itch", "growth": "grew", "pain": "hurt", "change": "changed",
    "bleeding": "bleed", "elevation": "elevation",
}
transform = transforms.Compose([
    transforms.Resize(256), transforms.CenterCrop(224), transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def numeric(answers, key, minimum, maximum, allow_unknown=False):
    value = answers.get(key)
    if allow_unknown and value == "Not sure":
        return np.nan
    try:
        number = float(value)
    except (ValueError, TypeError):
        raise ValueError(f"Please enter {key}.") from None
    if not np.isfinite(number) or not minimum <= number <= maximum:
        raise ValueError(f"Please check {key}.")
    return number


def choice(answers, key, mapping):
    value = mapping.get(answers.get(key))
    if value is None:
        raise ValueError(f"The model cannot assess this {key} answer. Please check it.")
    return value


def feature_frame(embedding, answers):
    frame = pd.DataFrame([embedding], columns=[f"image_{i}" for i in range(384)])
    frame["age"] = numeric(answers, "age", 0, 120)
    frame["diameter_1"] = numeric(answers, "diameter1", 0.1, 500, True)
    frame["diameter_2"] = numeric(answers, "diameter2", 0.1, 500, True)
    frame["region"] = choice(answers, "region", REGIONS)
    for key, column in SYMPTOMS.items():
        frame[column] = choice(answers, key, YES_NO)
    frame["gender"] = choice(answers, "gender", {"Female": "FEMALE", "Male": "MALE"})
    skin_type = answers.get("skinType", "").split(" ", 1)[0]
    frame["fitspatrick"] = choice({"skinType": skin_type}, "skinType", {
        "I": "1.0", "II": "2.0", "III": "3.0", "IV": "4.0", "V": "5.0", "VI": "6.0"
    })
    for key, column in (("priorSkinCancer", "skin_cancer_history"),
                        ("priorCancer", "cancer_history")):
        frame[column] = choice(answers, key, {"Yes": "True", "No": "False"})
    return frame


def assess(payload, encoder, classifier):
    answers = payload.get("answers")
    photo_data = payload.get("photoData")
    if not isinstance(answers, dict) or not isinstance(photo_data, str):
        raise ValueError("A photo and answers are required.")
    try:
        raw = base64.b64decode(photo_data.split(",", 1)[1], validate=True)
        with Image.open(io.BytesIO(raw)) as image:
            if image.width * image.height > 25_000_000:
                raise ValueError("Please choose a photo under 25 megapixels.")
            image = ImageOps.exif_transpose(image).convert("RGB")
            if min(image.size) < 300:
                raise ValueError("Please choose a sharper, larger photo.")
            tensor = transform(image).unsqueeze(0)
    except (IndexError, OSError, base64.binascii.Error):
        raise ValueError("The photo could not be opened.") from None
    with torch.inference_mode():
        embedding = encoder(tensor).cpu().numpy()[0]
    x = feature_frame(embedding, answers)
    weight = classifier["logistic_weight"]
    score = float(weight * classifier["logistic"].predict_proba(x)[0, 1]
                  + (1 - weight) * classifier["svm"].predict_proba(x)[0, 1])
    return {"flagged": score >= THRESHOLD, "modelVersion": "pad-ufes20-dinov2-ensemble-v1"}


def main():
    torch.set_num_threads(4)
    classifier = joblib.load(RUN_DIR / "ensemble.joblib")
    encoder = torch.hub.load("facebookresearch/dinov2", "dinov2_vits14", trust_repo=True)
    encoder.eval()
    print(json.dumps({"ready": True}), flush=True)
    for line in sys.stdin:
        request = {}
        try:
            request = json.loads(line)
            result = assess(request, encoder, classifier)
            print(json.dumps({"id": request.get("id"), "result": result}), flush=True)
        except ValueError as error:
            print(json.dumps({"id": request.get("id"), "error": str(error)}), flush=True)
        except Exception as error:
            print(f"Inference error: {error}", file=sys.stderr, flush=True)
            print(json.dumps({"id": request.get("id"), "error": "Assessment unavailable. Please try again."}), flush=True)


if __name__ == "__main__":
    main()
