"use client";

import { useState } from "react";
import Link from "next/link";
import { Clapperboard, ArrowLeft, Film, Layers, Users, Sparkles, ArrowRight } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// FUTURE CINEMA STUDIO — Premium Coming-Soon surface
// This is a standalone page separate from the normal Studio tool list.
// LTX will power this when backend contracts are ready.
// ─────────────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Clapperboard,
    color: "#A855F7",
    title: "Scene-based Editing",
    desc: "Build films scene by scene — with full control over pacing, cuts, and visual continuity.",
  },
  {
    icon: Film,
    color: "#6366F1",
    title: "Storyboard Workflow",
    desc: "Translate written scripts and storyboards directly into AI-generated visual sequences.",
  },
  {
    icon: Users,
    color: "#8B5CF6",
    title: "Character Consistency",
    desc: "Maintain the same characters across every scene — consistent look, motion, and personality.",
  },
  {
    icon: Layers,
    color: "#7C3AED",
    title: "Shot Sequencing",
    desc: "Director-level control over camera angles, shot composition, and cinematic framing.",
  },
  {
    icon: Sparkles,
    color: "#A78BFA",
    title: "Cinematic Grade",
    desc: "Built-in cinematic colour grading and film-quality rendering for every output.",
  },
  {
    icon: ArrowRight,
    color: "#C084FC",
    title: "Export Ready",
    desc: "Export in broadcast-ready formats — H.264, ProRes, and more.",
  },
];

// Timeline strip card colours
const timelineColors = ["#A855F7","#6366F1","#7C3AED","#8B5CF6","#A855F7","#6366F1","#4F46E5","#7C3AED","#A855F7","#6366F1"];

export default function CinemaStudioPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    // UI-only — not wired to any backend yet.
    // TODO: connect to Supabase waitlist table or email provider before launch.
    await new Promise((r) => setTimeout(r, 600));
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #050a14 0%, #08101e 30%, #0e0820 60%, #160b30 100%)",
        color: "#F8FAFC",
        fontFamily: "var(--font-body, system-ui, sans-serif)",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div style={{ position: "absolute", width: "70%", height: "70%", borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)", top: "-20%", right: "-15%", filter: "blur(100px)" }} />
        <div style={{ position: "absolute", width: "50%", height: "50%", borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)", bottom: "-15%", left: "-10%", filter: "blur(80px)" }} />
        <div style={{ position: "absolute", width: "30%", height: "30%", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)", top: "40%", left: "30%", filter: "blur(70px)" }} />
      </div>

      {/* Subtle grid */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.025]" style={{ backgroundImage: "linear-gradient(rgba(168,85,247,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.5) 1px, transparent 1px)", backgroundSize: "80px 80px" }} aria-hidden="true" />

      {/* Back nav */}
      <div className="container-site pt-8 pb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium transition-all duration-200"
          style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
        >
          <ArrowLeft size={14} />
          Back to Zencra Labs
        </Link>
      </div>

      {/* ── HERO ── */}
      <section className="container-site" style={{ paddingTop: "80px", paddingBottom: "60px", textAlign: "center" }}>
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.2em]"
          style={{ background: "rgba(168,85,247,0.10)", border: "1px solid rgba(168,85,247,0.30)", color: "#C084FC", marginBottom: "32px" }}
        >
          <Clapperboard size={13} />
          Future Cinema Studio
          <span
            className="rounded-full px-2 py-0.5 text-[8px] font-bold"
            style={{ background: "rgba(168,85,247,0.25)", color: "#A855F7" }}
          >
            COMING SOON
          </span>
        </div>

        {/* Headline */}
        <h1
          className="mx-auto max-w-4xl font-bold leading-tight tracking-tight"
          style={{ fontSize: "clamp(2.4rem, 6vw, 5rem)", marginBottom: "24px" }}
        >
          The AI Filmmaking{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #A855F7 0%, #6366F1 50%, #60A5FA 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Studio of Tomorrow
          </span>
        </h1>

        {/* Subline */}
        <p
          className="mx-auto max-w-2xl text-lg leading-relaxed"
          style={{ color: "#94A3B8", marginBottom: "48px" }}
        >
          Move beyond clips. Direct full AI films with scene control, character continuity, storyboard workflows, and cinematic storytelling tools — all in one environment.
        </p>

        {/* Waitlist form */}
        {!submitted ? (
          <form
            onSubmit={handleWaitlist}
            className="mx-auto flex max-w-md flex-col items-center gap-3 sm:flex-row"
          >
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                flex: 1, padding: "13px 18px", borderRadius: 14, fontSize: 15,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff", outline: "none", width: "100%",
                fontFamily: "var(--font-body, system-ui)",
              }}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(168,85,247,0.5)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(168,85,247,0.15)"; }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "13px 28px", borderRadius: 14, fontSize: 14, fontWeight: 700,
                background: "linear-gradient(135deg, #A855F7, #6366F1)",
                color: "#fff", border: "none", cursor: loading ? "wait" : "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 0 30px rgba(168,85,247,0.35)",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 50px rgba(168,85,247,0.6)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 30px rgba(168,85,247,0.35)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
            >
              {loading ? "Joining…" : "Join Waitlist"}
            </button>
          </form>
        ) : (
          <div
            className="mx-auto inline-flex items-center gap-3 rounded-2xl px-6 py-4"
            style={{ background: "rgba(168,85,247,0.10)", border: "1px solid rgba(168,85,247,0.25)", maxWidth: 480 }}
          >
            <span style={{ fontSize: 20 }}>🎬</span>
            <div>
              <p style={{ fontWeight: 700, color: "#C084FC", fontSize: 14 }}>Interest registered!</p>
              <p style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Cinema Studio is in development. Early access sign-up coming soon.</p>
            </div>
          </div>
        )}

        {/* Disclaimer — form is not yet wired to backend */}
        <p style={{ textAlign: "center", fontSize: 11, color: "#334155", marginTop: 16 }}>
          Preview only — no emails are stored at this stage.
        </p>
      </section>

      {/* ── CINEMATIC PREVIEW CARD — 16:9 ── */}
      <section className="container-site" style={{ paddingBottom: "80px" }}>
        <div
          className="relative w-full overflow-hidden rounded-3xl"
          style={{
            aspectRatio: "16/9",
            background: "linear-gradient(135deg, #060a14 0%, #0d0820 40%, #160b30 100%)",
            border: "1px solid rgba(168,85,247,0.20)",
            boxShadow: "0 0 80px rgba(168,85,247,0.08), 0 30px 80px rgba(0,0,0,0.6)",
          }}
        >
          {/* Glow */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div style={{ position: "absolute", width: "55%", height: "70%", borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.2) 0%, transparent 70%)", top: "-15%", right: "-10%", filter: "blur(80px)" }} />
            <div style={{ position: "absolute", width: "35%", height: "50%", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", bottom: "-10%", left: "5%", filter: "blur(60px)" }} />
          </div>

          {/* Grid overlay */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(168,85,247,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.5) 1px, transparent 1px)", backgroundSize: "50px 50px" }} />

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-3xl"
              style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.30)", boxShadow: "0 0 40px rgba(168,85,247,0.2)" }}
            >
              <Clapperboard size={36} style={{ color: "rgba(168,85,247,0.8)" }} />
            </div>
            <p style={{ fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>Preview coming soon</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", textAlign: "center", maxWidth: 360 }}>
              This space will show real Cinema Studio workflow previews and example films when early access opens.
            </p>
          </div>

          {/* Film timeline strip */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center gap-0.5 px-4 py-3"
            style={{ background: "linear-gradient(to top, rgba(5,10,20,0.95), transparent)" }}
          >
            {Array.from({ length: 32 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm"
                style={{
                  height: "16px",
                  background: i % 5 === 0 ? `${timelineColors[i % timelineColors.length]}60` : i % 9 === 0 ? `${timelineColors[(i + 3) % timelineColors.length]}40` : "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(168,85,247,0.06)",
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section className="container-site" style={{ paddingBottom: "100px" }}>
        <div className="text-center" style={{ marginBottom: "60px" }}>
          <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "#A855F7", marginBottom: "16px" }}>What&apos;s Coming</p>
          <h2 className="font-bold tracking-tight" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: "#F8FAFC" }}>
            Designed for Real Filmmakers
          </h2>
          <p className="mx-auto mt-4 max-w-xl" style={{ color: "#64748B", lineHeight: 1.7 }}>
            Every feature is built around professional cinematic storytelling workflows — not just clip generation.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="rounded-2xl p-6"
                style={{
                  background: `linear-gradient(135deg, ${feat.color}08 0%, ${feat.color}03 100%)`,
                  border: `1px solid ${feat.color}18`,
                  transition: "transform 0.2s ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-4px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
              >
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: `${feat.color}15`, border: `1px solid ${feat.color}25` }}
                >
                  <Icon size={20} style={{ color: feat.color }} />
                </div>
                <h3 className="mb-2 font-bold" style={{ color: "#F8FAFC", fontSize: 16 }}>{feat.title}</h3>
                <p style={{ color: "#64748B", lineHeight: 1.65, fontSize: 14 }}>{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FOOTER CTA ── */}
      <section
        style={{
          borderTop: "1px solid rgba(168,85,247,0.12)",
          padding: "70px 0",
          textAlign: "center",
        }}
      >
        <div className="container-site flex flex-col items-center gap-5">
          <h2 className="font-bold tracking-tight" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", color: "#F8FAFC" }}>
            Ready to direct the future?
          </h2>
          <p style={{ color: "#64748B", maxWidth: 400, lineHeight: 1.7 }}>
            Join the waitlist for early access to Future Cinema Studio and be the first to create AI films at scale.
          </p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link
              href="/studio/image"
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8", textDecoration: "none" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.color = "#F8FAFC"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
            >
              Try Image Studio now
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold text-white transition-all duration-300"
              style={{ background: "linear-gradient(135deg, #A855F7, #6366F1)", border: "none", textDecoration: "none", boxShadow: "0 0 24px rgba(168,85,247,0.3)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(168,85,247,0.55)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(168,85,247,0.3)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
            >
              Explore Zencra Labs
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
