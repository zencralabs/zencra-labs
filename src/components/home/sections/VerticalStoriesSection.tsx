"use client";

import { useRef, useState } from "react";

/**
 * VerticalStoriesSection
 *
 * Horizontally-scrollable row of 9:16 portrait-ratio story cards.
 * Showcases Zencra's ability to generate vertical-format content
 * (Reels, Shorts, TikTok, AI Presenter, Product Stories).
 *
 * Design rules:
 *   • Blue → purple only — no teal, amber, or red
 *   • media border-radius: 0 (sharp edges)
 *   • Native scroll-snap — no JS-driven animation
 *   • Dot indicators below on mobile; hidden on desktop (all cards visible)
 */

const VERTICAL_STORIES = [
  {
    id: "reel",
    label: "Instagram Reel",
    tag: "16s",
    gradient: "linear-gradient(180deg, #050d1f 0%, #0f2766 55%, #3b82f6 100%)",
    accent: "#3B82F6",
    videoSrc: "/vertical/reel.mp4",
    imageSrc: "/vertical/reel.jpg",
  },
  {
    id: "tiktok",
    label: "TikTok Video",
    tag: "21s",
    gradient: "linear-gradient(180deg, #0a0715 0%, #2d1b69 55%, #8b5cf6 100%)",
    accent: "#8B5CF6",
    videoSrc: "/vertical/tiktok.mp4",
    imageSrc: "/vertical/tiktok.jpg",
  },
  {
    id: "short",
    label: "YouTube Short",
    tag: "18s",
    gradient: "linear-gradient(180deg, #060c1c 0%, #192555 55%, #60a5fa 100%)",
    accent: "#60A5FA",
    videoSrc: "/vertical/short.mp4",
    imageSrc: "/vertical/short.jpg",
  },
  {
    id: "presenter",
    label: "AI Presenter",
    tag: "30s",
    gradient: "linear-gradient(180deg, #0c0518 0%, #3b0f96 55%, #a855f7 100%)",
    accent: "#A855F7",
    videoSrc: "/vertical/presenter.mp4",
    imageSrc: "/vertical/presenter.jpg",
  },
  {
    id: "product",
    label: "Product Story",
    tag: "12s",
    gradient: "linear-gradient(180deg, #040e20 0%, #0d2355 55%, #2563eb 100%)",
    accent: "#2563EB",
    videoSrc: "/vertical/product.mp4",
    imageSrc: "/vertical/product.jpg",
  },
  {
    id: "music",
    label: "Music Visual",
    tag: "15s",
    gradient: "linear-gradient(180deg, #0d0520 0%, #4c1d95 55%, #7c3aed 100%)",
    accent: "#7C3AED",
    videoSrc: "/vertical/music.mp4",
    imageSrc: "/vertical/music.jpg",
  },
] as const;

/** Single 9:16 story card */
function StoryCard({
  label,
  tag,
  gradient,
  accent,
  videoSrc,
  imageSrc,
}: (typeof VERTICAL_STORIES)[number]) {
  return (
    <div
      style={{
        position: "relative",
        flexShrink: 0,
        width: "clamp(160px, 18vw, 210px)",
        aspectRatio: "9/16",
        background: gradient,
        overflow: "hidden",
        borderRadius: 0,
        border: `1px solid ${accent}22`,
        boxShadow: `0 8px 40px rgba(0,0,0,0.45), 0 0 0 0 ${accent}00`,
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "translateY(-6px) scale(1.03)";
        el.style.boxShadow = `0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px ${accent}50`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "translateY(0) scale(1)";
        el.style.boxShadow = `0 8px 40px rgba(0,0,0,0.45), 0 0 0 0 ${accent}00`;
      }}
    >
      {/* Fallback image — shown if video fails or hasn't loaded yet */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: 0,
          opacity: 0.75,
        }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />

      {/* Autoplay video (muted, decorative) */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster={imageSrc}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: 0,
          opacity: 0.85,
        }}
        onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}
      >
        <source src={videoSrc} type="video/mp4" />
      </video>

      {/* Top gradient for badge readability */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "80px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Bottom gradient for label readability */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "90px",
          background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Duration badge — top right */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          right: "10px",
          padding: "3px 8px",
          background: "rgba(0,0,0,0.50)",
          border: `1px solid rgba(255,255,255,0.14)`,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          fontSize: "10px",
          fontWeight: 700,
          color: "rgba(255,255,255,0.80)",
          letterSpacing: "0.05em",
        }}
      >
        {tag}
      </div>

      {/* Format dot + label — bottom left */}
      <div
        style={{
          position: "absolute",
          bottom: "14px",
          left: "12px",
          right: "12px",
          display: "flex",
          alignItems: "center",
          gap: "7px",
        }}
      >
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: accent,
            boxShadow: `0 0 8px ${accent}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.90)",
            textShadow: "0 1px 6px rgba(0,0,0,0.9)",
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
      </div>

      {/* Subtle accent glow at bottom */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "-30px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "120%",
          height: "80px",
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${accent}28 0%, transparent 70%)`,
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export function VerticalStoriesSection() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeDot, setActiveDot] = useState(0);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const child = el.children[0] as HTMLElement | undefined;
    const childWidth = child?.offsetWidth ?? 0;
    if (childWidth === 0) return;
    const approxIdx = Math.round(el.scrollLeft / (childWidth + 12));
    setActiveDot(Math.min(approxIdx, VERTICAL_STORIES.length - 1));
  }

  function scrollToIndex(index: number) {
    const el = scrollRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement | undefined;
    if (child) {
      child.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
      setActiveDot(index);
    }
  }

  return (
    <section
      style={{
        paddingTop: "72px",
        paddingBottom: "72px",
        backgroundColor: "var(--page-bg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "48px",
          padding: "0 24px",
        }}
      >
        {/* Eyebrow */}
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "#3B82F6",
            marginBottom: "16px",
          }}
        >
          Vertical Content
        </p>

        {/* Heading — cinematic override */}
        <h2
          className="font-display tracking-tight"
          style={{
            fontFamily: "var(--font-display, 'Syne', sans-serif)",
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 800,
            lineHeight: 0.95,
            letterSpacing: "-0.04em",
            color: "var(--page-text)",
            margin: "0 0 16px",
          }}
        >
          Create for{" "}
          <span
            style={{
              background: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 55%, #a855f7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Every Format
          </span>
        </h2>

        {/* Subtext */}
        <p
          style={{
            fontSize: "clamp(14px, 1.6vw, 17px)",
            lineHeight: 1.65,
            color: "rgba(255,255,255,0.48)",
            maxWidth: "520px",
            margin: "0 auto",
            letterSpacing: "-0.01em",
          }}
        >
          Generate portrait reels, short-form clips, and AI presenter videos —
          alongside cinematic widescreen productions.
        </p>
      </div>

      {/* Scrollable card row */}
      <div style={{ position: "relative" }}>
        {/* Left edge fade — desktop only */}
        <div
          aria-hidden="true"
          className="hidden md:block"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "80px",
            background: "linear-gradient(to right, var(--page-bg) 0%, transparent 100%)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />

        {/* Right edge fade — desktop only */}
        <div
          aria-hidden="true"
          className="hidden md:block"
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "80px",
            background: "linear-gradient(to left, var(--page-bg) 0%, transparent 100%)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />

        {/* Card row */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-3 px-6 overflow-x-auto overflow-y-hidden"
          style={{
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            scrollBehavior: "smooth",
            paddingBottom: "8px",
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
          {VERTICAL_STORIES.map((story) => (
            <div
              key={story.id}
              style={{ scrollSnapAlign: "start", flex: "0 0 auto" }}
            >
              <StoryCard {...story} />
            </div>
          ))}
          {/* End spacer — prevents last card right-clip in overflow containers */}
          <div aria-hidden="true" style={{ flex: "0 0 8px" }} />
        </div>
      </div>

      {/* Dot indicators — mobile only */}
      <div
        className="flex md:hidden"
        style={{ justifyContent: "center", gap: "7px", marginTop: "20px" }}
      >
        {VERTICAL_STORIES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Go to ${s.label}`}
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

      {/* Formats pill row — decorative, desktop only */}
      <div
        className="hidden md:flex"
        style={{
          justifyContent: "center",
          gap: "10px",
          marginTop: "36px",
          flexWrap: "wrap",
          padding: "0 24px",
        }}
      >
        {["9:16 Portrait", "Instagram Reel", "TikTok", "YouTube Short", "AI Presenter", "Product Story"].map(
          (fmt) => (
            <span
              key={fmt}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "5px 14px",
                border: "1px solid rgba(139,92,246,0.22)",
                background: "rgba(139,92,246,0.06)",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: "rgba(196,181,253,0.75)",
                textTransform: "uppercase",
              }}
            >
              {fmt}
            </span>
          )
        )}
      </div>
    </section>
  );
}
