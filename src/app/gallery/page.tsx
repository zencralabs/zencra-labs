"use client";

import { useState } from "react";
import { Play, ImageIcon, Music } from "lucide-react";

const filters = ["All", "Video", "Image", "Audio"];

const galleryItems = [
  { id: 1, type: "Video", tool: "Kling 3.0", title: "Neon City Chase", height: 320, gradient: "linear-gradient(160deg, #0F1A32 0%, #1e3a8a 50%, #1d4ed8 100%)", accent: "#2563EB" },
  { id: 2, type: "Image", tool: "Nano Banana Pro", title: "Cyberpunk Portrait", height: 240, gradient: "linear-gradient(160deg, #0d0d1a 0%, #1a0d2e 50%, #7c3aed 100%)", accent: "#A855F7" },
  { id: 3, type: "Video", tool: "Runway ML", title: "Ocean Drift", height: 280, gradient: "linear-gradient(160deg, #0d1a1a 0%, #0f3030 50%, #0ea5a0 100%)", accent: "#0EA5A0" },
  { id: 4, type: "Image", tool: "Flux", title: "Fire Abstract", height: 200, gradient: "linear-gradient(160deg, #1a0a0a 0%, #3b1010 50%, #dc2626 100%)", accent: "#EF4444" },
  { id: 5, type: "Video", tool: "Veo 3", title: "Urban Storm", height: 360, gradient: "linear-gradient(160deg, #0a0f1a 0%, #1a2744 50%, #2563eb 100%)", accent: "#60A5FA" },
  { id: 6, type: "Audio", tool: "Suno AI", title: "Deep Frequency", height: 180, gradient: "linear-gradient(160deg, #0f0a1a 0%, #2d1b69 50%, #7c3aed 100%)", accent: "#A855F7" },
  { id: 7, type: "Image", tool: "Seedream", title: "Forest Spirit", height: 260, gradient: "linear-gradient(160deg, #0d1a14 0%, #064e3b 50%, #10b981 100%)", accent: "#10B981" },
  { id: 8, type: "Video", tool: "LTX-2", title: "Golden Hour", height: 210, gradient: "linear-gradient(160deg, #1a1206 0%, #422006 50%, #f59e0b 100%)", accent: "#F59E0B" },
  { id: 9, type: "Video", tool: "HeyGen", title: "Avatar Dance", height: 300, gradient: "linear-gradient(160deg, #0f1a32 0%, #1e3a5f 50%, #0ea5a0 100%)", accent: "#0EA5A0" },
  { id: 10, type: "Image", tool: "Seedream", title: "Galactic Dream", height: 220, gradient: "linear-gradient(160deg, #1a0f1a 0%, #4c0d8a 50%, #c084fc 100%)", accent: "#C084FC" },
  { id: 11, type: "Audio", tool: "ElevenLabs", title: "Voice Clone Demo", height: 170, gradient: "linear-gradient(160deg, #0a1020 0%, #162040 50%, #2563eb 100%)", accent: "#2563EB" },
  { id: 12, type: "Video", tool: "Kling 3.0", title: "Underwater City", height: 310, gradient: "linear-gradient(160deg, #0a1020 0%, #162040 50%, #1d4ed8 100%)", accent: "#2563EB" },
  { id: 13, type: "Audio", tool: "Kits AI", title: "Voice Morph", height: 190, gradient: "linear-gradient(160deg, #1a0a10 0%, #5a0a20 50%, #f43f5e 100%)", accent: "#F43F5E" },
  { id: 14, type: "Image", tool: "Nano Banana Pro", title: "Neon Goddess", height: 270, gradient: "linear-gradient(160deg, #0f0a1a 0%, #2d1b69 50%, #a855f7 100%)", accent: "#A855F7" },
  { id: 15, type: "Video", tool: "Seedance", title: "Dance Loop", height: 230, gradient: "linear-gradient(160deg, #1a0f0a 0%, #451a03 50%, #f59e0b 100%)", accent: "#F59E0B" },
  { id: 16, type: "Image", tool: "Flux", title: "Crystal Bloom", height: 190, gradient: "linear-gradient(160deg, #0d1a14 0%, #064e3b 50%, #10b981 100%)", accent: "#10B981" },
];

const typeIcon = (type: string) => {
  if (type === "Video") return Play;
  if (type === "Audio") return Music;
  return ImageIcon;
};

export default function GalleryPage() {
  const [active, setActive] = useState("All");
  const filtered = active === "All" ? galleryItems : galleryItems.filter(i => i.type === active);

  return (
    <div style={{ backgroundColor: "#080E1C", color: "#F8FAFC", minHeight: "100vh" }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden pt-32 pb-12 text-center">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(14,165,160,0.12) 0%, transparent 70%)" }} />
        <div className="relative z-10 mx-auto max-w-2xl px-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ background: "rgba(14,165,160,0.12)", border: "1px solid rgba(14,165,160,0.3)", color: "#2DD4BF" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#0EA5A0", boxShadow: "0 0 6px #0EA5A0" }} />
            Made with Zencra
          </div>
          <h1 className="mb-4 font-bold text-white" style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)" }}>
            Creative <span style={{ background: "linear-gradient(135deg, #0EA5A0, #A855F7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Gallery</span>
          </h1>
          <p className="text-lg" style={{ color: "#94A3B8" }}>
            AI-generated videos, images and audio crafted using the world's most powerful creative tools.
          </p>
        </div>
      </section>

      {/* ── FILTER TABS ────────────────────────────────────────────────────── */}
      <div className="flex justify-center gap-2 pb-10 px-6">
        {filters.map(f => (
          <button key={f} onClick={() => setActive(f)}
            className="rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200"
            style={active === f
              ? { background: "linear-gradient(135deg, #2563EB, #0EA5A0)", color: "#fff", boxShadow: "0 0 20px rgba(37,99,235,0.4)" }
              : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#94A3B8" }}>
            {f}
          </button>
        ))}
      </div>

      {/* ── MASONRY GRID ───────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-6 pb-24">
        <div style={{ columns: "4", columnGap: "12px" }}>
          {filtered.map(item => {
            const Icon = typeIcon(item.type);
            return (
              <div key={item.id}
                className="group relative mb-3 cursor-pointer overflow-hidden rounded-xl transition-all duration-300"
                style={{ breakInside: "avoid", height: `${item.height}px`, background: item.gradient, border: "1px solid rgba(255,255,255,0.04)" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = "scale(1.02)";
                  (e.currentTarget as HTMLElement).style.zIndex = "10";
                  (e.currentTarget as HTMLElement).style.borderColor = `${item.accent}60`;
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${item.accent}30`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = "none";
                  (e.currentTarget as HTMLElement).style.zIndex = "auto";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}>

                {/* Bottom overlay on hover */}
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: "linear-gradient(to top, rgba(8,14,28,0.95), transparent)" }} />

                {/* Content on hover */}
                <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <p className="text-xs font-bold text-white leading-tight">{item.title}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: `${item.accent}25`, color: item.accent, border: `1px solid ${item.accent}35` }}>
                      {item.type}
                    </span>
                    <span className="text-[10px]" style={{ color: "#64748B" }}>{item.tool}</span>
                  </div>
                </div>

                {/* Type icon + dot */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                  <Icon size={10} style={{ color: item.accent }} />
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.accent, boxShadow: `0 0 6px ${item.accent}` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
