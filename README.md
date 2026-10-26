# SkinSafe

SkinSafe is a mobile-friendly skin-record web app. It lets users sign in, keep dated photos and spot details, review saved records, ask typed questions, hear answers, and search for nearby dermatology practices. The hosted Congressional App Challenge version includes a sample account and three supplied research photos for trying the upload flow.

## Try the app

- Website: https://skinsafe-cac.vercel.app/
- Judges' account: `skinsafe2026` / `skinsafe2026`
- Original sample account: `skinsafeapp` / `skinsafe`
- Upload photos and their matching questionnaire answers: [`assets/judge-uploads/`](assets/judge-uploads/) and [`JUDGE_GUIDE.md`](JUDGE_GUIDE.md)

Both accounts start with the same 25 saved research-image records. New records are stored separately for each account in that browser, not synchronized between devices. The hosted image check recognizes the three supplied research photos, including ordinary iPhone-style recompression; it does not classify arbitrary uploads. The recorded condition names for those photos come from the dataset, not from the six-class research model. Typed answers use server-side Groq inference, with reviewed answers for common questions. Optional spoken playback uses the device's built-in voices and does not make a speech API request.

## Codebase

| Area | Files | Purpose |
| --- | --- | --- |
| Web UI | `src/`, `public/` | React, TypeScript, Vite; mobile-first screens and assets |
| Hosted endpoints | `api/`, `lib/` | Sample login, image recognition, questions, clinic search |
| Local prototype | `server.mjs`, `inference/` | Node.js, SQLite, Python assessment pipeline |
| Model research | `model/` | Python/PyTorch training and evaluation scripts, model card |
| Research samples | `samples/`, `assets/judge-uploads/`, `public/judge/` | Attribution, three upload files, sample saved records |
| Tests | `tests/` | Authentication, upload matching, question routing, and API behavior |

The separately trained binary cancer-review model and the six-category research work have different evaluation results. Read [`model/MODEL_CARD.md`](model/MODEL_CARD.md) before quoting a metric. Neither result establishes performance on arbitrary user-submitted photos or clinical safety.

## Run locally

Node.js 24 or newer is recommended.

```sh
npm install
npm test
npm run build:judge
```

The Vercel project builds with `npm run build:judge`. Its server-side endpoints require `GROQ_API_KEY` in Vercel project environment variables. Do not put that key in a `VITE_` variable, source file, or commit. The public sample login is intentionally not a private account. For the older SQLite-backed local prototype, run `npm run build` and `npm start`; that assessment route additionally needs model artifacts and the Python dependencies described under `model/`. The training dataset, trained weights, local database, deployment credentials, and secrets are not in this repository.

## Photo attribution

The included lesion photos come from **PAD-UFES-20**, André G. C. Pacheco et al. (2020), distributed through [Mendeley Data](https://data.mendeley.com/datasets/zr7vgbcyr2/1) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Original image names and labels for the curated examples are recorded in `samples/cases.json`. There are no watermarks over the images.

SkinSafe is a student research project, not a validated medical device. An image label or answer in this app does not replace an in-person examination.
