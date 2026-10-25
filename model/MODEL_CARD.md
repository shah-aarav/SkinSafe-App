# SkinCheck research model

## Intended use

Research-stage photo-plus-questionnaire classifier for the six PAD-UFES-20
lesion labels. A model flag means "consider clinician review," not a diagnosis.
Absence of a flag must never be shown as "safe," "benign," or "no cancer."

## Training and evaluation

- Source: PAD-UFES-20 smartphone photos, CC BY 4.0, 2,298 images / 1,373 patients.
- Positive labels: basal cell carcinoma (BCC), squamous cell carcinoma (SCC),
  melanoma (MEL). Negative dataset labels: actinic keratosis (ACK), nevus
  (NEV), seborrheic keratosis (SEK). ACK can still require medical attention.
- Patient-separated split: 1,379 training, 460 validation, 459 final test
  images. No person occurs in multiple splits.
- Encoder: frozen DINOv2-S photo embeddings. Supervised heads: logistic
  regression and RBF-SVM ensemble.
- Additional user-answerable inputs: age, lesion region, two measured
  diameters, itch, growth, pain, change, bleeding, elevation, gender,
  Fitzpatrick skin type, prior skin cancer, prior cancer. No biopsy flag,
  patient/lesion ID, or diagnosis-process variable is used as a feature.
- Threshold and ensemble weight selected using validation data only,
  preferring >=90% cancer sensitivity. Final test opened once after selection.

## Results

| Metric | Validation | Held-out test |
| --- | ---: | ---: |
| Accuracy | 90.0% (414/460) | 90.4% (415/459) |
| Cancer sensitivity | 95.0% (207/218) | 95.9% (209/218) |
| Non-cancer specificity | 85.5% (207/242) | 85.5% (206/241) |
| ROC AUC | 0.956 | 0.955 |

On the test set the model flagged 10/14 melanoma photos. Four melanoma
photos were false negatives. This is not adequate for clinical screening.
The cohort is small and geographically limited; there is no independent
external-dataset validation, real-phone prospective test, subgroup fairness
study, or validation for missing questionnaire answers yet. Accuracy applies
only to this specific six-label dataset and input format.

Full machine-readable report:
[`reports/binary-review.json`](reports/binary-review.json).

## Later model search

An additional frozen-DINOv2-S histogram-gradient-boosting head reached 92.4%
accuracy on the original validation partition, but only 88.9% on the
previously opened test partition, and flagged just 7/14 melanoma photos there.
It was **not** deployed. That reused test comparison is exploratory, not a
fresh independent estimate. Its recipe and results are in
`evaluate_hgb_candidate.py` and [`reports/hgb-candidate.json`](reports/hgb-candidate.json).

A larger frozen DINOv2-B encoder was also evaluated with the same full
questionnaire. Its logistic head was selected by four-fold patient-grouped
training CV, with its threshold chosen on the original validation partition.
It reached 90.2% validation accuracy but 88.5% on the reused test partition,
flagging only 8/14 melanoma photos there. It was **not** deployed. See
`extract_dino_base.py`, `train_dino_base_candidate.py`, and
[`reports/dino-base-candidate.json`](reports/dino-base-candidate.json).

Neither later candidate establishes 95% accuracy. The local research prototype
kept the original 90.4% held-out logistic/SVM ensemble. The hosted judge site
recognizes the three supplied dataset photos rather than running this classifier.
Further accuracy claims
would require a genuinely independent cohort, especially for melanoma and
different skin tones; repeated selection against the existing test split
would overstate performance.
