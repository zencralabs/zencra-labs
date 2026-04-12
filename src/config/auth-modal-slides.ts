/**
 * AUTH MODAL RIGHT-PANEL SLIDES — Configurable showcase carousel
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO CUSTOMISE THE RIGHT PANEL MEDIA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * UPLOAD FOLDER:  zencra-labs/public/auth/
 * LIVE URL:       https://zencralabs.com/auth/<filename>
 *
 * OPTION A — Gradient only (default, no upload needed)
 *   Leave imageSrc and videoSrc commented out. Panel shows colour gradient.
 *
 * OPTION B — Single video for all slides (RECOMMENDED)
 *   1. Place your video at:  public/auth/panel.mp4
 *   2. Uncomment videoSrc below in every slide (or just slide 1)
 *   3. Video auto-plays, muted, looped. Keep under 8 MB.
 *
 * OPTION C — Per-slide images
 *   1. Place images in:      public/auth/
 *      Naming:  slide-1.jpg  slide-2.jpg  slide-3.jpg  slide-4.jpg
 *   2. Set imageSrc on each slide below.
 *   Recommended: 840×960px, JPG/WebP, <300 KB each
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
    // ── Upload: public/auth/panel.mp4 then uncomment ──
    // videoSrc: "/auth/panel.mp4",
    // imageSrc: "/auth/slide-1.jpg",
  },
  {
    gradient: "linear-gradient(160deg, #0d0618 0%, #2a0e52 40%, #7c3aed 100%)",
    accent:   "#A855F7",
    tool:     "Nano Banana Pro",
    title:    "AI Image Generation",
    desc:     "Write a prompt and create stunning 4K images instantly",
    // imageSrc: "/auth/slide-2.jpg",
  },
  {
    gradient: "linear-gradient(160deg, #060d18 0%, #0a2828 40%, #0d6b67 100%)",
    accent:   "#0EA5A0",
    tool:     "Google Veo",
    title:    "AI Video with Sound",
    desc:     "Advanced AI video generation with realistic audio",
    // imageSrc: "/auth/slide-3.jpg",
  },
  {
    gradient: "linear-gradient(160deg, #180a06 0%, #3d1408 40%, #c2410c 100%)",
    accent:   "#F97316",
    tool:     "Runway ML",
    title:    "Gen-3 Alpha Turbo",
    desc:     "Edit scenes and elements with professional precision",
    // imageSrc: "/auth/slide-4.jpg",
  },
];
