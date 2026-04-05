"use client";

import { useState } from "react";
import { Wand2, Sparkles, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";

interface ToolCreatorPageProps {
  toolName: string;
  category: "Image" | "Video" | "Audio";
  tagline: string;
  description: string;
  color: string;
  gradient: string;
  badge?: string | null;
  features: string[];
  promptPlaceholder: string;
  comingSoon?: boolean;
  exampleOutputs: { gradient: string; label: string }[];
}

const categoryColors = {
  Image: "#2563EB",
  Video: "#0EA5A0",
  Audio: "#A855F7",
};

export function ToolCreatorPage({
  toolName,
  category,
  tagline,
  description,
  color,
  gradient,
  badge,
  features,
  promptPlaceholder,
  comingSoon = false,
  exampleOutputs,
}: ToolCreatorPageProps) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const catColor = categoryColors[category];

  function handleGenerate() {
    if (!prompt.trim() || comingSoon) return;
    setGenerating(true);
    setTimeout(() => setGenerating(false), 2000);
  }

  return (
    <div style={{ backgroundColor: "#080E1C", color: "#F8FAFC", minHeight: "100vh" }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-32 pb-16">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true"
          style={{ background: `radial-gradient(ellipse at 30% 0%, ${color}18 0%, transparent 60%)` }} />

        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-10 items-center lg:grid-cols-2">

            {/* Left: info */}
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{ background: `${catColor}12`, border: `1px solid ${catColor}30`, color: catColor }}>
                {category}
                {badge && <span className="ml-1 opacity-70">· {badge}</span>}
              </div>

              <h1 className="mb-4 text-4xl font-bold leading-tight text-white md:text-5xl">
                {toolName}
              </h1>
              <p className="mb-3 text-xl font-medium" style={{ color: catColor }}>{tagline}</p>
              <p className="mb-8 text-base leading-relaxed" style={{ color: "#94A3B8" }}>{description}</p>

              {/* Feature tags */}
              <div className="flex flex-wrap gap-2">
                {features.map(f => (
                  <span key={f} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                    style={{ background: `${color}10`, border: `1px solid ${color}20`, color: "#94A3B8" }}>
                    <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: tool preview card */}
            <div className="relative overflow-hidden rounded-3xl"
              style={{ height: "340px", background: gradient, border: `1px solid ${color}30`, boxShadow: `0 0 60px ${color}20` }}>
              <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at 60% 30%, rgba(255,255,255,0.06) 0%, transparent 60%)" }} />
              <div className="absolute bottom-6 left-6">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                  <span className="text-xs font-semibold text-white/60">{toolName}</span>
                </div>
                <p className="text-2xl font-bold text-white/20">{category} Generation</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── CREATE SECTION ───────────────────────────────────────────────── */}
      <section className="py-12">
        <div className="mx-auto max-w-3xl px-6">
          <div className="rounded-2xl p-8"
            style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${color}20` }}>

            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                <Wand2 size={18} style={{ color }} />
              </div>
              <div>
                <h2 className="font-bold text-white">Create with {toolName}</h2>
                <p className="text-xs" style={{ color: "#475569" }}>
                  {comingSoon ? "Coming soon — join the waitlist below" : "Describe what you want to generate"}
                </p>
              </div>
            </div>

            {/* Prompt input */}
            <div className="relative mb-4">
              <textarea
                rows={4}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={comingSoon ? "This tool is coming soon to Zencra Labs..." : promptPlaceholder}
                disabled={comingSoon}
                className="w-full resize-none rounded-xl p-4 text-sm transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${prompt && !comingSoon ? color + "60" : "rgba(255,255,255,0.08)"}`,
                  color: "#F8FAFC",
                  outline: "none",
                  boxShadow: prompt && !comingSoon ? `0 0 20px ${color}15` : "none",
                  opacity: comingSoon ? 0.5 : 1,
                }}
              />
            </div>

            {comingSoon ? (
              <Link href="/signup"
                className="flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-300"
                style={{ background: `linear-gradient(135deg, ${color}, #2563EB)` }}>
                <Sparkles size={14} />
                Join Waitlist — Get Early Access
              </Link>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || generating}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-300"
                style={{
                  background: prompt.trim() ? `linear-gradient(135deg, ${color}, #2563EB)` : "rgba(255,255,255,0.05)",
                  border: prompt.trim() ? "none" : "1px solid rgba(255,255,255,0.1)",
                  cursor: prompt.trim() ? "pointer" : "default",
                  opacity: generating ? 0.8 : 1,
                  boxShadow: prompt.trim() ? `0 0 30px ${color}30` : "none",
                }}>
                {generating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    Generate
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── EXAMPLE OUTPUTS ──────────────────────────────────────────────── */}
      {exampleOutputs.length > 0 && (
        <section className="pb-20">
          <div className="mx-auto max-w-6xl px-6">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "#475569" }}>
              Example Outputs
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {exampleOutputs.map((item, i) => (
                <div key={i} className="relative overflow-hidden rounded-xl transition-all duration-300"
                  style={{ height: "160px", background: item.gradient, border: `1px solid ${color}20` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.03)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${color}25`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
                  <div className="absolute bottom-0 left-0 right-0 h-16"
                    style={{ background: "linear-gradient(to top, rgba(8,14,28,0.9), transparent)" }} />
                  <div className="absolute bottom-3 left-3">
                    <p className="text-xs font-medium text-white/70">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
