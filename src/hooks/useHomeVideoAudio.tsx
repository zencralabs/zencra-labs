"use client";

/**
 * useHomeVideoAudio — Global exclusive audio controller for all homepage videos.
 *
 * Rules:
 *   • Only ONE video may be unmuted at a time across the entire homepage.
 *   • Hover = temporary preview; audio reverts to persistent target on mouse leave.
 *   • Explicit button click = persistent unmute until another video takes over.
 *   • Browser autoplay restrictions are handled gracefully (catch Promise rejection).
 *
 * Usage:
 *   1. Wrap <HomeVideoAudioProvider> once at the top of HomePageContent.
 *   2. Call useHomeVideoAudio(id) inside any homepage video component.
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Global Zencra Audio Identity — lime accent, matches Audio Studio navbar color
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical lime audio accent — import this wherever audio UI appears on homepage */
export const AUDIO_LIME = "#84CC16" as const;

/** Pre-mixed rgba values derived from AUDIO_LIME (132, 204, 22) */
export const AUDIO_LIME_COLORS = {
  icon:          AUDIO_LIME,                           // active icon fill
  bg:            "rgba(132,204,22,0.12)",              // active button background
  bgHover:       "rgba(132,204,22,0.22)",              // active button on hover
  border:        "rgba(132,204,22,0.40)",              // active border
  glow:          "0 0 14px rgba(132,204,22,0.38)",     // active glow shadow
  glowHover:     "0 0 20px rgba(132,204,22,0.55)",     // hover glow shadow
  mutedIcon:     "rgba(255,255,255,0.32)",             // muted icon (low opacity)
  mutedBg:       "rgba(0,0,0,0.52)",                  // muted button background
  mutedBgHover:  "rgba(255,255,255,0.10)",             // muted button on hover
  mutedBorder:   "rgba(255,255,255,0.14)",             // muted border
  mutedGlow:     "0 2px 10px rgba(0,0,0,0.45)",       // muted shadow
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────────────────────────────────────

interface HomeVideoAudioCtx {
  /** Currently active (unmuted) video id — null when all are muted */
  activeId: string | null;
  /** Click-based persistent unmute target — survives mouse leave */
  persistentId: string | null;
  /** mouseenter — temporarily unmute this id (reverts on hoverRelease) */
  hoverRequest: (id: string) => void;
  /** mouseleave — revert active to persistentId (or null) */
  hoverRelease: (id: string) => void;
  /** mute-button click — toggle persistent unmute for this id */
  togglePersistent: (id: string) => void;
}

const Ctx = createContext<HomeVideoAudioCtx | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function HomeVideoAudioProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId]       = useState<string | null>(null);
  const [persistentId, setPersistentId] = useState<string | null>(null);

  /**
   * persistentRef mirrors persistentId state.
   * Used inside hoverRelease callback so it always reads the latest value
   * without needing to be in the callback's dependency array (avoids stale closure).
   */
  const persistentRef = useRef<string | null>(null);

  const hoverRequest = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const hoverRelease = useCallback((_id: string) => {
    // Revert to the persisted video (or silence everything if none)
    setActiveId(persistentRef.current);
  }, []);

  const togglePersistent = useCallback((id: string) => {
    if (persistentRef.current === id) {
      // Already the persistent target → mute everything
      persistentRef.current = null;
      setPersistentId(null);
      setActiveId(null);
    } else {
      // Make this video the new persistent target
      persistentRef.current = id;
      setPersistentId(id);
      setActiveId(id);
    }
  }, []);

  return (
    <Ctx.Provider value={{ activeId, persistentId, hoverRequest, hoverRelease, togglePersistent }}>
      {children}
    </Ctx.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Consumer hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useHomeVideoAudio(id)
 *
 * Returns bound audio-controller callbacks for a specific video id.
 * Safe to call outside the provider (gracefully returns no-op functions).
 */
export function useHomeVideoAudio(id: string) {
  const ctx = useContext(Ctx);

  if (!ctx) {
    // Graceful fallback — no provider in tree (e.g. Storybook, isolated tests)
    return {
      isActive:     false,
      isPersistent: false,
      hoverRequest:    () => {},
      hoverRelease:    () => {},
      togglePersistent: () => {},
    };
  }

  return {
    /** True when this video is currently the unmuted one */
    isActive:     ctx.activeId === id,
    /** True when this video holds the persistent (click-based) unmute */
    isPersistent: ctx.persistentId === id,
    hoverRequest:    () => ctx.hoverRequest(id),
    hoverRelease:    () => ctx.hoverRelease(id),
    togglePersistent: () => ctx.togglePersistent(id),
  };
}
