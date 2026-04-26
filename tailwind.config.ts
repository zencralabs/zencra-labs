import type { Config } from "tailwindcss";

const config: Config = {
  // Enable class-based dark mode (controlled by next-themes)
  darkMode: "class",

  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      // ─── Zencra Labs Brand Colors ───────────────────────────────────────
      colors: {
        // Deep Navy (primary backgrounds)
        navy: {
          950: "#0F1A32", // Darkest – main dark bg
          900: "#1A2744",
          800: "#1E3160",
          700: "#243975",
        },
        // Electric Blue (primary accent)
        electric: {
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB", // ← Brand primary
          700: "#1D4ED8",
        },
        // Teal (secondary accent)
        teal: {
          400: "#2DD4CE",
          500: "#0EA5A0", // ← Brand secondary
          600: "#0C8E8A",
        },
        // Light (text & light backgrounds)
        light: {
          50: "#F8FAFC",  // ← Main light bg
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
        },
      },

      // ─── CSS Variable Mapping ────────────────────────────────────────────
      // These map to the CSS variables in globals.css
      backgroundColor: {
        background: "var(--background)",
        card: "var(--card)",
        "card-hover": "var(--card-hover)",
      },
      textColor: {
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
      },
      borderColor: {
        border: "var(--border)",
      },

      // ─── Typography ──────────────────────────────────────────────────────
      fontFamily: {
        // Display / Headings — Syne
        display: ["var(--font-display)", "Syne", "system-ui", "sans-serif"],
        // Body / UI / Forms — Neue Montreal (Familjen Grotesk stand-in)
        sans:    ["var(--font-sans)", "Familjen Grotesk", "Helvetica Neue", "Arial", "sans-serif"],
        ui:      ["var(--font-sans)", "Familjen Grotesk", "Helvetica Neue", "Arial", "sans-serif"],
        // Legacy alias — kept for backwards compat; resolves same as font-sans
        body:    ["var(--font-sans)", "Familjen Grotesk", "Helvetica Neue", "Arial", "sans-serif"],
        mono:    ["JetBrains Mono", "monospace"],
      },

      // ─── Zencra Type Scale ───────────────────────────────────────────────
      // Syne tracking is tuned per-step — at large sizes Syne opens up and
      // needs aggressive negative tracking to read as cinematic/tight.
      fontSize: {
        // Display — hero headings, brand moments
        "display-2xl": ["6.25rem", { lineHeight: "0.9",  letterSpacing: "-0.075em" }], // 100px
        "display-xl":  ["5.25rem", { lineHeight: "0.92", letterSpacing: "-0.07em"  }], // 84px
        "display-lg":  ["4.35rem", { lineHeight: "0.96", letterSpacing: "-0.065em" }], // ~70px
        "display-md":  ["3.5rem",  { lineHeight: "1",    letterSpacing: "-0.055em" }], // 56px
        "display-sm":  ["2.9rem",  { lineHeight: "1.05", letterSpacing: "-0.045em" }], // ~46px
        // Headings — section titles, studio titles
        "heading-xl":  ["2.65rem", { lineHeight: "1.08", letterSpacing: "-0.045em" }], // ~42px
        "heading-lg":  ["2.15rem", { lineHeight: "1.12", letterSpacing: "-0.04em"  }], // ~34px
        "heading-md":  ["1.75rem", { lineHeight: "1.18", letterSpacing: "-0.03em"  }], // 28px
        "heading-sm":  ["1.45rem", { lineHeight: "1.22", letterSpacing: "-0.02em"  }], // ~23px
        // Body — readable paragraph text
        "body-xl":     ["1.25rem",  { lineHeight: "1.65", letterSpacing: "-0.01em"  }], // 20px
        "body-lg":     ["1.125rem", { lineHeight: "1.65", letterSpacing: "-0.01em"  }], // 18px
        "body-md":     ["1rem",     { lineHeight: "1.65", letterSpacing: "-0.005em" }], // 16px
        "body-sm":     ["0.9375rem",{ lineHeight: "1.55", letterSpacing: "0"        }], // 15px
        // UI — controls, labels, nav, buttons
        "ui-lg":       ["1rem",     { lineHeight: "1.35", letterSpacing: "-0.005em" }], // 16px
        "ui-md":       ["0.9375rem",{ lineHeight: "1.35", letterSpacing: "0"        }], // 15px
        "ui-sm":       ["0.875rem", { lineHeight: "1.35", letterSpacing: "0.005em"  }], // 14px
        "caption":     ["0.8125rem",{ lineHeight: "1.4",  letterSpacing: "0.01em"   }], // 13px
      },

      // ─── Spacing & Sizing ────────────────────────────────────────────────
      maxWidth: {
        site: "100%",   // Full-width — padding handles gutters
      },

      // ─── Gradients ───────────────────────────────────────────────────────
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #2563EB 0%, #0EA5A0 100%)",
        "brand-gradient-dark":
          "linear-gradient(135deg, #1D4ED8 0%, #0C8E8A 100%)",
        "hero-glow":
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(37,99,235,0.3) 0%, transparent 60%)",
      },

      // ─── Box Shadows ─────────────────────────────────────────────────────
      boxShadow: {
        glow: "0 0 40px rgba(37, 99, 235, 0.25)",
        "glow-teal": "0 0 40px rgba(14, 165, 160, 0.25)",
        card: "0 4px 24px rgba(0, 0, 0, 0.12)",
        "card-dark": "0 4px 24px rgba(0, 0, 0, 0.4)",
      },

      // ─── Animations ──────────────────────────────────────────────────────
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.6s ease-out",
        "pulse-slow": "pulse 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },

  plugins: [],
};

export default config;
