# SkinCheck model experiment

An image-only, research-stage classifier for the six lesion categories in
PAD-UFES-20. It is **not** a medical device and cannot rule out cancer.

## Data

Source: Pacheco et al., PAD-UFES-20, CC BY 4.0.
https://data.mendeley.com/datasets/zr7vgbcyr2/1

The `prepare_data.py` script retrieves the original dataset images from a
Hugging Face mirror and resizes them to 384 px for local training. The
metadata and diagnostic labels are checked against the source CSV. Images are
not included in this project folder by default.

## Reproduce

```powershell
.venv\Scripts\python.exe prepare_data.py
.venv\Scripts\python.exe train.py --epochs 12
.venv\Scripts\python.exe finalize.py runs\<selected-run>
```

The stronger image-only experiment uses a frozen DINOv2-S encoder and trains
a supervised classifier on its image embeddings:

```powershell
.venv\Scripts\python.exe extract_dino.py
.venv\Scripts\python.exe train_dino.py
```

`train.py` writes the best validation checkpoint and keeps the test set sealed.
After selecting a run, `finalize.py` evaluates that run once on the held-out
test set. Split is by `patient_id`, so multiple photos from the same person
cannot cross train, validation, or test boundaries. Test data is never used
for model or threshold selection.

The positive class is BCC, SCC, or MEL. ACK is assigned to the non-cancer
class in accordance with the source's six-way labels, but can still be
clinically concerning; this binary label is **not** a safe-to-ignore verdict.
