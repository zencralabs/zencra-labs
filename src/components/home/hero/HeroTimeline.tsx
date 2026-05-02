"use client";

import { useRef, useState } from "react";
import { HeroCard } from "./HeroCard";

/**
 * HERO_SCENES — cinematic showcase cards shown below the hero content.
 *
 * 10 entries — row overflows the viewport on most screens, users slide/swipe.
 * Videos live in /public/hero/videos/{id}.mp4  — only IDs in AVAILABLE_VIDEOS get a src.
 * Posters cycle between the 3 images that are committed to the repo.
 */

/** The 3 poster images that actually exist on disk — cycle for all 10 cards. */
const IMG = ["/hero/cyberpunk.jpg", "/hero/product.jpg", "/hero/ugc.jpg"] as const;

export const HERO_SCENES = [
  { id: "cyberpunk",     title: "Cyberpunk Chase",    tag: "Short Film",   image: IMG[0] },
  { id: "emotional",     title: "Emotional Scene",    tag: "Cinematic",    image: IMG[1] },
  { id: "desert",        title: "Desert Warrior",     tag: "Epic Scene",   image: IMG[2] },
  { id: "product",       title: "Product Ad",         tag: "Commercial",   image: IMG[0] },
  { id: "ugc",           title: "AI Influencer",      tag: "UGC Video",    image: IMG[1] },
  { id: "music",         title: "Music Video",        tag: "Music Video",  image: IMG[2] },
  { id: "travel",        title: "Travel Reel",        tag: "Travel Reel",  image: IMG[0] },
  { id: "fitness",       title: "Fitness Reel",       tag: "Fitness Reel", image: IMG[1] },
  { id: "food",          title: "Food Ad",            tag: "Food Ad",      image: IMG[2] },
  { id: "behind-scenes", title: "Behind the Scenes",  tag: "BTS",          image: IMG[0] },
] as const;

/**
 * HeroTimeline
 *
 * A horizontally-scrollable, snap-scroll row of 10 HeroCards.
 * Native scroll only — no JS carousel, no autoplay, no arrows needed.
 *
 * Desktop: 10 cards overflow viewport; users drag or scroll wheel to slide.
 * Mobile:  scroll-snap for natural swipe feel + dot navigation indicators.
 *
 * Layout note: inner row uses flex-start (not center) so that with overflow
 * the leftmost cards are always reachable — centering clips left-side overflow.
 */
export function HeroTimeline() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef  = useRef<HTMLDivElement>(null);
  const [activeDot, setActiveDot] = useState(0);

  /** Scroll to a card by index (used by dot buttons) */
  function scrollToIndex(index: number) {
    const inner = innerRef.current;
    if (!inner) return;
    const child = inner.children[index] as HTMLElement | undefined;
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
    const inner     = innerRef.current;
    if (!container || !inner) return;
    const scrollLeft = container.scrollLeft;
    const childWidth =
      (inner.children[0] as HTMLElement | undefined)?.offsetWidth ?? 0;
    if (childWidth === 0) return;
    const approxIndex = Math.round(scrollLeft / (childWidth + 16)); // 16 = gap
    setActiveDot(Math.min(approxIndex, HERO_SCENES.length - 1));
  }

  return (
    <div style={{ position: "relative", width: "100%", paddingTop: "12px" }}>
      {/* ── Outer scroll container ────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="hero-timeline-scroll overflow-x-auto overflow-y-hidden"
        style={{
          scrollBehavior: "smooth",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "6px",
          msOverflowStyle: "none",
          scrollbarWidth: "none",
        }}
      >
        {/* ── Inner flex row — left-aligned so overflow scrolls correctly ── */}
        <div
          ref={innerRef}
          style={{
            display: "inline-flex",   /* shrink-wraps to card content, no width:100% clip */
            gap: "16px",
            padding: "0 24px",
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
          {/* End spacer — ensures last card clears the right padding on all browsers */}
          <div aria-hidden="true" style={{ flex: "0 0 8px" }} />
        </div>
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
