# SkinSafe accessibility review — 16 October 2026

Scope: account entry, photo capture, questionnaire, review/assessment, and saved-record flow in the React web app. Standard: WCAG 2.2 AA, with iPhone touch guidance. This is a code and Chromium walkthrough, not a claim of WCAG conformance or an iOS/VoiceOver certification.

| Issue and barrier | Severity | WCAG | Improvement / status |
| --- | --- | --- | --- |
| Small body/help text made potentially stressful health instructions harder to read, especially on a phone. | Moderate | 1.4.4 Resize Text; 1.4.8 Visual Presentation (AAA advisory) | Raised primary guidance to 16px and secondary guidance to 14px. Still test 200% text zoom on an iPhone. |
| Form-control outlines were near 2:1 against adjacent dark surfaces, making field boundaries hard to find. | Moderate | 1.4.11 Non-text Contrast | Raised interactive outlines to at least 3:1; warm focus outlines are stronger. Decorative rules need not meet this requirement. |
| Repeated header/progress controls had no direct bypass for keyboard users. | Moderate | 2.4.1 Bypass Blocks | Added a keyboard-visible “Skip to content” link on entry and signed-in screens. |
| The About control was 40px high and the photo-review text action only 32px high. Both were harder to tap on a moving phone. | Low–moderate | 2.5.8 Target Size (Minimum) — both met the 24px minimum; Apple 44pt guidance is stricter | Increased these to 44px. Other primary controls already meet 44px. Physical iPhone touch accuracy remains untested. |
| Measurement inputs depended on “mm” placeholder text for the unit; placeholders disappear during typing. | Moderate | 3.3.2 Labels or Instructions | Added “(mm)” to both persistent labels. |
| Photo error was rendered after the entire screen, so it could be missed when file selection failed. | Moderate | 3.3.1 Error Identification; 4.1.3 Status Messages | Moved it next to capture actions, retaining `role=alert` and actionable text. |
| Password mismatch had a general message but did not identify the specific field. | Moderate | 3.3.1 Error Identification; 3.3.3 Error Suggestion | Added `aria-invalid` and a description association on Confirm password. Server errors still use the general form alert. |
| The assessment action disappeared during loading, which could strand keyboard focus. | Moderate | 2.4.3 Focus Order; 4.1.3 Status Messages | Result/error heading now receives programmatic focus. Live status still announces the outcome. Keyboard + screen-reader behavior needs physical or assistive-tech confirmation. |
| A photo capture step can reject HEIC/HEIF even when Safari previews it, preventing iPhone photo-library use. | Moderate | 3.3.3 Error Suggestion; 1.3.1 Info and Relationships (indirect) | Added client-side JPEG conversion for decodable HEIC/HEIF and oversized images, with an explicit fallback error. Needs physical iPhone verification. |
| The app might imply that it works securely on a phone because it has account login. Same-Wi-Fi HTTP is unencrypted. | High privacy risk; not a WCAG defect | Cognitive accessibility / plain-language disclosure | Added concise warning in About and setup instructions. Use test accounts and non-sensitive photos only until HTTPS/security work is done. |

## What was checked

- Text colors: off-white on charcoal 15.64:1; muted text on charcoal 7.41:1 and on input surfaces 6.74:1; primary button text on clay 8.94:1; error text on charcoal 10.14:1. Contrast was calculated from design hex values; a full rendered-state sweep remains advisable.
- Native label/input associations, radio fieldset/legend groups, photo alt text, heading order, status/error announcements, keyboard focus styling, and native form validation were inspected in code and the browser accessibility tree.
- Account creation and the complete photo → questions → assessment flow were exercised in Chromium. A known PAD-UFES-20 photo produced a real model result. The welcome screen scored 100/100 in an automated Lighthouse accessibility run before the latest refinements; that automated score does not cover the whole app or replace manual testing.
- Mobile WebKit emulation also completed account creation, photo selection, all questions, a real model response, saving, and a reload of the saved record. A separate LAN-address run retained login after reload. Emulation is not physical iPhone Safari or VoiceOver evidence.

## Still to verify on actual devices

- iPhone Safari and VoiceOver reading order; Dynamic Type/large text and 200% zoom; physical touch-target comfort; camera/photo-library permission and HEIC conversion; landscape and 320px-width reflow.
- Keyboard-only pass with external keyboard, including the skip link and post-assessment focus. Windows high-contrast/forced-colors behavior should be checked separately.
- Error recovery with network interruption and model timeout. The current local HTTP mode is not suitable for real patient information.

Guidance: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [W3C target-size explanation](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum), [Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility), [HHS Health Literacy Online checklist](https://odphp.health.gov/healthliteracyonline/checklist/).
