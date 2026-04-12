"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import MediaCard from "@/components/media/MediaCard";
import type { PublicAsset } from "@/lib/types/generation";

// ─────────────────────────────────────────────────────────────────────────────
// ZENCRA STUDIO — Image Generation
// Inspired by Higgsfield AI's generation workspace
// DALL-E 3 connected | Nano Banana / Playground — coming soon
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────
interface GeneratedImage {
  id: string;
  url: string | null;
  prompt: string;
  model: string;
  aspectRatio: string;
  status: "generating" | "done" | "error";
  error?: string;
}

type AspectRatio = "Auto" | "1:1" | "3:4" | "4:3" | "2:3" | "3:2" | "9:16" | "16:9" | "5:4" | "4:5" | "21:9";
type Quality = "1K" | "2K" | "4K";
type Tab = "history" | "community";

interface StudioModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  badge: string | null;
  badgeColor: string | null;
  available: boolean;
  icon: string;
  requiresImg?: boolean;
  nbVariant?: string;
  allowedQualities?: Quality[];
}

// ── Provider routing ──────────────────────────────────────────────────────────
type ProviderRouting = { provider: "dalle" | "nano-banana"; nbVariant?: string };

const MODEL_TO_PROVIDER: Record<string, ProviderRouting> = {
  "dalle3":               { provider: "dalle" },
  "nano-banana-standard": { provider: "nano-banana", nbVariant: "standard" },
  "nano-banana-edit":     { provider: "nano-banana", nbVariant: "edit" },
  "nano-banana-pro":      { provider: "nano-banana", nbVariant: "pro" },
};

// ── Credit display helper ─────────────────────────────────────────────────────
function computeCredits(modelId: string, quality: Quality, count: number): number {
  if (modelId.startsWith("nano-banana")) {
    if (quality === "4K") return count * 8;
    if (quality === "2K") return count * 4;
    return count * 2;
  }
  return quality === "2K" ? count * 4 : count * 2;
}

// ── Aspect ratio → API string ─────────────────────────────────────────────────
function mapArToApiAr(ar: AspectRatio): "1:1" | "16:9" | "9:16" | "4:5" {
  const landscape = ["16:9", "3:2", "4:3", "21:9", "5:4"];
  const portrait  = ["9:16", "2:3", "3:4"];
  if (landscape.includes(ar)) return "16:9";
  if (portrait.includes(ar))  return "9:16";
  if (ar === "4:5")            return "4:5";
  return "1:1";
}

// ── Model definitions ─────────────────────────────────────────────────────────
const MODELS: StudioModel[] = [
  {
    id: "dalle3",           // backend provider key → "dalle" → resolves to "dalle-3" in tool-registry
    name: "GPT Image 1.5",
    provider: "OpenAI",
    description: "OpenAI's advanced image generation model",
    badge: null,
    badgeColor: null,
    available: true,
    icon: "openai",
    allowedQualities: ["1K", "2K"],
  },
  {
    id: "nano-banana-standard",
    name: "Nano Banana",
    provider: "NanoBanana",
    description: "Fast text-to-image generation",
    badge: "Fast",
    badgeColor: "#065F46",
    available: true,
    icon: "nanobana",
    nbVariant: "standard",
    allowedQualities: ["1K"],
  },
  {
    id: "nano-banana-edit",
    name: "Nano Banana Edit",
    provider: "NanoBanana",
    description: "AI-powered image-to-image editing",
    badge: "Edit",
    badgeColor: "#7C2D12",
    available: true,
    icon: "nanobana",
    nbVariant: "edit",
    requiresImg: true,
    allowedQualities: ["1K"],
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    provider: "NanoBanana",
    description: "High-resolution output · 1K · 2K · 4K",
    badge: "Pro",
    badgeColor: "#1E3A5F",
    available: true,
    icon: "nanobana",
    nbVariant: "pro",
    allowedQualities: ["1K", "2K", "4K"],
  },
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    provider: "NanoBanana",
    description: "Next-generation model · Coming soon",
    badge: "SOON",
    badgeColor: "#374151",
    available: false,
    icon: "nanobana",
  },
  {
    id: "midjourney-v7",
    name: "Midjourney v7",
    provider: "Midjourney",
    description: "Industry-leading artistic AI images",
    badge: "SOON",
    badgeColor: "#374151",
    available: false,
    icon: "midjourney",
  },
  {
    id: "flux-pro",
    name: "FLUX Pro",
    provider: "Black Forest Labs",
    description: "Speed-optimised, fine detail generation",
    badge: "SOON",
    badgeColor: "#374151",
    available: false,
    icon: "flux",
  },
];

const ASPECT_RATIOS: AspectRatio[] = [
  "Auto", "1:1", "3:4", "4:3", "2:3", "3:2",
  "9:16", "16:9", "5:4", "4:5", "21:9",
];

// ── AR icon ───────────────────────────────────────────────────────────────────
function ARIcon({ ar, size = 16, selected = false }: { ar: AspectRatio; size?: number; selected?: boolean }) {
  const map: Record<string, { w: number; h: number }> = {
    Auto: { w: 1, h: 1 }, "1:1": { w: 1, h: 1 }, "3:4": { w: 3, h: 4 },
    "4:3": { w: 4, h: 3 }, "2:3": { w: 2, h: 3 }, "3:2": { w: 3, h: 2 },
    "9:16": { w: 9, h: 16 }, "16:9": { w: 16, h: 9 }, "5:4": { w: 5, h: 4 },
    "4:5": { w: 4, h: 5 }, "21:9": { w: 21, h: 9 },
  };
  const { w, h } = map[ar] ?? { w: 1, h: 1 };
  const scale = Math.min(size / w, size / h) * 0.65;
  const bw = Math.max(Math.round(w * scale), 4);
  const bh = Math.max(Math.round(h * scale), 4);
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: bw, height: bh,
        border: `1.5px solid ${selected ? "#fff" : "rgba(255,255,255,0.6)"}`,
        borderRadius: 2,
        background: selected ? "rgba(255,255,255,0.15)" : "transparent",
        flexShrink: 0,
      }} />
    </div>
  );
}

// ── Model icon ────────────────────────────────────────────────────────────────
function ModelIcon({ type, size = 22 }: { type: string; size?: number }) {
  if (type === "nanobana") {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: "linear-gradient(135deg, #F59E0B, #10B981)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.6, flexShrink: 0,
      }}>
        🍌
      </div>
    );
  }
  const bg = type === "openai" ? "#10a37f" : type === "playground" ? "#7c3aed" : "#374151";
  const letter = type === "openai" ? "O" : type === "playground" ? "P" : "I";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.55, fontWeight: 700, color: "#fff", flexShrink: 0,
    }}>
      {letter}
    </div>
  );
}

// ── Shimmer placeholder ───────────────────────────────────────────────────────
function GeneratingPlaceholder({ ar }: { ar: AspectRatio }) {
  const ratioMap: Record<string, number> = {
    Auto: 1, "1:1": 1, "3:4": 4 / 3, "4:3": 3 / 4, "2:3": 3 / 2, "3:2": 2 / 3,
    "9:16": 16 / 9, "16:9": 9 / 16, "5:4": 4 / 5, "4:5": 5 / 4, "21:9": 9 / 21,
  };
  const paddingBottom = `${(ratioMap[ar] ?? 1) * 100}%`;

  return (
    <div style={{ position: "relative", width: "100%", paddingBottom, borderRadius: 10, overflow: "hidden" }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(110deg, #1a1a2e 25%, #16213e 50%, #1a1a2e 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
      }}>
        <style>{`
          @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
          @keyframes spin { to{transform:rotate(360deg)} }
          @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        `}</style>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          border: "2.5px solid rgba(255,255,255,0.08)",
          borderTop: "2.5px solid rgba(255,255,255,0.5)",
          animation: "spin 0.9s linear infinite",
        }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>Generating…</span>
      </div>
    </div>
  );
}

// ── Image card ────────────────────────────────────────────────────────────────
// Adapts local GeneratedImage to PublicAsset shape for MediaCard
function toPublicAsset(img: GeneratedImage): PublicAsset {
  return {
    id:            img.id,
    tool:          img.model,
    tool_category: "image",
    prompt:        img.prompt,
    result_url:    img.url,
    result_urls:   img.url ? [img.url] : null,
    visibility:    "project",   // newly generated → in user's project by default
    project_id:    null,
    credits_used:  0,
    created_at:    new Date().toISOString(),
  };
}

function ImageCard({
  img,
  onRegenerate,
  onReusePrompt,
}: {
  img: GeneratedImage;
  onRegenerate?: (prompt: string, model: string, ar: string) => void;
  onReusePrompt?: (prompt: string) => void;
}) {
  if (img.status === "generating") {
    return <GeneratingPlaceholder ar={img.aspectRatio as AspectRatio} />;
  }

  if (img.status === "error") {
    return (
      <div style={{
        width: "100%", paddingBottom: "100%", borderRadius: 10, position: "relative",
        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
      }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 16 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
            {img.error ?? "Generation failed"}
          </span>
        </div>
      </div>
    );
  }

  // Done — render full MediaCard with owner actions
  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <MediaCard
        asset={toPublicAsset(img)}
        isOwner
        onRegenerate={() => onRegenerate?.(img.prompt, img.model, img.aspectRatio)}
        onReusePrompt={onReusePrompt}
        onEnhance={() => {
          // Topaz enhance — coming soon; show tooltip via alert for now
          alert("✨ Topaz enhancement is coming soon!");
        }}
        onAnimate={() => {
          // Animate → route to video studio with prompt pre-filled
          window.location.href = `/studio/cinema?prompt=${encodeURIComponent(img.prompt)}`;
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER PAGE
// ─────────────────────────────────────────────────────────────────────────────
function ImageStudioInner() {
  const { user, refreshUser } = useAuth();
  const searchParams = useSearchParams();

  // Map catalog IDs (from navbar ?model= param) to internal studio model IDs
  const CATALOG_TO_STUDIO_MODEL: Record<string, string> = {
    "gpt-image-15":    "dalle3",
    "nano-banana":     "nano-banana-standard",
    "nano-banana-pro": "nano-banana-pro",
  };
  const modelParam = searchParams.get("model") ?? "";
  const initialModel = CATALOG_TO_STUDIO_MODEL[modelParam] ?? "dalle3";

  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [prompt, setPrompt] = useState(searchParams.get("prompt") ?? "");
  const [model, setModel] = useState(initialModel);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("3:4");
  const [quality, setQuality] = useState<Quality>("1K");
  const [batchSize, setBatchSize] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(3); // 1-5
  const [activeTab, setActiveTab] = useState<Tab>("history");
  const [authModal, setAuthModal] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState("");   // source image for edit models

  // Dropdowns
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showArPicker, setShowArPicker] = useState(false);
  const [showQualityPicker, setShowQualityPicker] = useState(false);
  const [modelSearch, setModelSearch] = useState("");

  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentModel = MODELS.find((m) => m.id === model) ?? MODELS[0];

  // Grid column sizing based on zoom level
  const ZOOM_SIZES = [160, 220, 300, 400, 520];
  const gridMinSize = ZOOM_SIZES[zoomLevel - 1];

  function closeDropdowns() {
    setShowModelPicker(false);
    setShowArPicker(false);
    setShowQualityPicker(false);
  }

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!(e.target as Element).closest("[data-dd]")) closeDropdowns();
    }
    window.addEventListener("mousedown", handle);
    return () => window.removeEventListener("mousedown", handle);
  }, []);

  // When model changes: reset quality if not allowed, clear edit image if not needed
  useEffect(() => {
    const cm = MODELS.find((m) => m.id === model);
    if (!cm) return;
    if (cm.allowedQualities && !cm.allowedQualities.includes(quality)) {
      setQuality(cm.allowedQualities[0]);
    }
    if (!cm.requiresImg) setEditImageUrl("");
    if (cm.requiresImg) setBatchSize(1);  // edit models: 1 at a time
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  const filteredModels = MODELS.filter(
    (m) => m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.provider.toLowerCase().includes(modelSearch.toLowerCase())
  );

  // ── Generate ───────────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (!prompt.trim()) return;
    if (!user) { setAuthModal(true); return; }
    if (!currentModel.available) return;

    const routing    = MODEL_TO_PROVIDER[model] ?? { provider: "dalle" as const };
    const isNB       = routing.provider === "nano-banana";
    const count      = isNB ? 1 : Math.min(batchSize, 4);
    const nbVariant  = routing.nbVariant === "pro" && quality === "4K" ? "pro-4k" : routing.nbVariant;
    const apiQuality = quality === "2K" ? "studio" : "cinematic";
    const apiAr      = mapArToApiAr(aspectRatio);

    // Add placeholder(s) immediately so the grid shows shimmer
    const placeholders: GeneratedImage[] = Array.from({ length: count }, (_, i) => ({
      id: `gen-${Date.now()}-${i}`,
      url: null,
      prompt,
      model,
      aspectRatio,
      status: "generating" as const,
    }));
    setImages((prev) => [...placeholders, ...prev]);

    for (let i = 0; i < count; i++) {
      const ph = placeholders[i];
      try {
        const body: Record<string, unknown> = {
          mode:        "image",
          provider:    routing.provider,
          prompt,
          quality:     apiQuality,
          aspectRatio: apiAr,
        };
        if (nbVariant)                                body.metadata = { nbVariant };
        if (currentModel.requiresImg && editImageUrl) body.imageUrl = editImageUrl;

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(user.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {}),
          },
          body: JSON.stringify(body),
        });

        if (res.status === 402) {
          const errData = await res.json();
          const needed = errData.data?.required ?? "?";
          const have   = errData.data?.available ?? "?";
          throw new Error(`Not enough credits — need ${needed}, you have ${have}`);
        }

        const data = await res.json();
        if (!res.ok || !data.data?.url) throw new Error(data.error ?? "Generation failed");

        setImages((prev) =>
          prev.map((img) =>
            img.id === ph.id ? { ...img, url: data.data.url as string, status: "done" } : img
          )
        );
      } catch (err) {
        setImages((prev) =>
          prev.map((img) =>
            img.id === ph.id
              ? { ...img, status: "error", error: err instanceof Error ? err.message : "Failed" }
              : img
          )
        );
      }
    }

    // Refresh credit balance so the pill reflects the new total
    await refreshUser();
  }, [prompt, user, refreshUser, currentModel, aspectRatio, quality, batchSize, model, editImageUrl]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
  };

  const hasImages = images.length > 0;

  // ── Styles ──────────────────────────────────────────────────────────────────
  const ctrlBtn = (active?: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 6,
    padding: "6px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500,
    cursor: "pointer", border: "none",
    background: active ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)",
    color: active ? "#fff" : "rgba(255,255,255,0.75)",
    transition: "all 0.15s", whiteSpace: "nowrap" as const, position: "relative" as const,
  });

  const ddItem = (selected?: boolean, disabled?: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 10px", borderRadius: 8, width: "100%", textAlign: "left" as const,
    cursor: disabled ? "not-allowed" : "pointer", border: "none",
    background: selected ? "rgba(255,255,255,0.1)" : "transparent",
    opacity: disabled ? 0.5 : 1, transition: "background 0.1s",
  });

  return (
    <div style={{
      position: "fixed", top: 64, left: 0, right: 0, bottom: 0, zIndex: 40,
      background: "#0A0A0A",
      display: "flex", flexDirection: "column",
      fontFamily: "var(--font-body, system-ui, sans-serif)",
      color: "#fff",
      overflow: "hidden",
    }}>
      {/* ── TOP BAR ───────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 58, minHeight: 58,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(10,10,10,0.95)", backdropFilter: "blur(16px)",
        zIndex: 10,
      }}>
        {/* Left: tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>

          {/* History / Community tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["history", "community"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 9, fontSize: 13, fontWeight: 500,
                  cursor: "pointer", border: "none",
                  background: activeTab === tab ? "rgba(255,255,255,0.12)" : "transparent",
                  color: activeTab === tab ? "#fff" : "rgba(255,255,255,0.4)",
                  transition: "all 0.15s",
                }}
              >
                {tab === "history" ? "📁" : "🌐"}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Zoom slider + credits + user */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Zoom control with % display */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setZoomLevel(Math.max(1, zoomLevel - 1))}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 16, lineHeight: 1, padding: "2px 4px", borderRadius: 4, transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
              title="Zoom out"
            >−</button>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={zoomLevel}
                onChange={(e) => setZoomLevel(Number(e.target.value))}
                style={{
                  width: 90, height: 4, appearance: "none", borderRadius: 4,
                  background: `linear-gradient(to right, #2563EB ${(zoomLevel - 1) * 25}%, rgba(255,255,255,0.15) ${(zoomLevel - 1) * 25}%)`,
                  cursor: "pointer", outline: "none", border: "none",
                }}
              />
              <span style={{
                fontSize: 11, fontWeight: 600, minWidth: 32, textAlign: "center",
                color: "#60A5FA", letterSpacing: "0.02em",
              }}>
                {zoomLevel * 20}%
              </span>
            </div>
            <button
              onClick={() => setZoomLevel(Math.min(5, zoomLevel + 1))}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 16, lineHeight: 1, padding: "2px 4px", borderRadius: 4, transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
              title="Zoom in"
            >+</button>
          </div>

          {/* Credits pill — live balance, refreshed after each generation */}
          {user && (
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 20,
              background: "rgba(37,99,235,0.15)",
              border: "1px solid rgba(37,99,235,0.3)",
              fontSize: 12, fontWeight: 600, color: "#60A5FA",
              whiteSpace: "nowrap",
            }}>
              ⚡ {user.credits}
            </div>
          )}

          {/* User avatar / login */}
          {user ? (
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "linear-gradient(135deg, #2563EB, #0EA5A0)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff", cursor: "pointer", flexShrink: 0,
            }}>
              {user.name?.charAt(0).toUpperCase() ?? "Z"}
            </div>
          ) : (
            <button onClick={() => setAuthModal(true)} style={{
              padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: "linear-gradient(135deg, #2563EB, #7C3AED)",
              color: "#fff", border: "none", cursor: "pointer",
            }}>
              Login
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN CANVAS ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: hasImages ? "24px 24px 200px" : "0" }}>
        {!hasImages ? (
          /* Empty state — premium, spacious */
          <div style={{
            height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 16,
            minHeight: "calc(100vh - 58px - 160px)",
            padding: "40px 24px",
          }}>
            {/* Icon */}
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: "linear-gradient(135deg, rgba(37,99,235,0.2), rgba(14,165,160,0.15))",
              border: "1px solid rgba(37,99,235,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30,
              boxShadow: "0 0 40px rgba(37,99,235,0.15)",
            }}>🎨</div>

            {/* Heading */}
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.88)", letterSpacing: "-0.01em", marginBottom: 8 }}>
                Describe what you want to create
              </p>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", maxWidth: 400, lineHeight: 1.6 }}>
                Your generated images will appear here. Type a prompt below and hit Generate — or choose a suggestion to get started.
              </p>
            </div>

            {/* Quick prompts */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 4, maxWidth: 560 }}>
              {[
                "Cinematic portrait in golden hour light",
                "Futuristic city at night, neon reflections",
                "Abstract liquid chrome, iridescent colors",
                "Lone figure on a cliff overlooking a stormy sea",
                "A cyberpunk street market at dusk",
              ].map((p) => (
                <button
                  key={p}
                  onClick={() => { setPrompt(p); promptRef.current?.focus(); }}
                  style={{
                    padding: "8px 16px", borderRadius: 24, fontSize: 12, fontWeight: 500,
                    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.6)", cursor: "pointer", transition: "all 0.15s",
                    letterSpacing: "0.01em",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.15)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.35)";
                    (e.currentTarget as HTMLElement).style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
                    (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)";
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Image grid */
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${gridMinSize}px, 1fr))`,
            gap: 8,
            transition: "grid-template-columns 0.3s ease",
          }}>
            {images.map((img) => (
              <ImageCard
                key={img.id}
                img={img}
                onRegenerate={(_prompt, _model, _ar) => {
                  // Re-trigger generate with same params
                  generate();
                }}
                onReusePrompt={(p) => {
                  setPrompt(p);
                  promptRef.current?.focus();
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── BOTTOM PROMPT BAR ─────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: 16, left: 0, right: 0,
        padding: "0 20px",
        zIndex: 50,
        pointerEvents: "none",
      }}>
        <div style={{
          maxWidth: 960, margin: "0 auto",
          background: "rgba(12,12,18,0.97)", backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 20,
          boxShadow: "0 8px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
          overflow: "visible",
          pointerEvents: "all",
        }}>
          {/* Prompt row */}
          <div style={{ display: "flex", alignItems: "flex-start", padding: "14px 16px 0" }}>
            {/* Add reference button */}
            <button style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0, marginTop: 2,
              background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.55)", cursor: "pointer", fontSize: 20,
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.15)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.3)"; (e.currentTarget as HTMLElement).style.color = "#60A5FA"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"; }}
            title="Add reference image">
              +
            </button>

            {/* Prompt textarea */}
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder="Describe the scene you imagine…"
              rows={1}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "#fff", fontSize: 15, lineHeight: 1.6, resize: "none",
                padding: "6px 14px", fontFamily: "var(--font-body, system-ui)",
                minHeight: 36, maxHeight: 140, boxSizing: "border-box",
              }}
            />
          </div>

          {/* Controls row */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "10px 14px 14px", flexWrap: "wrap",
          }}>
            {/* Model selector */}
            <div data-dd style={{ position: "relative" }}>
              <button
                onClick={() => { closeDropdowns(); setShowModelPicker((v) => !v); setModelSearch(""); }}
                style={{ ...ctrlBtn(showModelPicker), gap: 7 }}
              >
                <ModelIcon type={currentModel.icon} size={16} />
                {currentModel.name}
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>›</span>
              </button>

              {showModelPicker && (
                <div style={{
                  position: "absolute", bottom: "calc(100% + 8px)", left: 0,
                  background: "#141414", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 14, padding: 8, zIndex: 200, width: 320,
                  boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
                }}>
                  {/* Search */}
                  <div style={{ padding: "4px 6px 8px" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      background: "rgba(255,255,255,0.07)", borderRadius: 9, padding: "7px 10px",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>🔍</span>
                      <input
                        autoFocus
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder="Search..."
                        style={{
                          background: "transparent", border: "none", outline: "none",
                          color: "#fff", fontSize: 13, flex: 1,
                          fontFamily: "var(--font-body, system-ui)",
                        }}
                      />
                    </div>
                  </div>

                  <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px 6px" }}>
                    ✦ Featured models
                  </p>

                  {filteredModels.map((m) => (
                    <button
                      key={m.id}
                      disabled={!m.available}
                      onClick={() => { if (m.available) { setModel(m.id); closeDropdowns(); } }}
                      style={{ ...ddItem(model === m.id, !m.available) }}
                      onMouseEnter={(e) => { if (m.available) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = model === m.id ? "rgba(255,255,255,0.1)" : "transparent"; }}
                    >
                      <ModelIcon type={m.icon} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{m.name}</span>
                          {m.badge && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                              background: m.badgeColor ?? "#374151", color: "#fff", letterSpacing: "0.05em",
                            }}>
                              {m.badge}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.description}
                        </div>
                      </div>
                      {model === m.id && <span style={{ color: "#60A5FA", fontSize: 14 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Aspect Ratio */}
            <div data-dd style={{ position: "relative" }}>
              <button onClick={() => { closeDropdowns(); setShowArPicker((v) => !v); }} style={ctrlBtn(showArPicker)}>
                <ARIcon ar={aspectRatio} size={14} />
                {aspectRatio}
              </button>

              {showArPicker && (
                <div style={{
                  position: "absolute", bottom: "calc(100% + 8px)", left: 0,
                  background: "#141414", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 14, padding: 8, zIndex: 200, minWidth: 200,
                  boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
                }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px 8px" }}>
                    Aspect ratio
                  </p>
                  {ASPECT_RATIOS.map((ar) => (
                    <button
                      key={ar}
                      onClick={() => { setAspectRatio(ar); closeDropdowns(); }}
                      style={{ ...ddItem(aspectRatio === ar) }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = aspectRatio === ar ? "rgba(255,255,255,0.1)" : "transparent"; }}
                    >
                      <ARIcon ar={ar} size={16} selected={aspectRatio === ar} />
                      <span style={{ fontSize: 13, color: "#fff" }}>{ar}</span>
                      {aspectRatio === ar && <span style={{ marginLeft: "auto", color: "#60A5FA", fontSize: 13 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quality — hidden for fixed-quality models */}
            {(currentModel.allowedQualities?.length ?? 0) > 1 && (
              <div data-dd style={{ position: "relative" }}>
                <button onClick={() => { closeDropdowns(); setShowQualityPicker((v) => !v); }} style={ctrlBtn(showQualityPicker)}>
                  ♡ {quality}
                </button>

                {showQualityPicker && (
                  <div style={{
                    position: "absolute", bottom: "calc(100% + 8px)", left: 0,
                    background: "#141414", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 14, padding: 8, zIndex: 200, minWidth: 180,
                    boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px 8px" }}>
                      Select quality
                    </p>
                    {([
                      { label: "1K" as Quality, desc: "Standard · Fast" },
                      { label: "2K" as Quality, desc: "HD · Better detail" },
                      { label: "4K" as Quality, desc: "Ultra HD · Pro only" },
                    ] as { label: Quality; desc: string }[])
                      .filter(({ label }) => currentModel.allowedQualities?.includes(label))
                      .map(({ label, desc }) => (
                        <button
                          key={label}
                          onClick={() => { setQuality(label); closeDropdowns(); }}
                          style={{ ...ddItem(quality === label) }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = quality === label ? "rgba(255,255,255,0.1)" : "transparent"; }}
                        >
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13, color: "#fff" }}>{label}</span>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{desc}</div>
                          </div>
                          {quality === label && <span style={{ color: "#60A5FA", fontSize: 13 }}>✓</span>}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Edit image input — shown when model requires a source image */}
            {currentModel.requiresImg && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (editImageUrl.startsWith("blob:")) URL.revokeObjectURL(editImageUrl);
                      setEditImageUrl(URL.createObjectURL(file));
                    }
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    ...ctrlBtn(!!editImageUrl),
                    border: editImageUrl ? "1px solid rgba(245,158,11,0.5)" : "1px solid transparent",
                    maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                  title={editImageUrl ? "Change source image" : "Upload source image"}
                >
                  {editImageUrl ? "📎 Image set" : "📎 Upload image"}
                </button>
              </>
            )}

            {/* Batch size */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={() => setBatchSize((v) => Math.max(1, v - 1))}
                style={{
                  width: 26, height: 26, borderRadius: 7, border: "none",
                  background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)",
                  cursor: batchSize > 1 ? "pointer" : "not-allowed", fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600,
                  opacity: batchSize <= 1 ? 0.4 : 1,
                }}
              >−</button>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", minWidth: 28, textAlign: "center", fontWeight: 500 }}>
                {batchSize}/4
              </span>
              <button
                onClick={() => setBatchSize((v) => Math.min(4, v + 1))}
                style={{
                  width: 26, height: 26, borderRadius: 7, border: "none",
                  background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)",
                  cursor: batchSize < 4 ? "pointer" : "not-allowed", fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600,
                  opacity: batchSize >= 4 ? 0.4 : 1,
                }}
              >+</button>
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Cmd+Enter hint */}
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", gap: 4 }}>
              <kbd style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.25)", background: "transparent" }}>⌘</kbd>
              <kbd style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.25)", background: "transparent" }}>↵</kbd>
            </span>

            {/* Generate button */}
            <button
              onClick={generate}
              disabled={!prompt.trim() || !currentModel.available || (currentModel.requiresImg && !editImageUrl)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "11px 26px", borderRadius: 13, fontSize: 14, fontWeight: 700,
                border: "none",
                cursor: (!prompt.trim() || !currentModel.available || (currentModel.requiresImg && !editImageUrl))
                  ? "not-allowed" : "pointer",
                background: (!prompt.trim() || !currentModel.available || (currentModel.requiresImg && !editImageUrl))
                  ? "rgba(255,255,255,0.07)"
                  : "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
                color: (!prompt.trim() || !currentModel.available || (currentModel.requiresImg && !editImageUrl))
                  ? "rgba(255,255,255,0.2)" : "#fff",
                transition: "all 0.2s", letterSpacing: "0.02em",
                boxShadow: (!prompt.trim() || !currentModel.available || (currentModel.requiresImg && !editImageUrl))
                  ? "none" : "0 0 28px rgba(37,99,235,0.45), 0 4px 16px rgba(0,0,0,0.4)",
                minWidth: 140,
              }}
              onMouseEnter={e => { if (prompt.trim() && currentModel.available) { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 45px rgba(37,99,235,0.65), 0 4px 20px rgba(0,0,0,0.5)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = prompt.trim() && currentModel.available ? "0 0 28px rgba(37,99,235,0.45), 0 4px 16px rgba(0,0,0,0.4)" : "none"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
            >
              ⚡ Generate
              {currentModel.available && (
                <span style={{
                  fontSize: 11, fontWeight: 600, opacity: 0.8,
                  background: "rgba(0,0,0,0.25)", padding: "2px 7px", borderRadius: 6,
                }}>
                  ✦ {computeCredits(model, quality, MODEL_TO_PROVIDER[model]?.provider === "nano-banana" ? 1 : Math.min(batchSize, 4))} cr
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Notices */}
        {!currentModel.available && (
          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,165,0,0.7)", marginTop: 8 }}>
            {currentModel.name} is coming soon — try DALL·E 3 or Nano Banana
          </p>
        )}
        {currentModel.requiresImg && !editImageUrl && (
          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(245,158,11,0.8)", marginTop: 8 }}>
            Upload a source image to use {currentModel.name}
          </p>
        )}
      </div>

      {/* Auth modal */}
      {authModal && <AuthModal defaultTab="login" onClose={() => setAuthModal(false)} />}

      <style>{`
        input[type=range]::-webkit-slider-thumb {
          appearance: none;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
          box-shadow: 0 0 6px rgba(37,99,235,0.5);
        }
        input[type=range]::-moz-range-thumb {
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
          border: none;
        }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function ImageStudioPage() {
  return (
    <Suspense fallback={
      <div style={{ position: "fixed", top: 64, left: 0, right: 0, bottom: 0, background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.06)", borderTop: "3px solid #2563EB", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to{transform:rotate(360deg)} }`}</style>
      </div>
    }>
      <ImageStudioInner />
    </Suspense>
  );
}
