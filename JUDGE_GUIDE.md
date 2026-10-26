# SkinSafe judge guide

1. Open https://skinsafe-cac.vercel.app/ and sign in with username `skinsafe2026` and password `skinsafe2026`. The home screen greets you with **Hey User.**
2. Open **Latest record** to see a saved photo, its spot details, next steps, and suggested questions. **View all** shows the other saved examples.
3. Select **Check a new spot**, download one of the three files below from this repository, and upload it through the normal photo picker. Enter the corresponding answers from the linked JSON file. The answers are from the research records; they are not instructions to invent symptoms.
4. After the result, try a suggested question or type your own. **Hear answer** plays the voice response when the speech service is available. Search for dermatologists by ZIP code if desired.

| Photo | Dataset label | Details |
| --- | --- | --- |
| [`upload-nevus.jpg`](assets/judge-uploads/upload-nevus.jpg) | Nevus (mole) | [`uploads.json`](public/judge/uploads.json) → `upload-NEV` |
| [`upload-bcc.jpg`](assets/judge-uploads/upload-bcc.jpg) | Basal cell carcinoma | [`uploads.json`](public/judge/uploads.json) → `upload-BCC` |
| [`upload-scc.png`](assets/judge-uploads/upload-scc.png) | Squamous cell carcinoma | [`uploads.json`](public/judge/uploads.json) → `upload-SCC` |

The three photos are public PAD-UFES-20 research examples, not this account holder’s medical history. The online upload result recognizes the supplied files; an unrelated photo is not assigned a condition by this version. Dataset photo attribution and technical notes are in [`README.md`](README.md).
