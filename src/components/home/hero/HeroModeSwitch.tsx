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
 * HeroModeSwitch
 *
 * Pill-style switcher for the four main creation modes.
 * Active pill gets the brand gradient; inactive pills are transparent.
 * Clicking a pill also navigates to the corresponding studio route.
 *
 * Local state only — no global context needed.
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
              fontWeight: isActive ? 600 : 400,
              letterSpacing: "-0.01em",
              color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
              background: isActive
                ? "linear-gradient(90deg, #2563eb 0%, #8b5cf6 100%)"
                : "transparent",
              border: "none",
              cursor: "pointer",
              transition: "color 0.18s ease, background 0.18s ease",
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
