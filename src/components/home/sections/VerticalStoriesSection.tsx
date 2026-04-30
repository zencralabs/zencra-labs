"use client";

import { useRef, useState } from "react";

/**
 * VerticalStoriesSection
 *
 * Split layout (matches mockup):
 *   Desktop: [LEFT text block ~260px] | [RIGHT horizontal scroll of 9:16 cards]
 *   Mobile:  stacked — text block above, cards below with native swipe
 *
 * Poster strategy:
 *   Primary poster: /home/vertical/[id].jpg  (uploaded to public/home/vertical/)
 *   Fallback poster: /hero/[fallback].jpg    (guaranteed to exist — same images
 *   used by HeroTimeline, so they are always present in /public/hero/)
 *   Video: /home/vertical/[id].mp4 — gracefully hidden on error
 *
 * Card labels:
 *   Fashion Reel | AI Influencer | Product Ad | Story Clip |
 *   Music Video  | Travel Reel   | Fitness Reel | Food Ad  |
 *   Luxury Brand | Behind the Scenes
 *
 * Design rules:
 *   • Blue → purple only (no teal/amber/red)
 *   • border-radius: 0 on all <video> and <img> elements
 *   • CSS transitions only — no Framer Motion
 *   • Native scroll-snap for swipe feel
 *   • Autoplay muted loop — no play icon, no duration badge
 */

const STORIES = [
  {
    id: "fashion",
    label: "Fashion Reel",
    poster: "/hero/emotional.jpg",
    videoPrimary: "/home/vertical/fashion.mp4",
    accent: "#3B82F6",
  },
  {
    id: "influencer",
    label: "AI Influencer",
    poster: "/hero/ugc.jpg",
    videoPrimary: "/home/vertical/influencer.mp4",
    accent: "#8B5CF6",
  },
  {
    id: "product",
    label: "Product Ad",
    poster: "/hero/product.jpg",
    videoPrimary: "/home/vertical/product.mp4",
    accent: "#6366F1",
  },
  {
    id: "story",
    label: "Story Clip",
    poster: "/hero/cyberpunk.jpg",
    videoPrimary: "/home/vertical/story.mp4",
    accent: "#A855F7",
  },
  {
    id: "music",
    label: "Music Video",
    poster: "/hero/music.jpg",
    videoPrimary: "/home/vertical/music.mp4",
    accent: "#7C3AED",
  },
  {
    id: "travel",
    label: "Travel Reel",
    poster: "/hero/desert.jpg",
    videoPrimary: "/home/vertical/travel.mp4",
    accent: "#4F46E5",
  },
  {
    id: "fitness",
    label: "Fitness Reel",
    poster: "/hero/emotional.jpg",
    videoPrimary: "/home/vertical/fitness.mp4",
    accent: "#3B82F6",
  },
  {
    id: "food",
    label: "Food Ad",
    poster: "/hero/product.jpg",
    videoPrimary: "/home/vertical/food.mp4",
    accent: "#8B5CF6",
  },
  {
    id: "luxury",
    label: "Luxury Brand",
    poster: "/hero/ugc.jpg",
    videoPrimary: "/home/vertical/luxury.mp4",
    accent: "#7C3AED",
  },
  {
    id: "behind-scenes",
    label: "Behind the Scenes",
    poster: "/hero/cyberpunk.jpg",
    videoPrimary: "/home/vertical/behind-scenes.mp4",
    accent: "#6366F1",
  },
] as const;

/** Single 9:16 story card — autoplay muted loop, no play icon, no duration badge */
function StoryCard({
  label,
  poster,
  videoPrimary,
  accent,
}: (typeof STORIES)[number]) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        flexShrink: 0,
        width: "clamp(180px, 14vw, 200px)",
        aspectRatio: "9/16",
        overflow: "hidden",
        borderRadius: 0,
        border: `1px solid ${accent}30`,
        boxShadow: hovered
          ? `0 20px 60px rgba(0,0,0,0.60), 0 0 0 1px ${accent}55`
          : `0 8px 40px rgba(0,0,0,0.50)`,
        transform: hovered ? "translateY(-6px) scale(1.03)" : "translateY(0) scale(1)",
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
        cursor: "pointer",
        backgroundColor: "#070A14",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Poster image — always rendered as baseline visual ───────────── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
          borderRadius: 0,
          opacity: 1.0,
        }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.opacity = "0";
        }}
      />

      {/* ── Video — autoplay muted loop, layered above poster ───────────── */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={poster}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
          borderRadius: 0,
          opacity: 1.0,
        }}
        onError={(e) => {
          (e.currentTarget as HTMLVideoElement).style.display = "none";
        }}
      >
        <source src={videoPrimary} type="video/mp4" />
      </video>

      {/* ── Bottom gradient — label readability ──────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "80px",
          background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Label — bottom left ──────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          left: "10px",
          right: "10px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <div
          style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            backgroundColor: accent,
            boxShadow: `0 0 6px ${accent}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "10px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.92)",
            textShadow: "0 1px 6px rgba(0,0,0,0.95)",
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export function VerticalStoriesSection() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeDot, setActiveDot] = useState(0);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const firstChild = el.children[0] as HTMLElement | undefined;
    const childWidth = firstChild?.offsetWidth ?? 0;
    if (childWidth === 0) return;
    const idx = Math.round(el.scrollLeft / (childWidth + 16));
    setActiveDot(Math.min(idx, STORIES.length - 1));
  }

  function scrollToIdx(i: number) {
    const el = scrollRef.current;
    if (!el) return;
    const child = el.children[i] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    setActiveDot(i);
  }

  function scrollBy(dir: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    const firstChild = el.children[0] as HTMLElement | undefined;
    const step = (firstChild?.offsetWidth ?? 200) + 16;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  return (
    <section
      style={{
        paddingTop: "64px",
        paddingBottom: "64px",
        backgroundColor: "var(--page-bg)",
        overflow: "hidden",
      }}
    >
      <div className="container-site">
        {/*
          Desktop: flex-row — left text block + right scrollable cards
          Mobile: flex-col — text above, cards below
        */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-14 items-start">

          {/* ── LEFT TEXT BLOCK ───────────────────────────────────────────── */}
          <div
            className="w-full flex-shrink-0"
            style={{ maxWidth: "260px" }}
          >
            {/* Eyebrow */}
            <p
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "#3B82F6",
                marginBottom: "14px",
              }}
            >
              Vertical Stories
            </p>

            {/* Heading — cinematic override */}
            <h2
              className="font-display tracking-tight"
              style={{
                fontFamily: "var(--font-display, 'Syne', sans-serif)",
                fontSize: "clamp(1.75rem, 3.2vw, 2.5rem)",
                fontWeight: 800,
                lineHeight: 1.0,
                letterSpacing: "-0.04em",
                color: "var(--page-text)",
                margin: "0 0 14px",
              }}
            >
              Create for{" "}
              <span
                style={{
                  background: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 60%, #a855f7 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Every Screen
              </span>
            </h2>

            {/* Subtitle */}
            <p
              style={{
                fontSize: "13px",
                lineHeight: 1.65,
                color: "rgba(255,255,255,0.45)",
                marginBottom: "28px",
              }}
            >
              Vertical stories, product reels, influencers, ads, and cinematic
              shorts — ready for mobile-first platforms.
            </p>

            {/* Drag indicator — desktop only */}
            <div
              className="hidden md:flex items-center gap-3"
              style={{ marginTop: "8px" }}
            >
              {/* Left arrow */}
              <button
                type="button"
                aria-label="Scroll left"
                onClick={() => scrollBy(-1)}
                style={{
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.55)",
                  borderRadius: 0,
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <span
                style={{
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.32)",
                  letterSpacing: "0.05em",
                  whiteSpace: "nowrap",
                }}
              >
                Drag to explore more
              </span>

              {/* Right arrow */}
              <button
                type="button"
                aria-label="Scroll right"
                onClick={() => scrollBy(1)}
                style={{
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.55)",
                  borderRadius: 0,
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── RIGHT: SCROLLABLE CARD ROW ───────────────────────────────── */}
          <div className="flex-1 min-w-0" style={{ overflow: "hidden" }}>
            {/* Scroll track */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex gap-[16px] overflow-x-auto pb-4"
              style={{
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
                scrollBehavior: "smooth",
                msOverflowStyle: "none",
                scrollbarWidth: "none",
              }}
            >
              {STORIES.map((story) => (
                <div
                  key={story.id}
                  style={{ scrollSnapAlign: "start", flex: "0 0 auto" }}
                >
                  <StoryCard {...story} />
                </div>
              ))}
              {/* End spacer — prevents last card from being clipped */}
              <div aria-hidden="true" style={{ flex: "0 0 4px" }} />
            </div>

            {/* Dot indicators — mobile only */}
            <div
              className="flex md:hidden justify-center gap-2 mt-4"
            >
              {STORIES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Go to ${s.label}`}
                  onClick={() => scrollToIdx(i)}
                  style={{
                    width: i === activeDot ? "18px" : "6px",
                    height: "6px",
                    borderRadius: "3px",
                    background: i === activeDot
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
        </div>
      </div>
    </section>
  );
}
