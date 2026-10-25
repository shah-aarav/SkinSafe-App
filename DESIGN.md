---
name: SkinSafe
description: A quiet, device-first interface for keeping a clear record of one skin spot.
colors:
  background: "#171717"
  outer-background: "#111111"
  surface: "#202020"
  text: "#f2efeb"
  muted: "#aaa6a2"
  clay: "#d7bda9"
  clay-hover: "#e7d2c1"
  clay-active: "#c2a58f"
  clay-text: "#28201b"
  clay-illustration: "#b99a88"
  line: "#393735"
  line-strong: "#4e4945"
rounded:
  field: "9px"
  control: "10px"
  panel: "16px"
  desktop-shell: "20px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "29px"
    fontWeight: 650
    lineHeight: 1.18
    letterSpacing: "-0.035em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
components:
  button-primary:
    backgroundColor: "{colors.clay}"
    textColor: "{colors.clay-text}"
    rounded: "{rounded.control}"
    padding: "13px 18px"
    height: "52px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "13px 18px"
    height: "52px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "0 13px"
    height: "52px"
---

# Design System: SkinSafe

## Overview

**Creative North Star: “A Clear Path.”**

SkinSafe uses a dark, restrained interface to make a personal skin record feel manageable. System sans-serif typography keeps the task familiar; Manrope is reserved for the welcome headline. A small warm lesion illustration gives the entry screen a human focal point, while warm clay carries the primary action and active states throughout the shipped flow.

The interface is spacious and left aligned, with full-width controls and a single-column record flow. Color supports task hierarchy, but status and uncertainty are also stated in words. The visual language reflects a record-taking tool; it does not present itself as a diagnostic instrument.

**Key Characteristics:**
- Charcoal canvas with neutral, near-black surfaces.
- Warm clay for primary actions and active states, with deeper clay in the entry illustration.
- Quiet geometry, generous task spacing, and clear written limitations.

## Colors

The shipped screens use near-black charcoal and warm clay as their shared accent for primary actions, focus, and active states. Deeper clay details the entry illustration. The frontmatter values are the source of truth.

### Primary
- **Warm clay**: Primary buttons, focus outlines, progress states, and selected answers across the entry and record flows.

### Secondary
- **Deep clay**: Spot illustration contours and secondary warm details on the entry screen.

### Neutral
- **Charcoal**: Main application canvas; the outer background is slightly darker.
- **Near-black**: Photo and form surfaces.
- **Warm off-white**: Main text.
- **Stone gray**: Supporting copy and secondary labels.
- **Charcoal gray**: Dividers and outlines.

**The Written-State Rule.** Color reinforces state; labels and copy still carry the meaning.

## Typography

**Display Font:** Manrope (sans-serif fallback)
**Body Font:** System UI (`-apple-system`, BlinkMacSystemFont, Segoe UI, sans-serif)

**Character:** The system stack keeps the task familiar and readable. Manrope gives the entry message a slightly more composed voice without changing the utility screens' typography.

### Hierarchy
- **Display** (600, 40px desktop; 34px tablet; 32px mobile, 1.2 line-height): Welcome headline; it scales down at narrower breakpoints.
- **Headline** (650, 29px, 1.18 line-height): Main record-flow screen titles; small screens reduce this to 27px.
- **Title** (600, 19px, 1.3 line-height): Secondary section headings.
- **Body** (400, 15px, 1.5 line-height): Explanatory copy; supporting paragraphs use muted color.
- **Label** (500, 13–14px): Field labels, choices, and compact controls.

## Layout

The entry screen uses a wide two-column composition on desktop, with the spot graphic beside the welcome or email/password forms. At 600px and below, the welcome screen stacks the graphic above the actions, while the account forms hide the graphic to keep the fields and primary action in view. The device tagline and art caption are hidden on mobile. The entry shell is capped at 1320px. The in-app flow is a centered, single-column sheet (480px maximum by default, 520px from 700px, and 580px from 900px) with 24px mobile gutters and wider desktop padding. A three-stop horizontal progress indicator sits above the photo, details, and review stages. Spacing is most often built in 8px increments; primary controls are full width in the working flow.

## Elevation & Depth

The interface is mostly flat. Separation comes from subtle differences between charcoal surfaces, fine borders, and spacing. The active progress stop uses a background-colored halo to preserve its outline against the connecting rule; it is not a general shadow treatment.

## Shapes

Controls use softly rounded corners, while dividers and measurement graphics remain fine and geometric. Buttons use 10px corners; fields and selectable answers use a tighter 9px radius. The photo frame, desktop app sheet, and entry artwork have larger, restrained corners. The spot mark, progress stops, and logo detail use circles; the entry brand mark is a slightly rotated rounded square.

## Components

### Buttons
- **Primary:** Clay fill, dark warm text, 52px minimum height, and 10px corners. In the entry screen the label is left aligned and the arrow sits at the far edge; in the working flow content is centered.
- **Secondary:** Transparent fill with a fine outline and the same height and radius as primary.
- **Hover / Active:** Primary shifts to its lighter and darker clay values. Secondary uses a subtle warm charcoal fill on hover.
- **Focus:** Visible controls use a 2px clay outline with a 4px offset.

### Inputs / Fields
- **Style:** Near-black fill, subdued border, 9px corners, 52px height, and 13px horizontal inset.
- **Focus:** Shared clay focus outline; placeholders use the supporting text color.

### Navigation
- **Progress:** Three equal-width stops with a thin connecting rule. Current and completed steps use clay, and each step retains its text label.
- **Utility controls:** About and similar quiet actions use small outlined or text-only controls; the primary task remains the dominant button.

### Selectable Answers
- **Style:** Equal-width outlined choices on a dark surface with 9px corners.
- **Selected:** Clay text and border over a warm charcoal surface; selected meaning is not color-only because the option label remains visible.

### Photo Frame
- **Style:** Large, flat near-black viewing area with a fine border and 12px corners. Empty state uses four camera-guide corners and a centered camera icon; a chosen image is contained without cropping in the capture step.

### Spot Illustration
- **Style:** Authored concentric circles, crop-guide corners, and a central organic spot shape. Clay tones appear only in this entry artwork; on mobile the graphic shrinks and the caption is hidden.

## Do's and Don'ts

### Do:
- **Do** use clay as the primary action and focus color across entry and working screens.
- **Do** keep the photo frame, field surfaces, and app canvas within the dark charcoal palette.
- **Do** state uncertainty and limitations in readable text alongside any visual status.
- **Do** preserve the centered one-column working flow and the entry screen's desktop-to-mobile stack.

### Don't:
- **Don't** present a negative model flag as reassurance or imply this UI diagnoses a condition.
- **Don't** introduce a second accent hue for working-flow actions; the shipped controls share the clay accent.
- **Don't** use glow, neon, or heavy elevation; the shipped interface uses restrained borders and tonal separation.
