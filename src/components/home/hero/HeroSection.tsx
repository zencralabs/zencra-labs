"use client";

import { HeroBackground } from "./HeroBackground";
import { HeroContent }    from "./HeroContent";
import { HeroCTAs }       from "./HeroCTAs";
import { HeroModeSwitch } from "./HeroModeSwitch";
import { HeroTimeline }   from "./HeroTimeline";
import { HeroStats }      from "./HeroStats";

/**
 * HeroSection
 *
 * Top-level orchestrator for the homepage cinematic hero.
 * Replaces the previous Section 1 in HomePageContent.tsx.
 *
 * Layout (top → bottom, all centred):
 *   • HeroBackground  — full-bleed dark image + glows (absolute, z=0)
 *   • HeroContent     — eyebrow + headline + subtext        (z=10)
 *   • HeroModeSwitch  — pill switcher (Video / Image / Audio / Lip-Sync)
 *   • HeroCTAs        — primary gradient + secondary glass buttons
 *   • HeroStats       — 4-col social-proof grid
 *   • HeroTimeline    — horizontal scroll-snap card strip (full-width)
 *
 * No Framer Motion — CSS transitions only.
 * No autoplay video in v1.
 * next/image `priority` only on HeroBackground's hero-bg.jpg.
 */
export function HeroSection() {
  return (
    <section
      aria-label="Zencra hero"
      style={{
        position: "relative",
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
        backgroundColor: "#050509",
      }}
    >
      {/* ── Full-bleed background ─────────────────────────────────────────── */}
      <HeroBackground />

      {/* ── Main content column ───────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "28px",
          width: "100%",
          paddingTop: "88px",
          paddingBottom: "48px",
        }}
      >
        {/* Headline + subtext */}
        <HeroContent />

        {/* Mode pills */}
        <HeroModeSwitch />

        {/* CTA buttons */}
        <HeroCTAs />

        {/* Social-proof stats */}
        <HeroStats />
      </div>

      {/* ── Full-width card timeline ─────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          paddingBottom: "64px",
        }}
      >
        <HeroTimeline />
      </div>

      {/* ── Global: hide webkit scrollbar inside timeline ─────────────────── */}
      <style>{`
        .hero-timeline-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
}
