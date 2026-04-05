# Zencra Labs – Setup Guide

## Quick Start (run these commands in your terminal)

```bash
# 1. Navigate into the project folder
cd zencra-labs

# 2. Install all dependencies
npm install

# 3. Copy the environment file
cp .env.local.example .env.local

# 4. Start the development server
npm run dev
```

Then open **http://localhost:3000** in your browser.

---

## Project Structure

```
zencra-labs/
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← Root layout (font, metadata, Navbar, Footer)
│   │   ├── globals.css         ← Design tokens (CSS variables, Tailwind base)
│   │   └── page.tsx            ← Homepage
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx      ← Sticky navigation with dark mode toggle
│   │   │   └── Footer.tsx      ← Site footer
│   │   ├── providers/
│   │   │   └── ThemeProvider.tsx  ← next-themes wrapper
│   │   └── ui/
│   │       ├── Button.tsx      ← Reusable button (5 variants, 3 sizes)
│   │       ├── Logo.tsx        ← Swappable logo component
│   │       └── ThemeToggle.tsx ← Light/dark mode switch
│   └── lib/
│       └── utils.ts            ← cn(), formatDate(), truncate()
├── public/
│   └── logo/                   ← Drop your logo files here (see below)
├── tailwind.config.ts          ← Brand colors + design tokens
├── .env.local.example          ← Environment variables template
└── SETUP.md                    ← This file
```

---

## Swapping the Logo (When Going Live)

1. Export your logo as SVG in two versions:
   - `logo-dark.svg`  → colored/white logo for dark backgrounds
   - `logo-light.svg` → dark logo for light backgrounds

2. Place both files in `/public/logo/`

3. Open `src/components/ui/Logo.tsx` and:
   - Find the `Image-based Logo` block (commented out near the bottom)
   - Uncomment it
   - Remove or comment out the `Inline SVG Fallback` block above it

That's it — the logo automatically serves the right file per theme.

---

## Adding New Pages

Create a new file in `src/app/`:

```
src/app/services/page.tsx    → /services
src/app/portfolio/page.tsx   → /portfolio
src/app/contact/page.tsx     → /contact
src/app/tools/page.tsx       → /tools
```

Each page automatically gets the Navbar and Footer from the root layout.

---

## Deploying to Vercel

1. Push the project to GitHub
2. Connect your GitHub repo to Vercel at vercel.com
3. Add your environment variables in Vercel → Project Settings → Environment Variables
4. Every push to `main` auto-deploys
