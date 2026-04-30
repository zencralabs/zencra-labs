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
 *   Primary poster: /vertical/[id].jpg  (not yet uploaded → fails silently)
 *   Fallback poster: /hero/[fallback].jpg (guaranteed to exist — same images
 *   used by HeroTimeline, so they are always present in /public/hero/)
 *   Video: /vertical/[id].mp4 — gracefully hidden on error
 *
 * Card labels (mockup): Fashion Reel | AI Influencer | Product Ad |
 *                        Story Clip   | Music Video   | Travel Reel
 *
 * Design rules:
 *   • Blue → purple only (no teal/amber/red)
 *   • border-radius: 0 on all <video> and <img> elements
 *   • CSS transitions only — no Framer Motion
 *   • Native scroll-snap for swipe feel
 */

const STORIES = [
  {
    id: "fashion",
    label: "Fashion Reel",
    duration: "0:15",
    poster: "/hero/emotional.jpg",      // guaranteed fallback
    videoPrimary: "/vertical/fashion.mp4",
    accent: "#3B82F6",
  },
  {
    id: "influencer",
    label: "AI Influencer",
    duration: "0:14",
    poster: "/hero/ugc.jpg",
    videoPrimary: "/vertical/influencer.mp4",
    accent: "#8B5CF6",
  },
  {
    id: "product",
    label: "Product Ad",
    duration: "0:13",
    poster: "/hero/product.jpg",
    videoPrimary: "/vertical/product.mp4",
    accent: "#6366F1",
  },
  {
    id: "story",
    label: "Story Clip",
    duration: "0:15",
    poster: "/hero/cyberpunk.jpg",
    videoPrimary: "/vertical/story.mp4",
    accent: "#A855F7",
  },
  {
    id: "music",
    label: "Music Video",
    duration: "0:16",
    poster: "/hero/music.jpg",
    videoPrimary: "/vertical/music.mp4",
    accent: "#7C3AED",
  },
  {
    id: "travel",
    label: "Travel Reel",
    duration: "0:14",
    poster: "/hero/desert.jpg",
    videoPrimary: "/vertical/travel.mp4",
    accent: "#4F46E5",
  },
] as const;

/** Single 9:16 story card — poster visible immediately, video loads lazily */
function StoryCard({
  label,
  duration,
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
        width: "clamp(170px, 15vw, 185px)",
        aspectRatio: "9/16",
        overflow: "hidden",
        borderRadius: 0,
        border: `1px solid ${accent}22`,
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
          opacity: 0.88,
        }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.opacity = "0";
        }}
      />

      {/* ── Video — layered above poster, hides itself on 404 ───────────── */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster={poster}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
          borderRadius: 0,
          opacity: 0.88,
        }}
        onError={(e) => {
          (e.currentTarget as HTMLVideoElement).style.display = "none";
        }}
      >
        <source src={videoPrimary} type="video/mp4" />
      </video>

      {/* ── Top gradient — duration badge readability ────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "70px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.60) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Bottom gradient — label readability ──────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "80px",
          background: "linear-gradient(to top, rgba(0,0,0,0.80) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Duration badge — top right ───────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "8px",
          padding: "2px 7px",
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,255,255,0.14)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          fontSize: "10px",
          fontWeight: 700,
          color: "rgba(255,255,255,0.82)",
          letterSpacing: "0.04em",
          borderRadius: 0,
        }}
      >
        {duration}
      </div>

      {/* ── Centred play button ──────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.16)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.32)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s ease",
          }}
        >
          {/* Triangle */}
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: "6px solid transparent",
              borderBottom: "6px solid transparent",
              borderLeft: "10px solid rgba(255,255,255,0.92)",
              marginLeft: "2px",
            }}
          />
        </div>
      </div>

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
    const idx = Math.round(el.scrollLeft / (childWidth + 14));
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
    const step = (firstChild?.offsetWidth ?? 185) + 14;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  return (
    <section
      style={{
        paddingTop: "72px",
        paddingBottom: "72px",
        backgroundColor: "var(--page-bg)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}
    >
      <div className="container-site">
        {/*
          Desktop: flex-row — left text block + right scrollable cards
          Mobile: flex-col — text above, cards below
        */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">

          {/* ── LEFT TEXT BLOCK ───────────────────────────────────────────── */}
          <div
            className="w-full md:w-[28%] flex-shrink-0"
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
                fontSize: "clamp(28px, 3vw, 44px)",
                fontWeight: 800,
                lineHeight: 0.95,
                letterSpacing: "-0.04em",
                color: "var(--page-text)",
                margin: "0 0 14px",
                maxWidth: "260px",
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
                maxWidth: "240px",
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
              className="flex gap-[14px] overflow-x-auto pb-4"
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
