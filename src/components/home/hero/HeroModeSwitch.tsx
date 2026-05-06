"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Studio modes shown in the hero pill-switcher */
const MODES = [
  { id: "video",   label: "Video",    route: "/studio/video" },
  { id: "image",   label: "Image",    route: "/studio/image" },
  { id: "audio",   label: "Audio",    route: "/studio" },
  { id: "lipsync", label: "Lip-Sync", route: "/studio/video" },
] as const;

type ModeId = (typeof MODES)[number]["id"];

/**
 * HeroModeSwitch — pill-style mode switcher.
 *
 * Theme (Zencra brand):
 *   Active pill  → blue→purple gradient, white text
 *   Inactive pill → transparent, white/45 text
 *
 * Clicking a pill also navigates to the corresponding studio route.
 */
export function HeroModeSwitch() {
  const [active, setActive] = useState<ModeId>("video");
  const router = useRouter();

  return (
    <div
      role="tablist"
      aria-label="Creation mode"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        padding: "4px",
      }}
    >
      {MODES.map((mode) => {
        const isActive = active === mode.id;
        return (
          <button
            key={mode.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => {
              setActive(mode.id);
              router.push(mode.route);
            }}
            style={{
              padding: "9px 22px",
              fontSize: "13px",
              fontWeight: isActive ? 700 : 400,
              letterSpacing: isActive ? "-0.01em" : "0em",
              color: "#ffffff",
              /* Active: blue→purple gradient. Inactive: transparent */
              background: isActive
                ? "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)"
                : "transparent",
              border: "none",
              cursor: "pointer",
              transition:
                "background 0.18s ease, font-weight 0.18s ease",
              whiteSpace: "nowrap" as const,
            }}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
