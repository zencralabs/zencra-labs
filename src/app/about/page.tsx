"use client";

import { Wand2, Video, ImageIcon, Music, Globe, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";

const values = [
  {
    icon: Zap,
    title: "Speed Without Compromise",
    desc: "We build tools that generate broadcast-quality content in seconds, not hours. Speed is a feature.",
    color: "#2563EB",
  },
  {
    icon: Wand2,
    title: "AI as Creative Partner",
    desc: "Our platform doesn't replace creativity — it amplifies it. You bring the vision, we bring the intelligence.",
    color: "#0EA5A0",
  },
  {
    icon: Globe,
    title: "Built for Everyone",
    desc: "From solo creators to agencies, Zencra Labs scales with your ambition. No technical background needed.",
    color: "#A855F7",
  },
];

const tools = [
  { category: "Image", items: ["ChatGPT Image Gen", "Nano Banana Pro", "Nano Banana 2", "Flux", "Seedream"], color: "#2563EB", icon: ImageIcon },
  { category: "Video", items: ["Kling 3.0", "Google Veo", "Runway ML", "Seedance", "LTX-2", "HeyGen"], color: "#0EA5A0", icon: Video },
  { category: "Audio", items: ["ElevenLabs", "Suno AI", "Kits AI"], color: "#A855F7", icon: Music },
];

const milestones = [
  { year: "2024", title: "Zencra Labs Founded", desc: "Started with a simple idea: make AI creativity accessible to everyone." },
  { year: "2025", title: "Platform Launch", desc: "Launched our web platform with Image, Video, and Audio generation tools." },
  { year: "2025", title: "Multi-Tool Integration", desc: "Integrated 15+ leading AI models into a single unified workspace." },
  { year: "2026", title: "Going Global", desc: "Expanding to support creators, studios, and agencies worldwide." },
];

export default function AboutPage() {
  return (
    <div style={{ backgroundColor: "#080E1C", color: "#F8FAFC", minHeight: "100vh" }}>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-36 pb-20 text-center">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.18) 0%, transparent 65%)" }} />

        <div className="relative z-10 mx-auto max-w-3xl px-6">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.3)", color: "#60A5FA" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#2563EB", boxShadow: "0 0 6px #2563EB" }} />
            Our Story
          </div>

          <h1 className="mb-6 font-bold leading-tight text-white" style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)" }}>
            Intelligence{" "}
            <span style={{ background: "linear-gradient(135deg, #2563EB 0%, #0EA5A0 50%, #A855F7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              by Design
            </span>
          </h1>

          <p className="text-lg leading-relaxed" style={{ color: "#94A3B8" }}>
            Zencra Labs is a modern AI-powered creative platform built for the next generation of digital creators.
            We combine the world&apos;s most powerful AI models into one seamless workspace — so you can generate
            cinematic videos, stunning images, and professional audio without switching between a dozen apps.
          </p>
        </div>
      </section>

      {/* ── MISSION ──────────────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 items-center">
            {/* Left: text */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "#2563EB" }}>Mission</p>
              <h2 className="mb-5 text-3xl font-bold text-white md:text-4xl">
                Create Without Limits
              </h2>
              <p className="mb-5 text-base leading-relaxed" style={{ color: "#94A3B8" }}>
                We believe creative power should belong to everyone — not just big studios with expensive software
                and months of production time. Zencra Labs was built to put professional-grade AI tools directly
                in the hands of individual creators, marketers, choreographers, filmmakers, and brands.
              </p>
              <p className="text-base leading-relaxed" style={{ color: "#94A3B8" }}>
                Our platform connects the leading AI generation models — Kling, Runway ML, Google Veo, ElevenLabs,
                Suno AI, Nano Banana Pro — into a single intelligent workspace. One login. Every tool. Unlimited creativity.
              </p>
            </div>

            {/* Right: stat cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: "15+", label: "AI Models Integrated" },
                { value: "3", label: "Creative Categories" },
                { value: "∞", label: "Possible Creations" },
                { value: "1", label: "Unified Workspace" },
              ].map(stat => (
                <div key={stat.label} className="rounded-2xl p-6 text-center"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="mb-1 text-4xl font-bold"
                    style={{ background: "linear-gradient(135deg, #2563EB, #0EA5A0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    {stat.value}
                  </div>
                  <p className="text-xs" style={{ color: "#64748B" }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── VALUES ───────────────────────────────────────────────────────────── */}
      <section className="py-16" style={{ background: "rgba(255,255,255,0.015)" }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "#0EA5A0" }}>What We Stand For</p>
            <h2 className="text-3xl font-bold text-white">Our Core Values</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {values.map(v => {
              const Icon = v.icon;
              return (
                <div key={v.title} className="rounded-2xl p-7 transition-all duration-300"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${v.color}40`; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${v.color}15`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ background: `${v.color}15`, border: `1px solid ${v.color}25` }}>
                    <Icon size={22} style={{ color: v.color }} />
                  </div>
                  <h3 className="mb-3 text-lg font-bold text-white">{v.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#64748B" }}>{v.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── TOOLS WE USE ─────────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "#A855F7" }}>Powered By</p>
            <h2 className="text-3xl font-bold text-white">The Best AI Models, In One Place</h2>
            <p className="mt-3 text-sm" style={{ color: "#64748B" }}>We integrate the world&apos;s top AI tools so you never have to choose.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {tools.map(cat => {
              const Icon = cat.icon;
              return (
                <div key={cat.category} className="rounded-2xl p-6"
                  style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${cat.color}20` }}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{ background: `${cat.color}15`, border: `1px solid ${cat.color}25` }}>
                      <Icon size={16} style={{ color: cat.color }} />
                    </div>
                    <h3 className="font-bold text-white">{cat.category}</h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    {cat.items.map(item => (
                      <div key={item} className="flex items-center gap-2.5 rounded-lg px-3 py-2"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color, boxShadow: `0 0 6px ${cat.color}` }} />
                        <span className="text-sm" style={{ color: "#94A3B8" }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── TIMELINE ─────────────────────────────────────────────────────────── */}
      <section className="py-16" style={{ background: "rgba(255,255,255,0.015)" }}>
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "#2563EB" }}>Journey</p>
            <h2 className="text-3xl font-bold text-white">Our Milestones</h2>
          </div>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-16 top-0 bottom-0 w-px" style={{ background: "linear-gradient(to bottom, #2563EB40, #0EA5A040, #A855F740)" }} />
            <div className="flex flex-col gap-8">
              {milestones.map((m, i) => (
                <div key={i} className="flex gap-8 items-start">
                  <div className="w-32 flex-shrink-0 text-right">
                    <span className="text-sm font-bold" style={{ color: i % 2 === 0 ? "#2563EB" : "#0EA5A0" }}>{m.year}</span>
                  </div>
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2"
                      style={{ backgroundColor: "#080E1C", borderColor: i % 2 === 0 ? "#2563EB" : "#0EA5A0" }} />
                    <h3 className="mb-1 font-semibold text-white">{m.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "#64748B" }}>{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="py-20 text-center">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="mb-4 text-3xl font-bold text-white">Ready to Start Creating?</h2>
          <p className="mb-8 text-base" style={{ color: "#64748B" }}>
            Join thousands of creators already using Zencra Labs to produce stunning AI content.
          </p>
          <Link href="/signup"
            className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition-all duration-300"
            style={{ background: "linear-gradient(135deg, #2563EB, #0EA5A0)", boxShadow: "0 0 30px rgba(37,99,235,0.4)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 50px rgba(37,99,235,0.7)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 30px rgba(37,99,235,0.4)"; }}
          >
            <Wand2 size={16} />
            Get Started Free
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

    </div>
  );
}
