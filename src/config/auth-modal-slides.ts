/**
 * AUTH MODAL RIGHT-PANEL SLIDES — Configurable showcase carousel
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO CUSTOMISE THE RIGHT PANEL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * OPTION A — Gradient only (default, no images needed)
 *   Set `imageSrc` to null / undefined.
 *   The panel renders a colour gradient + animated glow.
 *
 * OPTION B — Static image background
 *   1. Place your image in /public/auth-panel/  (create the folder if needed)
 *      Example: /public/auth-panel/slide-kling.jpg
 *   2. Set `imageSrc: "/auth-panel/slide-kling.jpg"` in the slide below.
 *   3. Image is rendered as CSS background-image over the gradient.
 *   Recommended: 840×960px, JPG/WebP, <300 KB
 *
 * OPTION C — Video background
 *   1. Place your video in /public/auth-panel/
 *      Example: /public/auth-panel/slide-kling.mp4
 *   2. Set `videoSrc: "/auth-panel/slide-kling.mp4"` in the slide.
 *   3. Videos are muted + autoplay + loop — keep them <5 MB.
 *
 * SLIDE FIELDS
 *   gradient   — CSS gradient for the background (always shown even with media)
 *   accent     — Hex colour for glow + dots + tool indicator
 *   tool       — AI tool name shown above the title (e.g. "Kling 3.0")
 *   title      — Large headline shown in the panel
 *   desc       — Short marketing description (1–2 sentences)
 *   imageSrc   — (optional) path relative to /public/ for a static image
 *   videoSrc   — (optional) path relative to /public/ for a looping video
 *
 * WHERE TO UPLOAD FILES
 *   In your project folder: zencra-labs/public/auth-panel/
 *   After deploying, assets are served from: https://zencralabs.com/auth-panel/filename
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface AuthSlide {
  gradient: string;
  accent: string;
  tool: string;
  title: string;
  desc: string;
  imageSrc?: string;
  videoSrc?: string;
}

export const AUTH_SLIDES: AuthSlide[] = [
  {
    gradient: "linear-gradient(160deg, #060d1f 0%, #0f2255 40%, #1d4ed8 100%)",
    accent:   "#2563EB",
    tool:     "Kling 3.0",
    title:    "Cinematic AI Video",
    desc:     "Best price on market for generations on the best video model",
    // imageSrc: "/auth-panel/slide-kling.jpg",
    // videoSrc: "/auth-panel/slide-kling.mp4",
  },
  {
    gradient: "linear-gradient(160deg, #0d0618 0%, #2a0e52 40%, #7c3aed 100%)",
    accent:   "#A855F7",
    tool:     "Nano Banana Pro",
    title:    "AI Image Generation",
    desc:     "Write a prompt and create stunning 4K images instantly",
    // imageSrc: "/auth-panel/slide-nanobana.jpg",
  },
  {
    gradient: "linear-gradient(160deg, #060d18 0%, #0a2828 40%, #0d6b67 100%)",
    accent:   "#0EA5A0",
    tool:     "Google Veo",
    title:    "AI Video with Sound",
    desc:     "Advanced AI video generation with realistic audio",
    // imageSrc: "/auth-panel/slide-veo.jpg",
  },
  {
    gradient: "linear-gradient(160deg, #180a06 0%, #3d1408 40%, #c2410c 100%)",
    accent:   "#F97316",
    tool:     "Runway ML",
    title:    "Gen-3 Alpha Turbo",
    desc:     "Edit scenes and elements with professional precision",
    // imageSrc: "/auth-panel/slide-runway.jpg",
  },
];
