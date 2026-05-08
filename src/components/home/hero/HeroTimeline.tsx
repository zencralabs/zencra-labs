"use client";

import { useRef, useState } from "react";
import { HeroCard } from "./HeroCard";

/**
 * VIDEO_SRC_MAP — maps each scene ID to an available /public/hero/videos/ file.
 *
 * Only desert.mp4 and emotional.mp4 are committed to disk.
 * Cards without a unique file reuse one of these temporarily.
 * TODO: replace the placeholder values below with unique .mp4 files as they
 *       become available (add file to /public/hero/videos/, update the key here).
 */
const V = {
  E: "/hero/videos/emotional.mp4",  // Emotional — cinematic close-up
  D: "/hero/videos/desert.mp4",     // Desert — epic wide shot
} as const;

/**
 * HERO_SCENES — 10 cinematic showcase cards.
 * Every card has a confirmed video source (cycling E/D until unique files arrive).
 */
const HERO_SCENES = [
  { id: "emotional",     title: "Emotional Scene",         tag: "Cinematic",       videoSrc: V.E },
  { id: "desert",        title: "Desert Warrior",          tag: "Epic Scene",      videoSrc: V.D },
  { id: "product-ad",    title: "Product Ad",              tag: "Commercial",      videoSrc: V.E },  // TODO: /hero/videos/product-ad.mp4
  { id: "motion",        title: "Make Your Character Dance", tag: "Motion Control", videoSrc: V.D }, // TODO: /hero/videos/motion.mp4
  { id: "ugc",           title: "AI Influencer",           tag: "UGC Video",       videoSrc: V.E }, // TODO: /hero/videos/ugc.mp4
  { id: "music-video",   title: "Ultra Realistic Artist",  tag: "Music Video",     videoSrc: V.D }, // TODO: /hero/videos/music-video.mp4
  { id: "lip-sync",      title: "Talking Video",           tag: "Lip Sync",        videoSrc: V.E }, // TODO: /hero/videos/lip-sync.mp4
  { id: "cartoon",       title: "3D Pixar Character",      tag: "Cartoon",         videoSrc: V.D }, // TODO: /hero/videos/cartoon.mp4
  { id: "short-film",    title: "Cinematic Storytelling",  tag: "Short Film",      videoSrc: V.E }, // TODO: /hero/videos/short-film.mp4
  { id: "ai-trailer",    title: "Movie Trailer",           tag: "AI Trailer",      videoSrc: V.D }, // TODO: /hero/videos/ai-trailer.mp4
] as const;

/**
 * HeroTimeline
 *
 * Horizontally-scrollable snap-scroll row of 10 HeroCards.
 * Native scroll — no arrows, no autoplay.
 * Desktop: cards overflow viewport; users scroll or drag.
 * Mobile:  scroll-snap for swipe + dot navigation.
 */
export function HeroTimeline() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef  = useRef<HTMLDivElement>(null);
  const [activeDot, setActiveDot] = useState(0);

  function scrollToIndex(index: number) {
    const inner = innerRef.current;
    if (!inner) return;
    const child = inner.children[index] as HTMLElement | undefined;
    if (child) {
      child.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
      setActiveDot(index);
    }
  }

  function handleScroll() {
    const container = scrollRef.current;
    const inner     = innerRef.current;
    if (!container || !inner) return;
    const childWidth = (inner.children[0] as HTMLElement | undefined)?.offsetWidth ?? 0;
    if (childWidth === 0) return;
    const approxIndex = Math.round(container.scrollLeft / (childWidth + 16)); // 16 = gap
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
        {/* ── Inner flex row ─────────────────────────────────────────────── */}
        <div
          ref={innerRef}
          style={{
            display: "inline-flex",
            gap: "16px",
            padding: "0 24px",
          }}
        >
          {HERO_SCENES.map((scene) => (
            <div
              key={scene.id}
              style={{ scrollSnapAlign: "start", flex: "0 0 auto" }}
            >
              <HeroCard
                id={scene.id}
                title={scene.title}
                tag={scene.tag}
                videoSrc={scene.videoSrc}
              />
            </div>
          ))}
          {/* End spacer — last card clears right padding on all browsers */}
          <div aria-hidden="true" style={{ flex: "0 0 8px" }} />
        </div>
      </div>

      {/* ── Dot indicators — mobile only ─────────────────────────────────── */}
      <div
        className="flex md:hidden"
        style={{ justifyContent: "center", gap: "7px", marginTop: "14px" }}
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
              background: i === activeDot ? "rgba(139,92,246,0.85)" : "rgba(255,255,255,0.20)",
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
