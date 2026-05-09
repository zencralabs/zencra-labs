# Zencra Labs — Brand Logo Assets

This directory holds third-party provider logos used across the Zencra UI.
All files should use SVG where possible (transparent background, scalable).

---

## Video Model Strip — Login Page

These logos appear in the video model strip at the bottom of the right panel
on the `/login` page (`src/app/login/page.tsx`).

| Model             | File                                       |
|-------------------|--------------------------------------------|
| Kling 3.0         | `/brand/logos/providers/kling.svg`         |
| Seedance 2        | `/brand/logos/providers/seedance.svg`      |
| Runway Gen 4.5    | `/brand/logos/providers/runway.svg`        |
| Minimax Hailuo 2.3| `/brand/logos/providers/minimax-hailuo.svg`|
| Sora 2            | `/brand/logos/providers/sora.svg`          |

---

## Logo Specifications

- **Format**: SVG preferred. PNG accepted only if SVG is unavailable.
- **Background**: Transparent — do NOT use white or colored backgrounds.
- **ViewBox**: Square preferred (`64x64` or `32x32`). Horizontal/wordmark SVGs also accepted.
- **Display size**: `max-height: 28px`, `max-width: 34px`, `object-fit: contain`.
- **Color**: Use the provider's official brand color on transparent bg.
  Monochrome (white) versions are acceptable for dark backgrounds.

---

## How to Replace a Placeholder

1. Download the official logo SVG from the provider's brand kit / press page.
2. Rename the file to match exactly (see table above).
3. Drop it into `/public/brand/logos/providers/`.
4. No code changes needed — the login page `<img>` tags already point to these paths.

### Recommended sources

| Provider  | Brand kit / Logo URL                                |
|-----------|-----------------------------------------------------|
| Kling     | https://www.kuaishou.com / press resources          |
| Seedance  | ByteDance brand kit                                 |
| Runway    | https://runwayml.com / brand assets                 |
| MiniMax   | https://www.minimaxi.com / press                    |
| OpenAI    | https://openai.com/brand                            |

---

## Current Status

All files in `/providers/` are **temporary placeholder SVGs**.
They show the correct brand color as a letter initial.
Replace them with official assets before public launch.
