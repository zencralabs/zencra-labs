"use client";

import { ArrowRight, ImageIcon, Video, Music, Globe, Palette, Sparkles, CheckCircle } from "lucide-react";

const services = [
  {
    id: "ai-video",
    icon: Video,
    color: "#0EA5A0",
    glow: "rgba(14,165,160,0.4)",
    gradient: "linear-gradient(135deg, #0F1A32 0%, #0d2626 50%, #0f4038 100%)",
    badge: "HOT",
    badgeColor: "#0EA5A0",
    title: "AI Video Generation",
    description: "Cinematic AI videos crafted using the most powerful generation models available. From concept to final render.",
    tools: ["Kling 3.0", "Runway ML", "Veo 3", "LTX-2", "Seedance"],
    features: ["Text-to-video generation", "Image-to-video animation", "Lip sync & avatar video", "Style transfer & effects", "4K upscaling"],
  },
  {
    id: "ai-image",
    icon: ImageIcon,
    color: "#2563EB",
    glow: "rgba(37,99,235,0.4)",
    gradient: "linear-gradient(135deg, #0F1A32 0%, #1a1040 50%, #1e3a8a 100%)",
    badge: null,
    badgeColor: "#2563EB",
    title: "AI Image Creation",
    description: "Stunning visuals, portraits, and concept art generated with precision using top-tier AI image models.",
    tools: ["Nano Banana Pro", "Flux", "Seedream"],
    features: ["Photorealistic portraits", "Concept & product art", "Face swap & enhancement", "4K upscaling", "Brand-consistent visuals"],
  },
  {
    id: "ai-audio",
    icon: Music,
    color: "#A855F7",
    glow: "rgba(168,85,247,0.4)",
    gradient: "linear-gradient(135deg, #0F1A32 0%, #1a0d2e 50%, #3b0764 100%)",
    badge: "NEW",
    badgeColor: "#A855F7",
    title: "AI Audio & Music",
    description: "Professional voiceovers, music tracks, and voice cloning powered by the latest AI audio technology.",
    tools: ["ElevenLabs", "Kits AI", "Suno AI"],
    features: ["AI voiceover generation", "Voice cloning", "AI music composition", "Audio cleanup & mastering", "Multi-language support"],
  },
  {
    id: "web-design",
    icon: Globe,
    color: "#60A5FA",
    glow: "rgba(96,165,250,0.4)",
    gradient: "linear-gradient(135deg, #0F1A32 0%, #0f2040 50%, #1e3a8a 100%)",
    badge: null,
    badgeColor: "#60A5FA",
    title: "Web Design & Development",
    description: "Modern, high-performance websites built with Next.js, React, and Tailwind. WordPress & Wix also available.",
    tools: ["Next.js", "React", "Tailwind CSS", "WordPress", "Wix"],
    features: ["Custom website design", "Next.js / React builds", "WordPress & Wix sites", "SEO optimisation", "Supabase & CMS integration"],
  },
  {
    id: "logo-brand",
    icon: Palette,
    color: "#F59E0B",
    glow: "rgba(245,158,11,0.4)",
    gradient: "linear-gradient(135deg, #1a1206 0%, #2d1f06 50%, #451a03 100%)",
    badge: null,
    badgeColor: "#F59E0B",
    title: "Logo & Brand Design",
    description: "Professional 2D and 3D logo design with full brand identity systems — from concept to brand guidelines.",
    tools: ["Adobe Illustrator", "Photoshop", "Blender", "After Effects"],
    features: ["2D & 3D logo design", "Full brand identity", "Animated logos", "Brand guidelines", "Social media kit"],
  },
  {
    id: "ai-creative",
    icon: Sparkles,
    color: "#F43F5E",
    glow: "rgba(244,63,94,0.4)",
    gradient: "linear-gradient(135deg, #1a0a10 0%, #3b0a20 50%, #7f1d1d 100%)",
    badge: "COMING",
    badgeColor: "#F43F5E",
    title: "AI Creative Direction",
    description: "Full creative direction for AI content campaigns — concept, scripting, generation, and final delivery.",
    tools: ["HeyGen", "Kling", "Runway ML", "ElevenLabs"],
    features: ["Campaign concept & strategy", "AI influencer creation", "Content pipeline setup", "Platform optimisation", "Instagram, TikTok, YouTube"],
  },
];

export default function ServicesPage() {
  return (
    <div style={{ backgroundColor: "#080E1C", color: "#F8FAFC", minHeight: "100vh" }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden pt-32 pb-16 text-center">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.15) 0%, transparent 70%)" }} />
        <div className="relative z-10 mx-auto max-w-3xl px-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.3)", color: "#60A5FA" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#2563EB", boxShadow: "0 0 6px #2563EB" }} />
            What We Build
          </div>
          <h1 className="mb-4 font-bold leading-tight text-white" style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)" }}>
            Services & <span style={{ background: "linear-gradient(135deg, #2563EB, #0EA5A0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Capabilities</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "#94A3B8" }}>
            From AI-generated videos to full brand identities — everything built with the latest tools and creative precision.
          </p>
        </div>
      </section>

      {/* ── SERVICES GRID ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <div key={service.id} className="group relative flex flex-col overflow-hidden rounded-2xl p-6 transition-all duration-300"
                style={{ background: service.gradient, border: "1px solid rgba(255,255,255,0.06)", minHeight: "420px" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${service.color}50`;
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 40px ${service.glow}, 0 20px 40px rgba(0,0,0,0.4)`;
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLElement).style.transform = "none";
                }}>

                {/* Glow overlay */}
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: `radial-gradient(circle at 30% 20%, ${service.glow} 0%, transparent 60%)` }} />

                <div className="relative z-10 flex flex-col h-full">
                  {/* Icon + badge */}
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ background: `${service.color}20`, border: `1px solid ${service.color}30` }}>
                      <Icon size={22} style={{ color: service.color }} />
                    </div>
                    {service.badge && (
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: `${service.badgeColor}20`, color: service.badgeColor, border: `1px solid ${service.badgeColor}35` }}>
                        {service.badge}
                      </span>
                    )}
                  </div>

                  {/* Title + description */}
                  <h3 className="mb-2 text-xl font-bold text-white">{service.title}</h3>
                  <p className="mb-5 text-sm leading-relaxed" style={{ color: "#94A3B8" }}>{service.description}</p>

                  {/* Features */}
                  <div className="mb-5 flex flex-col gap-2">
                    {service.features.map(f => (
                      <div key={f} className="flex items-center gap-2">
                        <CheckCircle size={14} style={{ color: service.color, flexShrink: 0 }} />
                        <span className="text-sm" style={{ color: "#CBD5E1" }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  {/* Tools */}
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {service.tools.map(t => (
                      <span key={t} className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748B" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <p className="mb-6 text-lg" style={{ color: "#94A3B8" }}>Ready to start a project?</p>
          <a href="/contact"
            className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition-all duration-300"
            style={{ background: "linear-gradient(135deg, #2563EB 0%, #0EA5A0 100%)", boxShadow: "0 0 30px rgba(37,99,235,0.4)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 50px rgba(37,99,235,0.6)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 30px rgba(37,99,235,0.4)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
            Get in Touch <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </div>
  );
}
