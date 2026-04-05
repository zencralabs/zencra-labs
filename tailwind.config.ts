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
        sans:    ["var(--font-body)", "Familjen Grotesk", "system-ui", "sans-serif"],
        body:    ["var(--font-body)", "Familjen Grotesk", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Syne", "system-ui", "sans-serif"],
        mono:    ["JetBrains Mono", "monospace"],
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
