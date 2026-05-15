"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clapperboard, ArrowRight } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CinemaHero — Apple TV–style depth carousel for the FCS landing page
// Full-bleed cinema stage · dark navy · gold accent · silver/white type
// ─────────────────────────────────────────────────────────────────────────────

const STILLS = [
  { src: "/cinema-stills/still-1.svg", label: "Nebula · Deep Space" },
  { src: "/cinema-stills/still-2.svg", label: "Neon City · Midnight" },
  { src: "/cinema-stills/still-3.jpg", label: "Highland Ridge · Moonrise" },
  { src: "/cinema-stills/still-4.svg", label: "Desert Dunes · Dusk" },
  { src: "/cinema-stills/still-5.svg", label: "Storm Coast · Midnight" },
];

// Locked overlay content — one entry per slide, index-matched to STILLS
const SLIDE_CONTENT = [
  {
    pill: "CINEMATIC SCENE",
    title: "Direct AI Film Scenes",
    subtitle: "Generate high-impact cinematic shots with lighting, depth, and production-grade composition.",
  },
  {
    pill: "UGC CREATOR",
    title: "Create Viral Video Ads",
    subtitle: "Produce creator-style content optimized for engagement, storytelling, and social platforms.",
  },
  {
    pill: "CHARACTER CONSISTENCY",
    title: "Maintain Character Identity",
    subtitle: "Keep faces, style, and presence consistent across every shot and scene.",
  },
  {
    pill: "MOTION CONTROL",
    title: "Control Camera Movement",
    subtitle: "Direct cinematic motion, angles, and transitions with precision and control.",
  },
  {
    pill: "STORYBOARD WORKFLOW",
    title: "From Script to Screen",
    subtitle: "Transform ideas into structured visual sequences with full storytelling flow.",
  },
];

const N = STILLS.length;
const CARD_W = 760;
const CARD_H = 428; // 16:9

// Per-offset visual config — array avoids negative numeric key TS issues
const OFFSET_MAP = [
  { offset: 0,  tx: 0,    scale: 1.00, rotateY: 0,   brightness: 1.00, blur: 0,   zIndex: 5 },
  { offset: 1,  tx: 415,  scale: 0.76, rotateY: -13, brightness: 0.50, blur: 0,   zIndex: 4 },
  { offset: -1, tx: -415, scale: 0.76, rotateY: 13,  brightness: 0.50, blur: 0,   zIndex: 4 },
  { offset: 2,  tx: 730,  scale: 0.58, rotateY: -22, brightness: 0.20, blur: 3,   zIndex: 3 },
  { offset: -2, tx: -730, scale: 0.58, rotateY: 22,  brightness: 0.20, blur: 3,   zIndex: 3 },
];

function getCfg(offset: number) {
  return OFFSET_MAP.find(c => c.offset === offset) ?? OFFSET_MAP[3];
}

function getOffset(i: number, active: number): number {
  const raw = ((i - active) % N + N) % N;
  return raw > N / 2 ? raw - N : raw;
}

function cardStyle(offset: number): React.CSSProperties {
  const cfg = getCfg(offset);
  return {
    position: "absolute",
    width: CARD_W,
    height: CARD_H,
    top: 0,
    left: "50%",
    transform: `translateX(calc(-50% + ${cfg.tx}px)) scale(${cfg.scale}) rotateY(${cfg.rotateY}deg)`,
    filter: `brightness(${cfg.brightness})${cfg.blur > 0 ? ` blur(${cfg.blur}px)` : ""}`,
    zIndex: cfg.zIndex,
    transition: "transform 0.65s cubic-bezier(0.25,0.46,0.45,0.94), filter 0.65s cubic-bezier(0.25,0.46,0.45,0.94)",
    borderRadius: 10,
    overflow: "hidden",
    cursor: offset !== 0 ? "pointer" : "default",
    willChange: "transform, filter",
  };
}

export default function CinemaHero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(() => setActive(a => (a + 1) % N), []);

  useEffect(() => {
    if (paused) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(advance, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused, advance]);

  function goTo(i: number) {
    setActive(i);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!paused) intervalRef.current = setInterval(advance, 5000);
  }

  return (
    <section style={{ paddingTop: "48px", paddingBottom: "72px" }}>

      {/* ── Badge ── */}
      <div style={{ textAlign: "center", marginBottom: "44px" }}>
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.2em]"
          style={{
            background: "rgba(201,168,76,0.08)",
            border: "1px solid rgba(201,168,76,0.28)",
            color: "#C9A84C",
          }}
        >
          <Clapperboard size={13} />
          Future Cinema Studio
          <span
            className="rounded-full px-2 py-0.5 text-[8px] font-bold"
            style={{ background: "rgba(201,168,76,0.18)", color: "#F0C060", letterSpacing: "0.1em" }}
          >
            COMING SOON
          </span>
        </div>
      </div>

      {/* ── Full-bleed carousel stage ── */}
      <div
        style={{ position: "relative", width: "100%", marginBottom: "24px" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Perspective container */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: CARD_H + 20,
            perspective: "1400px",
            perspectiveOrigin: "50% 50%",
            overflow: "visible",
          }}
        >
          {/* Ambient glow beneath active card */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: -16,
              transform: "translateX(-50%)",
              width: CARD_W * 0.85,
              height: 70,
              background: "radial-gradient(ellipse at center, rgba(201,168,76,0.22), transparent 70%)",
              filter: "blur(22px)",
              zIndex: 1,
              pointerEvents: "none",
              transition: "opacity 0.5s ease",
            }}
          />

          {/* Cards */}
          <div style={{ position: "relative", height: CARD_H, transformStyle: "preserve-3d" }}>
            {STILLS.map((still, i) => {
              const offset = getOffset(i, active);
              if (Math.abs(offset) > 2) return null;
              return (
                <div
                  key={still.src}
                  style={cardStyle(offset)}
                  onClick={() => offset !== 0 && goTo(i)}
                  role={offset !== 0 ? "button" : undefined}
                  tabIndex={offset !== 0 ? 0 : undefined}
                  aria-label={offset !== 0 ? `View ${still.label}` : undefined}
                  onKeyDown={e => e.key === "Enter" && offset !== 0 && goTo(i)}
                >
                  {/* Poster image */}
                  <Image
                    src={still.src}
                    alt={still.label}
                    width={CARD_W}
                    height={CARD_H}
                    style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
                    priority={i === 0}
                  />

                  {/* Reading gradient — bottom dark fade for overlay legibility */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(to top, rgba(4,7,15,0.88) 0%, rgba(4,7,15,0.48) 35%, transparent 62%)",
                      pointerEvents: "none",
                    }}
                  />

                  {/* Bottom-left content overlay */}
                  {(() => {
                    const content = SLIDE_CONTENT[i];
                    const isCenter = offset === 0;
                    const pad = isCenter ? 24 : 18;
                    const titleSize = isCenter ? 26 : 18;
                    return (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          padding: pad,
                          pointerEvents: "none",
                          maxWidth: "80%",
                        }}
                      >
                        {/* Metadata pill */}
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            height: 28,
                            padding: "0 10px",
                            borderRadius: 9999,
                            background: "rgba(10,10,16,0.58)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.12em",
                            color: "rgba(220,228,240,0.85)",
                            textTransform: "uppercase",
                            marginBottom: 10,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {content.pill}
                        </div>

                        {/* Title */}
                        <div
                          style={{
                            fontSize: titleSize,
                            fontWeight: 700,
                            color: "#F0F4FF",
                            lineHeight: 1.2,
                            marginBottom: isCenter ? 8 : 0,
                            textShadow: "0 1px 6px rgba(0,0,0,0.65)",
                          }}
                        >
                          {content.title}
                        </div>

                        {/* Subtitle — center card only */}
                        {isCenter && (
                          <div
                            style={{
                              fontSize: 14,
                              color: "rgba(200,210,230,0.72)",
                              lineHeight: 1.5,
                              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {content.subtitle}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Active card — gold border ring */}
                  {offset === 0 && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: 10,
                        boxShadow: "inset 0 0 0 1px rgba(201,168,76,0.50), 0 0 48px rgba(201,168,76,0.12)",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Reflection — active card only */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: CARD_H + 6,
              transform: "translateX(-50%)",
              width: CARD_W,
              height: 56,
              overflow: "hidden",
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            <Image
              src={STILLS[active].src}
              alt=""
              aria-hidden
              width={CARD_W}
              height={CARD_H}
              style={{
                display: "block",
                width: "100%",
                height: CARD_H,
                objectFit: "cover",
                transform: "scaleY(-1)",
                opacity: 0.14,
                maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 100%)",
                transition: "opacity 0.3s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Dot indicators ── */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: "52px" }}>
        {STILLS.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Slide ${i + 1}`}
            style={{
              width: i === active ? 22 : 6,
              height: 6,
              borderRadius: 3,
              border: "none",
              padding: 0,
              cursor: "pointer",
              background: i === active ? "#C9A84C" : "rgba(255,255,255,0.15)",
              transition: "all 0.35s ease",
              boxShadow: i === active ? "0 0 10px rgba(201,168,76,0.55)" : "none",
            }}
          />
        ))}
      </div>

      {/* ── Headline + supporting text + CTAs (contained) ── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
        <h1
          className="mx-auto leading-tight tracking-tight"
          style={{ fontSize: "clamp(2.4rem, 5.5vw, 4.6rem)", fontWeight: 800, marginBottom: "20px", color: "#F0F4FF" }}
        >
          The AI Filmmaking{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #C9A84C 0%, #E8DFC8 55%, #F0F4FF 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Studio of Tomorrow
          </span>
        </h1>

        <p
          className="mx-auto text-lg leading-relaxed"
          style={{ color: "rgba(200,210,230,0.65)", marginBottom: "40px", maxWidth: "560px" }}
        >
          Move beyond clips. Direct full AI films with scene control, cinematic sequencing, and structured storytelling.
          <br /><br />
          One mind. One system. A complete filmmaking studio.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/studio"
            className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(200,210,230,0.7)",
              textDecoration: "none",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)";
              (e.currentTarget as HTMLElement).style.color = "#F0F4FF";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
              (e.currentTarget as HTMLElement).style.color = "rgba(200,210,230,0.7)";
            }}
          >
            Explore Studio
          </Link>

          <button
            disabled
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 28px",
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 700,
              background: "linear-gradient(135deg, #C9A84C 0%, #8A6B2A 100%)",
              color: "#0a0c10",
              border: "none",
              cursor: "not-allowed",
              opacity: 0.80,
              boxShadow: "0 0 28px rgba(201,168,76,0.25)",
              letterSpacing: "0.01em",
            }}
          >
            <Clapperboard size={14} />
            Early Access — Coming Soon
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
