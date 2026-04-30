"use client";

import { useRef, useState } from "react";
import { HeroCard } from "./HeroCard";

/**
 * HERO_SCENES — the cinematic showcase clips shown below the hero content.
 * Images live in /public/hero/. Components render a dark fallback if missing.
 */
export const HERO_SCENES = [
  { id: "cyberpunk", title: "Cyberpunk Chase",  tag: "Short Film",  duration: "0:12", image: "/hero/cyberpunk.jpg" },
  { id: "emotional", title: "Emotional Scene",  tag: "Cinematic",   duration: "0:10", image: "/hero/emotional.jpg" },
  { id: "desert",    title: "Desert Warrior",   tag: "Epic Scene",  duration: "0:15", image: "/hero/desert.jpg" },
  { id: "product",   title: "Product Ad",        tag: "Commercial",  duration: "0:08", image: "/hero/product.jpg" },
  { id: "ugc",       title: "AI Influencer",    tag: "UGC Video",   duration: "0:09", image: "/hero/ugc.jpg" },
  { id: "music",     title: "Music Video",       tag: "Music Video", duration: "0:11", image: "/hero/music.jpg" },
] as const;

/**
 * HeroTimeline
 *
 * A horizontally-scrollable, snap-scroll row of HeroCards.
 *
 * Desktop:
 *   • Left + right gradient fades mask the overflow edges.
 *   • No visible scrollbar (hidden via CSS).
 *
 * Mobile:
 *   • Scroll-snap for natural swipe feel.
 *   • Dot navigation indicators beneath the row.
 *   • Edge fades hidden so users can see cards are swipeable.
 */
export function HeroTimeline() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeDot, setActiveDot] = useState(0);

  /** Scroll to a card by index (used by dot buttons) */
  function scrollToIndex(index: number) {
    const container = scrollRef.current;
    if (!container) return;
    const child = container.children[index] as HTMLElement | undefined;
    if (child) {
      child.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "start",
      });
      setActiveDot(index);
    }
  }

  /** Update active dot on native scroll (best-effort) */
  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;
    const scrollLeft = container.scrollLeft;
    const childWidth =
      (container.children[0] as HTMLElement | undefined)?.offsetWidth ?? 0;
    if (childWidth === 0) return;
    const approxIndex = Math.round(scrollLeft / (childWidth + 16)); // 16 = gap-4
    setActiveDot(Math.min(approxIndex, HERO_SCENES.length - 1));
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* ── Left edge fade — desktop only ────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="hidden md:block"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "80px",
          background: "linear-gradient(to right, #050509 0%, transparent 100%)",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* ── Right edge fade — desktop only ───────────────────────────────── */}
      <div
        aria-hidden="true"
        className="hidden md:block"
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: "80px",
          background: "linear-gradient(to left, #050509 0%, transparent 100%)",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* ── Scrollable card row ───────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="hero-timeline-scroll flex gap-4 px-6 overflow-x-auto overflow-y-hidden"
        style={{
          scrollBehavior: "smooth",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "6px",
          justifyContent: "center",
          /* scrollbar hidden via global style in HeroSection */
          msOverflowStyle: "none",
          scrollbarWidth: "none",
        }}
      >
        {HERO_SCENES.map((scene) => (
          <div
            key={scene.id}
            style={{ scrollSnapAlign: "start", flex: "0 0 auto" }}
          >
            <HeroCard {...scene} />
          </div>
        ))}
        {/* End spacer — ensures last card gets full right padding in all browsers */}
        <div aria-hidden="true" style={{ flex: "0 0 8px" }} />
      </div>

      {/* ── Dot indicators — mobile only ─────────────────────────────────── */}
      <div
        className="flex md:hidden"
        style={{
          justifyContent: "center",
          gap: "7px",
          marginTop: "14px",
        }}
      >
        {HERO_SCENES.map((scene, i) => (
          <button
            key={scene.id}
            type="button"
            aria-label={`Go to ${scene.title}`}
            onClick={() => scrollToIndex(i)}
            style={{
              width: i === activeDot ? "18px" : "6px",
              height: "6px",
              borderRadius: "3px",
              background:
                i === activeDot
                  ? "rgba(139,92,246,0.85)"
                  : "rgba(255,255,255,0.20)",
              border: "none",
              cursor: "pointer",
              padding: 0,
              transition: "width 0.22s ease, background 0.22s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}
