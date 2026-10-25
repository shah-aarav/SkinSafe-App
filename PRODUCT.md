# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, TypeScript, and Vite as an iPhone-first web UI, with a loopback Node.js and SQLite backend for email/password authentication and account-specific records. Model training is in `../skincheck-model`; local inference is connected through `/api/assess`. Hosting remains to be implemented.

## Users

People who notice a skin spot and want to document it and decide whether to seek clinician review. The Congressional App Challenge judges are an evaluation audience.

## Product Purpose

SkinSafe guides someone through photographing one spot, answering relevant questions, and receiving a cautious review suggestion. Success means an understandable, honest next step without suggesting the app can diagnose or clear a lesion.

## Positioning

The app combines an ordinary phone photo with self-reported details, explicitly handles uncertain or poor images, and avoids a reassuring "safe" verdict. Its model has a patient-separated held-out evaluation rather than an invented accuracy claim.

## Operating Context

Used on an iPhone in a brief, potentially anxious moment. The user may be photographing their own skin or asking someone for help. One spot is checked at a time.

## Capabilities and Constraints

- Primary flow: create an account or log in; capture or choose a photo; answer model-required questions; review the record; optionally save it to the account or prepare a clinician handoff.
- The tested 90.4%-accuracy model requires a photo plus user-answerable fields: age, lesion region, two measured diameters, itch, growth, pain, change, bleeding, elevation, gender, Fitzpatrick skin type, prior skin cancer, and prior cancer.
- The user chose the tested photo-plus-questions flow over the faster photo-only flow.
- Entry offers working email/password registration and login. Password hashes and sessions live in SQLite on the local server; each account has its own record. This is not yet a hosted, HTTPS-secured, recovery-enabled service.
- Do not claim clinical validation. The model missed 4 of 14 melanoma photos in its held-out test set; it must not rule out cancer or call a spot safe.
- The photographed-lesion dataset contains six categories only; the result cannot generalize to all rashes or skin conditions.
- A photo stays in browser memory until the user explicitly requests a check or saves it to their account on the local server. Saved records contain the photo and answers; download notes to keep the current assessment.

## Brand Commitments

Working product name: SkinSafe. The user prefers practical, uncluttered app experiences, concise copy, near-black charcoal surfaces, a restrained muted accent, and some graphics. The entry experience includes Create account and Log in.

## Evidence on Hand

Training code, evaluation, and limitations are in `../skincheck-model/MODEL_CARD.md`. The held-out report is in `../skincheck-model/runs/20261013-195001-ensemble-full/report.json`. Source dataset: PAD-UFES-20, CC BY 4.0.

## Product Principles

1. Make photo capture and the next step obvious.
2. Gather the required details without making the user feel interrogated.
3. State uncertainty plainly; never turn a negative model flag into reassurance.
4. Upload a photo only when the user explicitly checks or saves it; keep records separated by account.

## Accessibility & Inclusion

Large touch targets, readable text, clear non-color status language, and support for different skin tones. The current model has not undergone an external fairness evaluation, so the interface must not imply equal performance across skin tones.
