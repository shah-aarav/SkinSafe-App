# SkinSafe recording kit

Log in at `http://127.0.0.1:4175/` with username `skinsafeapp` and password `skinsafe`. It has 25 saved research-image records. The latest is still `01-nevus.jpg`; the other 24 are older examples. The new-upload photo `02-bcc.jpg` is not among those saved records. Open **Latest record** to show its assessment and questions. Then choose **Check a new spot** and upload `02-bcc.jpg`. Keep the server running.

| Upload | Dataset diagnosis | Current model response |
| --- | --- | --- |
| `01-nevus.jpg` | Nevus (biopsy-confirmed in PAD-UFES-20) | No flag raised |
| `02-bcc.jpg` | Basal cell carcinoma (biopsy-confirmed in PAD-UFES-20) | Flagged for clinician review |

The saved latest record keeps its recorded answers. A new upload now goes through the full questionnaire. For `02-bcc.jpg`, enter these source-recorded details:

| Screen | Answers |
| --- | --- |
| Spot details | Back; 15 mm long; 10 mm wide |
| Changes | Itch: No; growth: No; pain: Yes; color/shape change: No; bleeding: No; raised: No |
| About you | Age: 60; gender: Male; sun response: II — Usually burns, tans a little; previous skin cancer: No; previous other cancer: Yes |

The tested model uses the photo *and* those answers. A different answer or photo can change the result. These two examples were selected after seeing the model's outputs; they do not establish accuracy, and neither output is guaranteed under future model changes. A no-flag result cannot rule out cancer.

When either exact file is assessed, SkinSafe also shows its **known research-image label** from the biopsy-recorded dataset: nevus for `01-nevus.jpg`, basal cell carcinoma for `02-bcc.jpg`. This is an exact-file lookup, not a diagnosis produced by the AI model. Re-encoding, cropping, or taking another photo will not match. Keep that distinction explicit in the video.

The saved and upload images are public research cases, not this account holder's personal medical history. State that plainly in the video. Do not call a sample “healthy skin” or claim the model diagnoses BCC. Show the **What to do next** section for the flagged case: clinician examination and possible biopsy, not an at-home treatment.

## Voice questions for the two upload photos

After each assessment appears, tap a suggested question or use **Speak** (or type the exact question). These eight questions play prepared natural-voice answers. The voice guide transcribes with the browser’s speech service; it uses a limited, pre-checked answer set, not an open-ended medical diagnosis model.

For `01-nevus.jpg` (expected **No flag raised**):

1. “Does no flag mean this is safe?” → It says no: the result does not identify the spot or rule out cancer.
2. “What should I do next?” → Keep the photo as a baseline; have a new, changing, bleeding, or worrying spot examined.
3. “What changes should I watch for?” → It lists growth, color/shape change, itching, and bleeding.
4. “What is a nevus?” → It explains moles and identifies the exact research image’s dataset label, not a model prediction.

For `02-bcc.jpg` (expected **Review flag raised** with the recorded answers):

1. “What does this result mean?” → It explains the review flag and says it cannot identify a cancer type.
2. “What should I do next?” → Arrange a dermatologist examination soon and bring the photo and notes.
3. “Where can I find a dermatologist near me?” → It directs you to the ZIP-code listings below the voice guide.
4. “Can I treat this at home?” → It says not to remove or treat an unexplained spot at home.
5. “What is BCC?” → It explains basal cell carcinoma and identifies the exact research image’s dataset label, not a model prediction.
6. “Is this BCC?” → For the exact supplied file, it names the known dataset label and says it was not predicted by the model.

You can also type **“What should I bring to my appointment?”** after the BCC result. It has a separate prepared answer and natural-voice recording, while the suggested questions remain available.

For the saved nevus record, type **“What should I watch for in this mole?”**. It has a prepared answer about changes in size, shape, color, itching, and bleeding.

For a clinic-search moment, enter a ZIP code for which the live CMS directory has listings and open a provider’s directions or phone link. Listings can change, so check them before recording. If the **Speak** control is unavailable on a phone browser, type the same questions or use the iPhone keyboard’s dictation key. The same-Wi-Fi HTTP URL is not a secure context and iPhone speech recognition still needs verification on the actual device.

Source and attribution: PAD-UFES-20, André G. C. Pacheco et al. (2020), [Mendeley Data](https://data.mendeley.com/datasets/zr7vgbcyr2/1), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Source filenames and whether each was biopsied are recorded in `cases.json`. No image was altered.

For the Congressional App Challenge submission, disclose the dataset, pretrained DINOv2 encoder, libraries, and all AI-assisted development. Be prepared to explain your own code and model evaluation. The competition requires substantial student-authored technical work; this recording kit does not replace that requirement.
