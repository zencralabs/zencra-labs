"use client";

import { useRef, useState } from "react";
import { HeroCard } from "./HeroCard";

/**
 * HERO_SCENES — cinematic showcase cards shown below the hero content.
 *
 * 10 entries — row overflows the viewport on most screens, users slide/swipe.
 * Videos live in /public/hero/videos/{id}.mp4
 * Posters live in /public/hero/{id}.jpg  (optional — card shows dark fallback if missing)
 */
export const HERO_SCENES = [
  { id: "cyberpunk",     title: "Cyberpunk Chase",     tag: "Short Film",   image: "/hero/cyberpunk.jpg"     },
  { id: "emotional",     title: "Emotional Scene",     tag: "Cinematic",    image: "/hero/emotional.jpg"     },
  { id: "desert",        title: "Desert Warrior",      tag: "Epic Scene",   image: "/hero/desert.jpg"        },
  { id: "product",       title: "Product Ad",          tag: "Commercial",   image: "/hero/product.jpg"       },
  { id: "ugc",           title: "AI Influencer",       tag: "UGC Video",    image: "/hero/ugc.jpg"           },
  { id: "music",         title: "Music Video",         tag: "Music Video",  image: "/hero/music.jpg"         },
  { id: "travel",        title: "Travel Reel",         tag: "Travel Reel",  image: "/hero/travel.jpg"        },
  { id: "fitness",       title: "Fitness Reel",        tag: "Fitness Reel", image: "/hero/fitness.jpg"       },
  { id: "food",          title: "Food Ad",             tag: "Food Ad",      image: "/hero/food.jpg"          },
  { id: "behind-scenes", title: "Behind the Scenes",   tag: "BTS",          image: "/hero/behind-scenes.jpg" },
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
