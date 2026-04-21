"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import MediaCard from "@/components/media/MediaCard";
import type { PublicAsset } from "@/lib/types/generation";
import { useFlowStore } from "@/lib/flow/store";
import type { FlowStep } from "@/lib/flow/store";
import { createWorkflow, addWorkflowStep } from "@/lib/flow/actions";
import FlowBar from "@/components/studio/flow/FlowBar";
import NextStepPanel from "@/components/studio/flow/NextStepPanel";

// ─────────────────────────────────────────────────────────────────────────────
// ZENCRA STUDIO — Image Generation
// Inspired by Higgsfield AI's generation workspace
// DALL-E 3 connected | Nano Banana / Playground — coming soon
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────
interface GeneratedImage {
  id: string;
  /** DB asset UUID — present for history-loaded rows and async generations once assetId is known */
  assetId?: string;
  url: string | null;
  prompt: string;
  model: string;
  aspectRatio: string;
  status: "generating" | "done" | "error";
  error?: string;
}

// ── Provider error classifier ─────────────────────────────────────────────────
// Never surfaces raw provider strings — always maps to user-safe copy.
interface ErrorInfo {
  title:  string;
  detail: string;
  icon:   string;
}

function classifyError(raw: string | undefined): ErrorInfo {
  const lower = (raw ?? "").toLowerCase();

  // Policy / safety block
  if (
    lower.includes("prohibited use policy") ||
    lower.includes("safety policy") ||
    lower.includes("violat") ||
    lower.includes("filtered out") ||
    lower.includes("no images found in ai response") ||
    lower.includes("blocked by provider")
  ) {
    return {
      icon:   "🚫",
      title:  "Generation blocked",
      detail: "This request was filtered by the provider's safety policy. Try a different prompt.",
    };
  }

  // Credit / quota exhausted
  if (lower.includes("credit") || lower.includes("quota") || lower.includes("not enough")) {
    return {
      icon:   "⚡",
      title:  "Not enough credits",
      detail: "You don't have enough credits for this generation.",
    };
  }

  // Timeout / too slow
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("taking longer")) {
    return {
      icon:   "⏱",
      title:  "Generation timed out",
      detail: "The provider took too long to respond. Your image may still be processing — check back later.",
    };
  }

  // Job record lost
  if (lower.includes("job record not found") || lower.includes("generation was lost")) {
    return {
      icon:   "🔍",
      title:  "Job not found",
      detail: "The generation record was lost. Please try again.",
    };
  }

  // Generic fallback — no raw text exposed
  return {
    icon:   "⚠️",
    title:  "Generation failed",
    detail: "Something went wrong. Please try again.",
  };
}

type AspectRatio = "Auto" | "1:1" | "3:4" | "4:3" | "2:3" | "3:2" | "9:16" | "16:9" | "5:4" | "4:5" | "21:9" | "1:4" | "1:8" | "4:1" | "8:1";
type Quality = "1K" | "2K" | "4K";
type OutputFormat = "JPG" | "PNG";
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

// ── Provider routing — maps UI model IDs → /api/studio/image/generate modelKeys ──────────
const MODEL_TO_KEY: Record<string, string> = {
  "dalle3":               "gpt-image-1",
  "nano-banana-standard": "nano-banana-standard",
  "nano-banana-pro":      "nano-banana-pro",
  "nano-banana-2":        "nano-banana-2",
};

// ── Reverse map — model key → UI model ID (used by flow variation handler) ───
const KEY_TO_MODEL: Record<string, string> = Object.fromEntries(
  Object.entries(MODEL_TO_KEY).map(([uiId, key]) => [key, uiId])
);

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
// GPT Image only supports 4 ratios — collapse everything else.
function mapArForGpt(ar: AspectRatio): "1:1" | "16:9" | "9:16" | "4:5" {
  const landscape = ["16:9", "3:2", "4:3", "21:9", "5:4", "4:1", "8:1"];
  const portrait  = ["9:16", "2:3", "3:4", "1:4", "1:8"];
  if (landscape.includes(ar)) return "16:9";
  if (portrait.includes(ar))  return "9:16";
  if (ar === "4:5")            return "4:5";
  return "1:1";
}

// ── Per-model AR lists ────────────────────────────────────────────────────────
// Hard-locked to playground-confirmed behaviour.
// Keep in sync with NB_SUPPORTED_ASPECT_RATIOS / NB2_SUPPORTED_ASPECT_RATIOS in nano-banana.ts.

/** NB Standard + Pro: exactly 7 options, no Auto. */
const NB_STANDARD_PRO_AR: AspectRatio[] = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4"];

/** NB2: 7 options including Auto (Auto → no AR sent → NB2 server default). */
const NB2_AR: AspectRatio[] = ["Auto", "1:1", "4:5", "5:4", "9:16", "16:9", "8:1"];

/** GPT Image: collapsed internally by mapArForGpt — show 4 meaningful options. */
const DALLE_AR: AspectRatio[] = ["1:1", "16:9", "9:16", "4:5"];

// Nano Banana Standard/Pro: pass the selected AR string verbatim.
// "Auto" maps to undefined (omit from payload — let NB decide).
const NB_AR_PASSTHROUGH = new Set<AspectRatio>(NB_STANDARD_PRO_AR);
function mapArForNB(ar: AspectRatio): string | undefined {
  if (ar === "Auto") return undefined;
  return NB_AR_PASSTHROUGH.has(ar) ? ar : undefined;
}

// NB2 UI fallback hints — any currently-selected AR not in the NB2 list
// will be shown with a badge so the user understands what will actually be sent.
// Keep in sync with NB2_AR_FALLBACK in nano-banana.ts.
const NB2_AR_FALLBACK_UI: Record<string, string> = {
  "2:3":  "1:1",
  "3:2":  "1:1",
  "3:4":  "1:1",
  "4:3":  "1:1",
  "21:9": "1:1",
  "1:4":  "1:1",
  "1:8":  "1:1",
  "4:1":  "1:1",
};

/** Legacy wrapper — used only for GPT Image */
function mapArToApiAr(ar: AspectRatio): "1:1" | "16:9" | "9:16" | "4:5" {
  return mapArForGpt(ar);
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
  // nano-banana-edit removed — no backend registry entry exists in new provider system
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    provider: "NanoBanana",
    description: "High-resolution output · 1K · 2K · 4K · multi-reference",
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
    description: "Next-gen model · improved quality · multi-reference",
    badge: "NEW",
    badgeColor: "#0E7490",
    available: true,
    icon: "nanobana",
    nbVariant: "nb2",
    allowedQualities: ["1K", "2K", "4K"],
  },
];

// ASPECT_RATIOS is now model-specific — see NB_STANDARD_PRO_AR / NB2_AR / DALLE_AR above.
// This alias is kept only for GeneratingPlaceholder's ratioMap (all possible values).
const ASPECT_RATIOS: AspectRatio[] = [
  "Auto", "1:1", "3:4", "4:3", "2:3", "3:2",
  "9:16", "16:9", "5:4", "4:5", "21:9",
  "1:4", "1:8", "4:1", "8:1",
];

// ── AR icon ───────────────────────────────────────────────────────────────────
function ARIcon({ ar, size = 16, selected = false }: { ar: AspectRatio; size?: number; selected?: boolean }) {
  const map: Record<string, { w: number; h: number }> = {
    Auto: { w: 1, h: 1 }, "1:1": { w: 1, h: 1 }, "3:4": { w: 3, h: 4 },
    "4:3": { w: 4, h: 3 }, "2:3": { w: 2, h: 3 }, "3:2": { w: 3, h: 2 },
    "9:16": { w: 9, h: 16 }, "16:9": { w: 16, h: 9 }, "5:4": { w: 5, h: 4 },
    "4:5": { w: 4, h: 5 }, "21:9": { w: 21, h: 9 },
    "1:4": { w: 1, h: 4 }, "1:8": { w: 1, h: 8 },
    "4:1": { w: 4, h: 1 }, "8:1": { w: 8, h: 1 },
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
    "1:4": 4, "1:8": 8, "4:1": 1 / 4, "8:1": 1 / 8,
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

// ── Skeleton card (history loading) ──────────────────────────────────────────
// Masonry-aware shimmer: cycles through common aspect ratios so the grid
// looks like a real gallery in the loading state, not a column of lines.
const SKELETON_RATIOS = [
  "3:4", "1:1", "4:3", "2:3", "9:16", "3:4", "16:9", "1:1", "2:3", "4:5",
  "3:4", "1:1", "3:2", "4:3", "1:1",
];

function SkeletonCard({ index }: { index: number }) {
  const ratioMap: Record<string, number> = {
    "1:1": 1, "3:4": 4/3, "4:3": 3/4, "2:3": 3/2, "3:2": 2/3,
    "9:16": 16/9, "16:9": 9/16, "4:5": 5/4,
  };
  const ar = SKELETON_RATIOS[index % SKELETON_RATIOS.length];
  const paddingBottom = `${(ratioMap[ar] ?? 1) * 100}%`;
  // Stagger capped at card 20 — beyond that all appear together
  const delay = `${Math.min(index, 20) * 40}ms`;

  return (
    <div style={{
      position: "relative", width: "100%", paddingBottom,
      borderRadius: 10,   // matches image card border-radius
      overflow: "hidden",
      opacity: 0,
      animation: `fadeIn 0.4s ease ${delay} forwards`,
    }}>
      {/* Base layer — very faint white tint matching spec */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(255,255,255,0.03)",
        borderRadius: 10,
      }} />
      {/* Shimmer sweep overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.045) 50%, transparent 75%)",
        backgroundSize: "200% 100%",
        animation: `skeletonSweep 2.2s ease-in-out ${Math.min(index, 20) * 60}ms infinite`,
        borderRadius: 10,
        // Soft blur makes the card feel like frosted glass rather than a hard box
        filter: "blur(4px)",
      }} />
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
  onOpen,
  onDelete,
  onEnhance,
  hideHoverActions = false,
}: {
  img: GeneratedImage;
  onRegenerate?: (prompt: string, model: string, ar: string) => void;
  onReusePrompt?: (prompt: string) => void;
  onOpen?: () => void;
  onDelete?: (id: string, assetId?: string) => void;
  onEnhance?: () => void;
  hideHoverActions?: boolean;
}) {
  const router = useRouter();
  if (img.status === "generating") {
    return <GeneratingPlaceholder ar={img.aspectRatio as AspectRatio} />;
  }

  if (img.status === "error") {
    const { icon, title, detail } = classifyError(img.error);
    return (
      <div style={{
        width: "100%", paddingBottom: "100%", borderRadius: 10, position: "relative",
        background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 8, padding: "20px 16px",
        }}>
          <span style={{ fontSize: 24, lineHeight: 1 }}>{icon}</span>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.75)", margin: 0, marginBottom: 4 }}>
              {title}
            </p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", margin: 0, lineHeight: 1.5 }}>
              {detail}
            </p>
          </div>
          {/* Action row */}
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {img.prompt && (
              <button
                onClick={() => onReusePrompt?.(img.prompt)}
                style={{
                  fontSize: 9, fontWeight: 700, padding: "4px 9px", borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.5)", cursor: "pointer", letterSpacing: "0.03em", textTransform: "uppercase" as const,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"; }}
              >
                Retry
              </button>
            )}
            <button
              onClick={() => onDelete?.(img.id, img.assetId)}
              style={{
                fontSize: 9, fontWeight: 700, padding: "4px 9px", borderRadius: 6,
                border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)",
                color: "rgba(239,68,68,0.6)", cursor: "pointer", letterSpacing: "0.03em", textTransform: "uppercase" as const,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.18)"; (e.currentTarget as HTMLElement).style.color = "#F87171"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(239,68,68,0.6)"; }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Done — render full MediaCard with owner actions
  // Wrapper onClick: always selects card for right panel;
  // opens fullscreen only when the click target is not an action button.
  return (
    <div
      style={{ animation: "fadeIn 0.3s ease" }}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button")) {
          onOpen?.();
        }
      }}
    >
      <MediaCard
        asset={toPublicAsset(img)}
        isOwner
        aspectRatio={img.aspectRatio !== "Auto" ? img.aspectRatio : undefined}
        hideHoverActions={hideHoverActions}
        onRegenerate={() => onRegenerate?.(img.prompt, img.model, img.aspectRatio)}
        onReusePrompt={onReusePrompt}
        onEnhance={onEnhance ? () => onEnhance() : undefined}
        onAnimate={() => {
          // Animate → Video Studio, image pre-loaded into Start Frame, Kling 3.0 pre-selected
          // "kling-30" is the VIDEO_MODEL_REGISTRY catalog ID for Kling 3.0 Omni
          // router.push = soft navigation; preserves Zustand FlowStore workflow ID
          const params = new URLSearchParams({ model: "kling-30", from: "image-studio" });
          if (img.url) params.set("imageUrl", img.url);
          if (img.prompt) params.set("prompt", img.prompt);
          router.push(`/studio/video?${params.toString()}`);
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER PAGE
// ─────────────────────────────────────────────────────────────────────────────
function ImageStudioInner() {
  const { user, session, refreshUser } = useAuth();
  const searchParams = useSearchParams();

  // ── Creative Flow store ──────────────────────────────────────────────────────
  const flowStore = useFlowStore();

  // ── Record a completed generation into the flow (fire-and-forget) ────────────
  const recordFlowStep = useCallback(async (params: {
    studioType: "image";
    modelKey:   string;
    prompt:     string;
    resultUrl:  string;
    assetId?:   string;
    aspectRatio?: string;
  }) => {
    if (!user) return;

    // ── Push provisional step immediately ────────────────────────────────────
    // Panel visibility must never depend on DB latency or failure.
    // We push a local step right now so the NextStepPanel slides in instantly.
    // The provisional ID is replaced with the real DB ID after the write below.
    const provisionalId = `provisional-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const provisionalStep: FlowStep = {
      id:           provisionalId,
      stepNumber:   useFlowStore.getState().steps.length + 1,
      studioType:   params.studioType,
      modelKey:     params.modelKey,
      prompt:       params.prompt,
      resultUrl:    params.resultUrl,
      thumbnailUrl: params.resultUrl,
      status:       "success",
      createdAt:    new Date().toISOString(),
    };
    flowStore.pushStep(provisionalStep);

    // ── Persist to DB in background (non-critical) ───────────────────────────
    try {
      let wfId = useFlowStore.getState().workflowId;
      if (!wfId) {
        const wfResult = await createWorkflow(user.id);
        if (!wfResult.ok) return; // DB failed — panel is already showing
        wfId = wfResult.workflowId;
        flowStore.initWorkflow(wfId);
      }
      const stepResult = await addWorkflowStep({
        workflowId:  wfId,
        userId:      user.id,
        studioType:  params.studioType,
        modelKey:    params.modelKey,
        prompt:      params.prompt,
        aspectRatio: params.aspectRatio,
        resultUrl:   params.resultUrl,
        status:      "success",
        assetId:     params.assetId,
      });
      if (stepResult.ok) {
        // Upgrade the provisional step in-place with the real DB-backed step
        // (real ID + real step_number). updateStep patches by provisional ID
        // and replaces all fields including id, so subsequent pushStep dedup
        // checks against the real ID work correctly.
        flowStore.updateStep(provisionalId, stepResult.step);
      }
    } catch {
      // Flow recording is non-critical — provisional step keeps the panel alive
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Map catalog IDs (from navbar ?model= param) to internal studio model IDs
  const CATALOG_TO_STUDIO_MODEL: Record<string, string> = {
    "gpt-image-15":    "dalle3",
    "nano-banana":     "nano-banana-standard",
    "nano-banana-pro": "nano-banana-pro",
    "nano-banana-2":   "nano-banana-2",
  };
  const modelParam = searchParams.get("model") ?? "";
  const initialModel = CATALOG_TO_STUDIO_MODEL[modelParam] ?? "dalle3";

  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [prompt, setPrompt] = useState(searchParams.get("prompt") ?? "");
  const [model, setModel] = useState(initialModel);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [quality, setQuality] = useState<Quality>("1K");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("JPG");
  const [batchSize, setBatchSize] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(3); // 1-5
  const [activeTab, setActiveTab] = useState<Tab>("history");
  const [authModal, setAuthModal] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState("");   // source image for edit models

  // ── Prompt enhancement ───────────────────────────────────────────────────────
  const [enhancing, setEnhancing] = useState(false);
  const [preEnhancePrompt, setPreEnhancePrompt] = useState<string | null>(null);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  // ── Fullscreen viewer ────────────────────────────────────────────────────────
  const [viewingImage, setViewingImage] = useState<GeneratedImage | null>(null);

  // ── History error ─────────────────────────────────────────────────────────────
  const [historyError, setHistoryError] = useState(false);

  // ── Toast ─────────────────────────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  // ── Zoom hint — one-shot tip shown when user zooms below threshold ─────────────
  // "More actions available when zoomed in" fades in then auto-hides after 2.5s.
  const [zoomHint, setZoomHint] = useState(false);
  const zoomHintShownRef = useRef(false);      // track if we've shown it this session
  const ACTIONS_ZOOM_THRESHOLD = 3;            // levels 1–2 hide actions (< 60%)
  useEffect(() => {
    if (zoomLevel < ACTIONS_ZOOM_THRESHOLD) {
      // Show hint the first time user crosses into low-zoom territory
      if (!zoomHintShownRef.current) {
        zoomHintShownRef.current = true;
        setZoomHint(true);
        setTimeout(() => setZoomHint(false), 2500);
      }
    } else {
      // Reset so the hint can reappear if they zoom back in then out again later
      zoomHintShownRef.current = false;
    }
  }, [zoomLevel]);

  // Dropdowns
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showArPicker, setShowArPicker] = useState(false);
  const [showQualityPicker, setShowQualityPicker] = useState(false);
  const [modelSearch, setModelSearch] = useState("");

  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const [referenceImageUrl,      setReferenceImageUrl]      = useState<string>("");
  const [referencePreviewUrl,    setReferencePreviewUrl]    = useState<string>("");  // blob URL for <img>, not sent to backend
  const [referenceUploading,     setReferenceUploading]     = useState(false);
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

  // ── Load user's image history on mount (once auth is ready) ─────────────────
  useEffect(() => {
    if (!user || historyLoaded) return;

    // Use live session token — user.accessToken is a snapshot that goes stale
    // after a token refresh, causing 401s on this fetch.
    const accessToken = session?.access_token;

    (async () => {
      try {
        const res = await fetch("/api/generations/mine?category=image&pageSize=50", {
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
        });
        if (!res.ok) { setHistoryError(true); return; }

        const json = await res.json();
        if (!json.success || !Array.isArray(json.data)) { setHistoryError(true); return; }

        // Map DB rows → GeneratedImage.
        // Include failed rows (no URL) alongside completed ones.
        const loaded: GeneratedImage[] = (json.data as Array<{
          id: string;
          tool: string;
          prompt: string;
          status: string;
          result_url: string | null;
          error_message?: string | null;
          parameters?: { aspectRatio?: string } | null;
        }>)
          .filter((row) => row.status === "completed" || row.status === "failed")
          .map((row) => {
            const isFailed = row.status === "failed";
            return {
              id:          row.id,
              assetId:     row.id,   // history rows use the DB asset ID directly
              url:         row.result_url ?? null,
              prompt:      row.prompt ?? "",
              model:       row.tool ?? "nano-banana",
              aspectRatio: (row.parameters?.aspectRatio ?? "1:1") as AspectRatio,
              status:      (isFailed ? "error" : "done") as GeneratedImage["status"],
              error:       isFailed ? (row.error_message ?? undefined) : undefined,
            };
          });

        // Prepend loaded history behind any images already generated this session
        setImages((prev) => {
          const existingIds = new Set(prev.map((img) => img.id));
          const fresh = loaded.filter((img) => !existingIds.has(img.id));
          return [...prev, ...fresh];
        });
      } catch {
        setHistoryError(true);
      } finally {
        setHistoryLoaded(true);
      }
    })();
  }, [user, historyLoaded]);

  // When model changes: reset quality if not allowed, clear edit image if not needed,
  // and hard-reset aspect ratio if the current AR is not in the new model's supported list.
  useEffect(() => {
    const cm = MODELS.find((m) => m.id === model);
    if (!cm) return;
    if (cm.allowedQualities && !cm.allowedQualities.includes(quality)) {
      setQuality(cm.allowedQualities[0]);
    }
    if (!cm.requiresImg) setEditImageUrl("");
    if (cm.requiresImg) setBatchSize(1);  // edit models: 1 at a time

    // ── AR hard-lock per model ────────────────────────────────────────────────
    // Switching to NB2 → only 7 options; switching to NB Standard/Pro → only 7 options.
    // If the current AR is not in the target model's list, reset to 1:1.
    setAspectRatio((cur) => {
      if (model === "nano-banana-2") {
        return (NB2_AR as readonly string[]).includes(cur) ? cur : "1:1";
      }
      if (model.startsWith("nano-banana")) {
        return (NB_STANDARD_PRO_AR as readonly string[]).includes(cur) ? cur : "1:1";
      }
      // GPT Image — always pass through (mapArForGpt collapses internally)
      return cur;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  // ESC closes fullscreen viewer
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setViewingImage(null);
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const filteredModels = MODELS.filter(
    (m) => m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.provider.toLowerCase().includes(modelSearch.toLowerCase())
  );

  // ── Generate ───────────────────────────────────────────────────────────────
  const generate = useCallback(async (overrides?: { prompt?: string; model?: string; aspectRatio?: string }) => {
    const activePrompt = overrides?.prompt     ?? prompt;
    const activeModel  = overrides?.model      ?? model;
    const activeAr     = (overrides?.aspectRatio ?? aspectRatio) as AspectRatio;
    const activeCurrentModel = MODELS.find((m) => m.id === activeModel) ?? MODELS[0];

    if (!activePrompt.trim()) return;
    if (!user) { setAuthModal(true); return; }
    if (!activeCurrentModel.available) return;

    // Clear undo state — prompt is now intentionally submitted
    setPreEnhancePrompt(null);

    // No silent fallback — explicitly fail if this model ID has no backend mapping
    const modelKey = MODEL_TO_KEY[activeModel];
    if (!modelKey) {
      console.error(`[ImageStudio] No modelKey mapping for model ID: "${activeModel}". Generation aborted.`);
      return;
    }

    const isNanoB    = modelKey.startsWith("nano-banana");
    const isAsync    = isNanoB;   // NB = async polling; gpt-image-1 = sync
    const count      = isAsync ? 1 : Math.min(batchSize, 4);
    const apiQuality = quality === "2K" ? "high" : "auto";  // gpt-image-1 tiers
    // AR routing: NB gets actual string; GPT gets collapsed 4-ratio set
    const apiAr = isNanoB ? mapArForNB(activeAr) : mapArToApiAr(activeAr);

    console.log("[ImageStudio] dispatch", { modelKey, prompt: activePrompt, aspectRatio: apiAr });

    // Add placeholder(s) immediately so the grid shows shimmer
    const placeholders: GeneratedImage[] = Array.from({ length: count }, (_, i) => ({
      id: `gen-${Date.now()}-${i}`,
      url: null,
      prompt: activePrompt,
      model:  activeModel,
      aspectRatio: activeAr,
      status: "generating" as const,
    }));
    setImages((prev) => [...placeholders, ...prev]);

    for (let i = 0; i < count; i++) {
      const ph = placeholders[i];
      try {
        const body: Record<string, unknown> = {
          modelKey,
          prompt: activePrompt,
          ...(apiAr ? { aspectRatio: apiAr } : {}),
        };

        if (modelKey === "gpt-image-1") {
          // GPT Image: pass quality as providerParam; reference image as imageUrl
          body.providerParams = { quality: apiQuality };
          if (referenceImageUrl) body.imageUrl = referenceImageUrl;
        } else if (isNanoB) {
          // Nano Banana family: pass quality for resolution selection.
          // outputFormat (JPG/PNG) only sent for NB2 — standard and Pro use NB default.
          // googleSearch is backend-ready but NOT exposed from UI yet (Phase 1 lock).
          const nbParams: Record<string, unknown> = { quality };
          if (modelKey === "nano-banana-2") {
            nbParams.outputFormat = outputFormat;
          }
          if (referenceImageUrl) {
            // Single reference — passed as referenceUrls so provider builds imageUrls[] array
            nbParams.referenceUrls = [referenceImageUrl];
          }
          body.providerParams = nbParams;
        }

        const res = await fetch("/api/studio/image/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:  `Bearer ${session?.access_token ?? ""}`,
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
        // data.data?.error holds the real provider error; data.error is a top-level fallback
        if (!res.ok) throw new Error(data.data?.error ?? data.error ?? "Generation failed");

        // ── Synchronous success (DALL-E, etc.) ─────────────────────────────
        if (data.data?.url) {
          const syncAssetId = data.data.assetId as string | undefined;
          setImages((prev) =>
            prev.map((img) =>
              img.id === ph.id
                ? { ...img, url: data.data.url as string, status: "done", assetId: syncAssetId }
                : img
            )
          );
          void recordFlowStep({
            studioType:  "image",
            modelKey,
            prompt:      activePrompt,
            resultUrl:   data.data.url as string,
            assetId:     syncAssetId,
            aspectRatio: apiAr,
          });
          continue;
        }

        // ── Async / pending (Nano Banana) ──────────────────────────────────
        // The job was accepted; poll /api/studio/jobs/${jobId}/status until it resolves.
        if (data.data?.status === "pending") {
          // Safeguard: pending without a jobId must never silently hang
          if (!data.data?.jobId) {
            throw new Error("Generation accepted as pending but no jobId returned — cannot poll for result.");
          }
          const jobId     = data.data.jobId as string;
          // Store assetId from initial response so error cards can be deleted from DB
          const pendingAssetId = data.data.assetId as string | undefined;
          if (pendingAssetId) {
            setImages((prev) =>
              prev.map((img) => img.id === ph.id ? { ...img, assetId: pendingAssetId } : img)
            );
          }
          const authHeader = { Authorization: `Bearer ${session?.access_token ?? ""}` };

          const POLL_INTERVAL = 4_000;   // 4 s between polls
          const POLL_TIMEOUT  = 600_000; // give up after 10 min (NB can take 5–8 min on heavy load)
          const deadline      = Date.now() + POLL_TIMEOUT;

          let resolved        = false;
          let providerDone    = false; // provider said success but URL not yet captured
          let generationErr: Error | null = null;

          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, POLL_INTERVAL));

            try {
              const statusRes  = await fetch(
                `/api/studio/jobs/${jobId}/status`,
                { headers: { "Content-Type": "application/json", ...authHeader } }
              );
              const statusData = await statusRes.json();

              // 404 = asset row was never written (persistAsset silent failure) — terminal
              if (statusRes.status === 404) {
                generationErr = new Error("Job record not found — the generation was lost. Please try again.");
                break;
              }

              // Other non-transient errors — treat as terminal
              if (!statusRes.ok && statusRes.status !== 502 && statusRes.status !== 503) {
                generationErr = new Error(statusData.error ?? `Status check failed (${statusRes.status})`);
                break;
              }

              if (statusData.data?.status === "success") {
                providerDone = true;
                if (statusData.data?.url) {
                  const pollAssetId = statusData.data.assetId as string | undefined;
                  setImages((prev) =>
                    prev.map((img) =>
                      img.id === ph.id
                        ? { ...img, url: statusData.data.url as string, status: "done", assetId: pollAssetId ?? img.assetId }
                        : img
                    )
                  );
                  void recordFlowStep({
                    studioType:  "image",
                    modelKey,
                    prompt:      activePrompt,
                    resultUrl:   statusData.data.url as string,
                    assetId:     pollAssetId,
                    aspectRatio: apiAr,
                  });
                  resolved = true;
                  break;
                }
                // Provider returned success but URL is missing — keep polling (brief persistence lag)
                continue;
              }

              if (statusData.data?.status === "error") {
                // Terminal failure from provider — stop polling immediately
                generationErr = new Error(statusData.data?.error ?? "Generation failed");
                break;
              }
              // status === "pending" → keep polling
            } catch {
              // Transient network/parse error — silently retry until deadline
            }
          }

          if (generationErr) throw generationErr;
          if (!resolved) {
            if (providerDone) {
              // Provider completed but URL never arrived — likely a persistence lag
              throw new Error("Generation completed on the provider side but no image URL was returned. Please refresh the page to see your result.");
            }
            const isNB = modelKey.startsWith("nano-banana");
            throw new Error(
              isNB
                ? `Generation is taking longer than ${Math.round(POLL_TIMEOUT / 60_000)} minutes. Your image may still be processing — check back in a moment.`
                : "Generation timed out. The image may still be processing."
            );
          }
          continue;
        }

        // ── Unexpected: no url and not pending ─────────────────────────────
        throw new Error(data.data?.error ?? data.error ?? "Generation failed — no image returned");
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
  }, [prompt, user, refreshUser, currentModel, aspectRatio, quality, outputFormat, batchSize, model, editImageUrl, referenceImageUrl, recordFlowStep]);

  // ── Delete failed card ────────────────────────────────────────────────────────
  // Removes a failed card from local state and marks the DB asset as "deleted".
  // Only makes the DB call when an assetId is present (history-loaded rows and
  // async generations where the server already wrote the asset record).
  const handleDeleteCard = useCallback(async (localId: string, assetId?: string) => {
    // Optimistic UI — remove immediately
    setImages((prev) => prev.filter((img) => img.id !== localId));

    if (!assetId || !session?.access_token) return;

    try {
      await fetch(`/api/studio/assets/${assetId}/delete`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
    } catch {
      // Deletion failure is non-critical — the card is already gone from the UI
      console.warn("[ImageStudio] Failed to mark asset as deleted:", assetId);
    }
  }, [user]);

  // ── Variation handler — triggered by NextStepPanel "Create Variation" card ──
  const handleVariation = useCallback((step: FlowStep) => {
    // Restore the step's original settings then re-generate
    setPrompt(step.prompt);
    const uiModelId = KEY_TO_MODEL[step.modelKey];
    if (uiModelId) setModel(uiModelId);
    // generate() reads from state — call after micro-task so state has settled
    setTimeout(() => generate(), 0);
  }, [generate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
  };

  const hasImages = images.length > 0;

  // ── Prompt enhancement ────────────────────────────────────────────────────────
  const handleEnhance = useCallback(async () => {
    if (!prompt.trim() || enhancing) return;
    if (!user) { setAuthModal(true); return; }

    // Save original so the user can undo — also clears prior undo and error state
    setPreEnhancePrompt(prompt);
    setEnhanceError(null);
    setEnhancing(true);

    try {
      const res = await fetch("/api/studio/prompt/enhance", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          prompt,
          studioType: "image",
          modelHint:  model,
        }),
      });

      const json = await res.json() as { enhancedPrompt?: string; error?: string };

      if (res.ok && json.enhancedPrompt) {
        setPrompt(json.enhancedPrompt);
        setEnhanceError(null);
        // Resize textarea to fit new content
        if (promptRef.current) {
          promptRef.current.style.height = "auto";
          promptRef.current.style.height =
            Math.min(promptRef.current.scrollHeight, 140) + "px";
        }
      } else {
        // Use warn (not error) to avoid triggering the Next.js red dev overlay
        console.warn("[prompt-enhance] failed:", json.error);
        setPreEnhancePrompt(null);
        setEnhanceError("Enhancement failed — please try again");
      }
    } catch (err) {
      console.warn("[prompt-enhance] network error:", err);
      setPreEnhancePrompt(null);
      setEnhanceError("Network error — please check your connection");
    } finally {
      setEnhancing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, enhancing, user, model]);

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
    // Fragment wraps the gallery container + the global overlays.
    // FlowBar and NextStepPanel MUST be siblings of the gallery div, NOT children,
    // because the gallery div is position:fixed with overflow:hidden which creates
    // a stacking context — any position:fixed child inside it would have its
    // effective z-index capped at the parent's z-index (40), making it invisible
    // behind the navbar and other page-level elements.
    <>
    <div style={{
      position: "fixed", top: 64, left: 0, right: 0, bottom: 0, zIndex: 40,
      background: "#0A0A0A",
      display: "flex", flexDirection: "column",
      fontFamily: "var(--font-body, system-ui, sans-serif)",
      color: "#fff",
      overflow: "hidden",
    }}>
      {/* Global keyframes — shared by skeleton cards and image grid */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes skeletonSweep {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
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

        {/* Right: Zoom slider */}
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
        </div>
      </div>

      {/* ── MAIN CANVAS ───────────────────────────────────────────────────── */}
      {/* 3 states:
          1. user logged in + history loading → skeleton shimmer grid
          2. history loaded + no images       → empty state with quick prompts
          3. has images                       → masonry grid with progressive fade-in
      */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 100px" }}>

        {/* ── STATE 1: History loading — skeleton grid ─────────────────────── */}
        {user && !historyLoaded && images.length === 0 && (
          <div style={{ columns: `${gridMinSize}px`, columnGap: 8 }}>
            {SKELETON_RATIOS.map((_, i) => (
              <div key={i} style={{ breakInside: "avoid", marginBottom: 8 }}>
                <SkeletonCard index={i} />
              </div>
            ))}
          </div>
        )}

        {/* ── HISTORY ERROR: fetch failed — show retry prompt ──────────────── */}
        {historyError && historyLoaded && images.length === 0 && (
          <div style={{
            height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 12,
            minHeight: "calc(100vh - 58px - 100px)",
          }}>
            <span style={{ fontSize: 28 }}>⚠️</span>
            <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.7)", margin: 0 }}>
              Couldn&apos;t load your images
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
              A network error occurred while fetching your history.
            </p>
            <button
              onClick={() => { setHistoryError(false); setHistoryLoaded(false); }}
              style={{
                marginTop: 4, padding: "8px 20px", borderRadius: 10, fontSize: 12,
                fontWeight: 600, border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)",
                cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.2)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.4)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.14)";
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* ── STATE 2: Empty (logged in + history loaded, or logged out) ───── */}
        {(!user || historyLoaded) && images.length === 0 && !historyError && (
          <div style={{
            height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 16,
            minHeight: "calc(100vh - 58px - 100px)",
            padding: "40px 24px",
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: "linear-gradient(135deg, rgba(37,99,235,0.2), rgba(14,165,160,0.15))",
              border: "1px solid rgba(37,99,235,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30,
              boxShadow: "0 0 40px rgba(37,99,235,0.15)",
            }}>
              🎨
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.88)", letterSpacing: "-0.01em", marginBottom: 8 }}>
                Describe what you want to create
              </p>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", maxWidth: 400, lineHeight: 1.6 }}>
                Your generated images will appear here. Type a prompt below and hit Generate — or choose a suggestion to get started.
              </p>
            </div>
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
        )}

        {/* ── STATE 3: Masonry image grid — staggered fade-in ──────────────── */}
        {images.length > 0 && (
          <div style={{ columns: `${gridMinSize}px`, columnGap: 8 }}>
            {images.map((img, index) => (
              <div
                key={img.id}
                style={{
                  breakInside: "avoid", marginBottom: 8,
                  // Progressive reveal: each card fades in with a small stagger.
                  // Generating placeholders (shimmer) skip the delay so they appear instantly.
                  opacity: 0,
                  animation: `fadeIn 0.4s ease ${img.status === "generating" ? 0 : Math.min(index, 20) * 40}ms forwards`,
                }}
              >
                <ImageCard
                  img={img}
                  hideHoverActions={zoomLevel < ACTIONS_ZOOM_THRESHOLD}
                  onRegenerate={(p, m, ar) => generate({ prompt: p, model: m, aspectRatio: ar })}
                  onReusePrompt={(p) => {
                    setPrompt(p);
                    promptRef.current?.focus();
                  }}
                  onOpen={() => { if (img.status === "done") setViewingImage(img); }}
                  onDelete={handleDeleteCard}
                  onEnhance={() => showToast("✨ Topaz enhancement is coming soon")}
                />
              </div>
            ))}
          </div>
        )}
      </div>{/* end MAIN CANVAS */}

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
            {/* Hidden file input for reference image */}
            <input
              ref={referenceInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !user) return;
                e.target.value = "";

                // Show a local preview immediately while upload is in progress
                const blobPreview = URL.createObjectURL(file);
                setReferencePreviewUrl(blobPreview);
                setReferenceImageUrl("");        // clear any prior CDN URL
                setReferenceUploading(true);

                try {
                  const form = new FormData();
                  form.append("file", file);
                  const res = await fetch("/api/studio/upload-reference", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
                    body: form,
                  });
                  const json = await res.json();
                  if (res.ok && json.url) {
                    setReferenceImageUrl(json.url);   // real CDN URL — safe for backend
                  } else {
                    console.error("[ref upload] failed:", json.error);
                    // Clear preview on failure so user knows it didn't work
                    URL.revokeObjectURL(blobPreview);
                    setReferencePreviewUrl("");
                  }
                } catch (err) {
                  console.error("[ref upload] network error:", err);
                  URL.revokeObjectURL(blobPreview);
                  setReferencePreviewUrl("");
                } finally {
                  setReferenceUploading(false);
                }
              }}
            />
            {/* Reference image slot: uploading spinner → ready thumbnail → empty + button */}
            {referenceUploading ? (
              /* ── Uploading state: spinner overlay on the blob preview ── */
              <div style={{ position: "relative", flexShrink: 0, marginTop: 2, width: 36, height: 36 }}>
                {referencePreviewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={referencePreviewUrl}
                    alt="Uploading…"
                    style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover", opacity: 0.4 }}
                  />
                )}
                {/* Spinner ring */}
                <div style={{
                  position: "absolute", inset: 0, borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: referencePreviewUrl ? "transparent" : "rgba(37,99,235,0.15)",
                  border: "1px solid rgba(37,99,235,0.35)",
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    border: "2px solid rgba(96,165,250,0.25)",
                    borderTopColor: "#60A5FA",
                    animation: "spin 0.7s linear infinite",
                  }} />
                </div>
              </div>
            ) : referenceImageUrl ? (
              /* ── Ready: thumbnail with remove button ── */
              <div style={{ position: "relative", flexShrink: 0, marginTop: 2 }} title="Reference image ready — click to replace">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={referencePreviewUrl || referenceImageUrl}
                  alt="Reference"
                  onClick={() => referenceInputRef.current?.click()}
                  style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover", cursor: "pointer", border: "1px solid rgba(245,158,11,0.6)" }}
                />
                {/* Checkmark badge — confirms CDN URL is set */}
                <div style={{
                  position: "absolute", bottom: -4, right: -4,
                  width: 14, height: 14, borderRadius: "50%",
                  background: "rgba(34,197,94,0.9)", border: "1.5px solid rgba(0,0,0,0.6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 8, color: "#fff", lineHeight: 1, pointerEvents: "none",
                }}>✓</div>
                <button
                  onClick={(e) => { e.stopPropagation(); setReferenceImageUrl(""); setReferencePreviewUrl(""); }}
                  style={{
                    position: "absolute", top: -6, right: -6,
                    width: 16, height: 16, borderRadius: "50%",
                    background: "rgba(239,68,68,0.9)", border: "none",
                    color: "#fff", fontSize: 9, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                  }}
                  title="Remove reference image"
                >×</button>
              </div>
            ) : (
              /* ── Empty: add button ── */
              <button
                onClick={() => referenceInputRef.current?.click()}
                style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0, marginTop: 2,
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.55)", cursor: "pointer", fontSize: 20,
                  display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.15)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.3)"; (e.currentTarget as HTMLElement).style.color = "#60A5FA"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"; }}
                title="Add reference image"
              >
                +
              </button>
            )}

            {/* Prompt textarea */}
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
                // Manual edit clears undo and error state
                if (preEnhancePrompt !== null) setPreEnhancePrompt(null);
                if (enhanceError !== null) setEnhanceError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Describe the scene you imagine…"
              rows={1}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: enhancing ? "rgba(255,255,255,0.45)" : "#fff",
                fontSize: 15, lineHeight: 1.6, resize: "none",
                padding: "6px 14px", fontFamily: "var(--font-body, system-ui)",
                minHeight: 36, maxHeight: 140, boxSizing: "border-box",
                transition: "color 0.2s",
              }}
            />

            {/* ✦ Enhance button — visible when prompt has content */}
            {prompt.trim() && (
              <button
                onClick={handleEnhance}
                disabled={enhancing}
                title={enhancing ? "Enhancing…" : "Enhance prompt with AI (Claude)"}
                style={{
                  flexShrink: 0, alignSelf: "center",
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 11px", borderRadius: 9, fontSize: 12, fontWeight: 600,
                  border: "1px solid rgba(139,92,246,0.35)",
                  background: enhancing ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.12)",
                  color: enhancing ? "rgba(167,139,250,0.5)" : "rgba(167,139,250,0.9)",
                  cursor: enhancing ? "not-allowed" : "pointer",
                  transition: "all 0.15s", marginRight: 4, letterSpacing: "0.01em",
                }}
                onMouseEnter={e => {
                  if (!enhancing) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.22)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.6)";
                    (e.currentTarget as HTMLElement).style.color = "#C4B5FD";
                  }
                }}
                onMouseLeave={e => {
                  if (!enhancing) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.12)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.35)";
                    (e.currentTarget as HTMLElement).style.color = "rgba(167,139,250,0.9)";
                  }
                }}
              >
                {enhancing ? (
                  <>
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%",
                      border: "1.5px solid rgba(167,139,250,0.25)",
                      borderTopColor: "rgba(167,139,250,0.7)",
                      animation: "spin 0.7s linear infinite", flexShrink: 0,
                    }} />
                    Enhancing…
                  </>
                ) : (
                  <>✦ Enhance</>
                )}
              </button>
            )}
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
            {(() => {
              // Hard-locked AR list per model — only supported ratios are shown.
              const activeArList: AspectRatio[] =
                model === "nano-banana-2"       ? NB2_AR :
                model.startsWith("nano-banana") ? NB_STANDARD_PRO_AR :
                DALLE_AR;

              return (
                <div data-dd style={{ position: "relative" }}>
                  <button onClick={() => { closeDropdowns(); setShowArPicker((v) => !v); }} style={ctrlBtn(showArPicker)}>
                    <ARIcon ar={aspectRatio} size={14} />
                    {aspectRatio}
                  </button>

                  {showArPicker && (
                    <div style={{
                      position: "absolute", bottom: "calc(100% + 8px)", left: 0,
                      background: "#141414", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 14, padding: 8, zIndex: 200, minWidth: 220,
                      boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
                    }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px 8px" }}>
                        Aspect ratio
                      </p>
                      {activeArList.map((ar) => (
                        <button
                          key={ar}
                          onClick={() => { setAspectRatio(ar); closeDropdowns(); }}
                          style={{ ...ddItem(aspectRatio === ar) }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = aspectRatio === ar ? "rgba(255,255,255,0.1)" : "transparent"; }}
                        >
                          <ARIcon ar={ar} size={16} selected={aspectRatio === ar} />
                          <span style={{ fontSize: 13, color: "#fff" }}>{ar}</span>
                          {aspectRatio === ar && (
                            <span style={{ marginLeft: "auto", color: "#60A5FA", fontSize: 13 }}>✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

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

            {/* Output format — JPG / PNG (Nano Banana 2 only) */}
            {currentModel.id === "nano-banana-2" && (
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                {(["JPG", "PNG"] as OutputFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setOutputFormat(fmt)}
                    style={{
                      ...ctrlBtn(outputFormat === fmt),
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: outputFormat === fmt ? 600 : 500,
                    }}
                    title={fmt === "JPG" ? "JPEG output" : "PNG output (lossless)"}
                  >
                    {fmt}
                  </button>
                ))}
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

            {/* Generate button — disabled while reference image is uploading */}
            {(() => {
              const isDisabled = !prompt.trim() || !currentModel.available
                || (currentModel.requiresImg && !editImageUrl)
                || referenceUploading;
              const isUploadWait = referenceUploading;
              return (
                <button
                  onClick={() => generate()}
                  disabled={isDisabled}
                  title={isUploadWait ? "Waiting for reference image to finish uploading…" : undefined}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "11px 26px", borderRadius: 13, fontSize: 14, fontWeight: 700,
                    border: "none",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    background: isDisabled
                      ? "rgba(255,255,255,0.07)"
                      : "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
                    color: isDisabled ? "rgba(255,255,255,0.2)" : "#fff",
                    transition: "all 0.2s", letterSpacing: "0.02em",
                    boxShadow: isDisabled ? "none" : "0 0 28px rgba(37,99,235,0.45), 0 4px 16px rgba(0,0,0,0.4)",
                    minWidth: 140,
                  }}
                  onMouseEnter={e => { if (!isDisabled) { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 45px rgba(37,99,235,0.65), 0 4px 20px rgba(0,0,0,0.5)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = !isDisabled ? "0 0 28px rgba(37,99,235,0.45), 0 4px 16px rgba(0,0,0,0.4)" : "none"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
                >
                  {isUploadWait ? (
                    <>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "rgba(255,255,255,0.6)", animation: "spin 0.7s linear infinite" }} />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Zap size={14} /> Generate
                      {currentModel.available && (
                        <span style={{
                          fontSize: 11, fontWeight: 600, opacity: 0.8,
                          background: "rgba(0,0,0,0.25)", padding: "2px 7px", borderRadius: 6,
                        }}>
                          ✦ {computeCredits(model, quality, MODEL_TO_KEY[model]?.startsWith("nano-banana") ? 1 : Math.min(batchSize, 4))} cr
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })()}
          </div>

          {/* Undo enhanced prompt — stays visible until user edits, generates, or enhances again */}
          {preEnhancePrompt !== null && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "4px 16px 12px",
            }}>
              <span style={{ fontSize: 11, color: "rgba(167,139,250,0.55)", fontWeight: 500 }}>
                ✦ Prompt enhanced by AI
              </span>
              <button
                onClick={() => { setPrompt(preEnhancePrompt); setPreEnhancePrompt(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)",
                  cursor: "pointer", transition: "all 0.12s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)";
                }}
              >
                ← Undo
              </button>
            </div>
          )}

          {/* Enhance error — shown when the AI call fails; dismissed on next enhance attempt */}
          {enhanceError !== null && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "4px 16px 12px",
            }}>
              <span style={{ fontSize: 11, color: "rgba(248,113,113,0.8)", fontWeight: 500 }}>
                ⚠ {enhanceError}
              </span>
              <button
                onClick={() => setEnhanceError(null)}
                style={{
                  padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                  border: "1px solid rgba(248,113,113,0.2)",
                  background: "transparent", color: "rgba(248,113,113,0.5)",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Notices */}
        {referenceUploading && (
          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(96,165,250,0.85)", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", border: "1.5px solid rgba(96,165,250,0.3)", borderTopColor: "#60A5FA", animation: "spin 0.7s linear infinite" }} />
            Uploading reference image… Generate will unlock when it&apos;s ready.
          </p>
        )}
        {!currentModel.available && (
          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,165,0,0.7)", marginTop: 8 }}>
            {currentModel.name} is coming soon — try GPT Image or Nano Banana
          </p>
        )}
        {currentModel.requiresImg && !editImageUrl && (
          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(245,158,11,0.8)", marginTop: 8 }}>
            Upload a source image to use {currentModel.name}
          </p>
        )}
      </div>

      {/* ── FULLSCREEN IMAGE VIEWER ───────────────────────────────────────── */}
      {/* position: fixed with top:64 keeps it below the navbar (64px height).          */}
      {/* Background is semi-transparent so the studio remains ~12% visible — cinematic. */}
      {viewingImage?.url && (
        <div
          onClick={() => setViewingImage(null)}
          style={{
            position: "fixed",
            top: 64, left: 0, right: 0, bottom: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.82)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "32px 40px",
          }}
        >
          {/* Image frame wrapper — close button lives inside this, top-right corner */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative", lineHeight: 0 }}
          >
            {/* Close button — anchored to top-right of image frame */}
            <button
              onClick={() => setViewingImage(null)}
              title="Close (Esc)"
              style={{
                position: "absolute", top: -14, right: -14,
                width: 32, height: 32, borderRadius: "50%",
                background: "rgba(20,20,20,0.9)", border: "1px solid rgba(255,255,255,0.18)",
                color: "#fff", fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s", zIndex: 10,
                boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.85)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.6)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(20,20,20,0.9)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)";
              }}
            >✕</button>

            {/* Image — responsive across laptop / desktop / tablet / mobile */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewingImage.url}
              alt="Full size"
              style={{
                display: "block",
                maxWidth: "min(82vw, 1100px)",
                maxHeight: "calc(100vh - 64px - 80px)",
                objectFit: "contain",
                borderRadius: 12,
                boxShadow: "0 24px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.07)",
              }}
            />
          </div>
        </div>
      )}

      {/* Auth modal */}
      {authModal && <AuthModal defaultTab="login" onClose={() => setAuthModal(false)} />}

      {/* ── Zoom hint — fades in briefly when user zooms below action threshold ── */}
      {zoomHint && (
        <div style={{
          position:       "fixed",
          bottom:         140,
          left:           "50%",
          transform:      "translateX(-50%)",
          zIndex:         99998,
          background:     "rgba(20,20,28,0.82)",
          backdropFilter: "blur(10px)",
          border:         "1px solid rgba(255,255,255,0.10)",
          borderRadius:   20,
          padding:        "7px 16px",
          fontSize:       11,
          fontWeight:     500,
          color:          "rgba(255,255,255,0.55)",
          animation:      "fadeIn 0.3s ease",
          pointerEvents:  "none",
          whiteSpace:     "nowrap",
        }}>
          More actions available when zoomed in
        </div>
      )}

      {/* ── Toast notification ────────────────────────────────────────────── */}
      {toastMsg && (
        <div style={{
          position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
          zIndex: 99999,
          background: "rgba(20,20,28,0.96)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 12, padding: "10px 20px",
          fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.88)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          animation: "fadeIn 0.2s ease",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}>
          {toastMsg}
        </div>
      )}

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

    {/* ── Creative Flow overlays — rendered OUTSIDE the gallery div so they
         are not trapped inside its stacking context (zIndex: 40). Being at
         the root Fragment level lets their own zIndex values compete freely
         with the navbar and other page-level layers. ─────────────────────── */}
    <FlowBar />
    <NextStepPanel onVariation={handleVariation} />
    </>
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
