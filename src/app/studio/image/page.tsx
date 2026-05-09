"use client";

import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Zap, RotateCcw, Download, Play, ChevronUp, ChevronDown } from "lucide-react";
import { downloadAsset } from "@/lib/client/downloadAsset";
import { buildJustifiedRows } from "@/lib/gallery/justifiedLayout";
import { getGenerationCreditCost } from "@/lib/credits/model-costs";
import { getDisplayModelName } from "@/lib/studio/model-display-names";
import type { JustifiedInput } from "@/lib/gallery/justifiedLayout";
import { useAuth } from "@/components/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { supabase } from "@/lib/supabase";
import MediaCard from "@/components/media/MediaCard";
import type { PublicAsset } from "@/lib/types/generation";
import { useFlowStore } from "@/lib/flow/store";
import type { FlowStep } from "@/lib/flow/store";
import { createWorkflow, addWorkflowStep } from "@/lib/flow/actions";
import { GeneratingBorderTrace } from "@/components/ui/GeneratingBorderTrace";
import FlowBar from "@/components/studio/flow/FlowBar";
// NextStepPanel removed from Image Studio — premium action panel replaces it
import type { AssetDetailsResponse } from "@/lib/metadata/types";
import CreativeDirectorShell from "@/components/studio/creative-director/CreativeDirectorShell";
import { CDv2Shell } from "@/components/studio/creative-director-v2/CDv2Shell";
import Tooltip from "@/components/ui/Tooltip";
import { MODEL_CAPABILITIES } from "@/lib/studio/model-capabilities";
import {
  IMAGE_MODEL_CONFIGS,
  BATCH_LOCKED_MODEL_KEYS,
  getModelDockConfig,
  getDefaultQuality,
  type QualityOption,
  type QualityDisplayMode,
} from "@/lib/studio/image-model-config";
import { getHeroImagesForModel, getHeroModelLabel } from "@/config/heroImages";
import WorkflowTransitionModal, { type WorkflowFlow, type WorkflowTransitionAsset } from "@/components/studio/workflow/WorkflowTransitionModal";
import PromptEnhancerPanel from "@/components/studio/prompt/PromptEnhancerPanel";
import { FullscreenPreview } from "@/components/ui/FullscreenPreview";

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
  /** ISO timestamp — used to compute stable global sequence numbers */
  createdAt?: string;
  /** Project ID — if set, image was saved to a project; badge links to /dashboard/project/{id} */
  project_id?: string | null;
  /** Visibility — updated optimistically after Make Public action */
  visibility?: "private" | "public" | "project";
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

  // ── Auth / session expired ────────────────────────────────────────────────────
  if (
    lower.includes("unauthorized") ||
    lower.includes("valid session") ||
    lower.includes("session expired") ||
    lower.includes("sign in") ||
    lower.includes("unauthenticated")
  ) {
    return {
      icon:   "🔑",
      title:  "Session expired",
      detail: "Please sign in again and retry.",
    };
  }

  // ── Subscription / billing gate ───────────────────────────────────────────────
  if (
    lower.includes("no active subscription") ||
    lower.includes("subscription has ended") ||
    lower.includes("subscription") ||
    lower.includes("upgrade to") ||
    lower.includes("resubscribe") ||
    lower.includes("trial has ended") ||
    lower.includes("trial expired") ||
    lower.includes("plan")
  ) {
    return {
      icon:   "🔒",
      title:  "Subscription required",
      detail: "An active plan is needed to generate images. Upgrade in your account settings.",
    };
  }

  // ── Trial usage exhausted ─────────────────────────────────────────────────────
  if (lower.includes("trial") || lower.includes("exhausted")) {
    return {
      icon:   "⏳",
      title:  "Trial limit reached",
      detail: "You've used all your trial generations. Upgrade to continue.",
    };
  }

  // ── Policy / safety block ─────────────────────────────────────────────────────
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

  // ── Timeout / too slow — MUST come before credit check ────────────────────────
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("taking longer")) {
    return {
      icon:   "⏱",
      title:  "Generation timed out",
      detail: "The provider took too long to respond. Your image may still be processing — check back later.",
    };
  }

  // ── Credit / quota exhausted ──────────────────────────────────────────────────
  if (
    lower.includes("insufficient credit") ||
    lower.includes("not enough credit") ||
    lower.includes("quota") ||
    lower.includes("insufficient funds") ||
    lower.includes("credit reserve failed")
  ) {
    return {
      icon:   "⚡",
      title:  "Insufficient credits",
      detail: "You don't have enough credits for this generation. Top up in your account.",
    };
  }

  // ── Model configuration issue ──────────────────────────────────────────────────
  if (
    lower.includes("model not found") ||
    lower.includes("model_not_found") ||
    lower.includes("not registered") ||
    lower.includes("not active") ||
    lower.includes("model configuration") ||
    lower.includes("coming-soon")
  ) {
    return {
      icon:   "⚙️",
      title:  "Model configuration issue",
      detail: "This model is not currently available. Try a different model.",
    };
  }

  // ── Rate limit ────────────────────────────────────────────────────────────────
  if (lower.includes("rate limit") || lower.includes("too many request") || lower.includes("concurrent")) {
    return {
      icon:   "🕐",
      title:  "Too many requests",
      detail: "You've hit a rate limit. Wait a moment then try again.",
    };
  }

  // ── Asset / storage save failed ───────────────────────────────────────────────
  if (
    lower.includes("asset save") ||
    lower.includes("persist") ||
    lower.includes("storage upload") ||
    lower.includes("storage failed")
  ) {
    return {
      icon:   "💾",
      title:  "Asset save failed",
      detail: "The image was generated but could not be saved. Please try again.",
    };
  }

  // ── Provider / upstream error ─────────────────────────────────────────────────
  if (
    lower.includes("provider") ||
    lower.includes("upstream") ||
    lower.includes("http 5") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("provider_error") ||
    lower.includes("api error")
  ) {
    return {
      icon:   "🌐",
      title:  "Provider unavailable",
      detail: "The AI provider returned an error. Please try again in a moment.",
    };
  }

  // ── Job record lost ───────────────────────────────────────────────────────────
  if (lower.includes("job record not found") || lower.includes("generation was lost")) {
    return {
      icon:   "🔍",
      title:  "Job not found",
      detail: "The generation record was lost. Please try again.",
    };
  }

  // ── AI Influencer handle errors ───────────────────────────────────────────────
  if (lower.includes("handle") && (lower.includes("not found") || lower.includes("not recognized"))) {
    return {
      icon:   "👤",
      title:  "Influencer not found",
      detail: "The @handle in your prompt wasn't recognized. Make sure your AI Influencer is active and has an identity lock.",
    };
  }
  if (lower.includes("identity lock") || lower.includes("no identity lock")) {
    return {
      icon:   "🔒",
      title:  "No identity lock",
      detail: "This influencer doesn't have an identity lock set up yet. Complete identity training in the AI Influencer studio first.",
    };
  }

  // ── Generic fallback — no raw text exposed ────────────────────────────────────
  return {
    icon:   "⚠️",
    title:  "Generation failed",
    detail: "Something went wrong. Please try again.",
  };
}

type AspectRatio = "Auto" | "1:1" | "3:4" | "4:3" | "2:3" | "3:2" | "9:16" | "16:9" | "5:4" | "4:5" | "21:9" | "1:4" | "1:8" | "4:1" | "8:1";
type ResolutionQuality = "1K" | "2K" | "4K";
type GPTQuality        = "low" | "medium" | "high" | "fast" | "cinematic" | "ultra";
type StudioQuality     = ResolutionQuality | GPTQuality;
type Quality           = ResolutionQuality; // used by allowedQualities — resolution models only
type OutputFormat = "JPG" | "PNG";
type Tab = "history" | "community";

// QualityOption and QualityDisplayMode are imported from @/lib/studio/image-model-config

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
  // Quality, AR, and batch-lock config is NOT stored here.
  // Use getModelDockConfig(MODEL_TO_KEY[id]) from image-model-config.ts — single source of truth.
}

// ── Provider routing — maps UI model IDs → /api/studio/image/generate modelKeys ──────────
const MODEL_TO_KEY: Record<string, string> = {
  "dalle3":               "gpt-image-1",
  "gpt-image-2":          "gpt-image-2",
  "nano-banana-standard": "nano-banana-standard",
  "nano-banana-pro":      "nano-banana-pro",
  "nano-banana-2":        "nano-banana-2",
  "seedream-v5":          "seedream-v5",
  "seedream-4-5":         "seedream-4-5",
};

// ── Reverse map — model key → UI model ID (used by flow variation handler) ───
const KEY_TO_MODEL: Record<string, string> = Object.fromEntries(
  Object.entries(MODEL_TO_KEY).map(([uiId, key]) => [key, uiId])
);

// BATCH_LOCKED_MODEL_KEYS is imported from @/lib/studio/image-model-config (derived from batchLocked).

// ── Catalog ↔ Studio model maps ───────────────────────────────────────────────
// Catalog IDs are safe for URLs (never expose internal "dalle3" key).
// CATALOG_TO_STUDIO_MODEL: ?model= URL param → internal UI model ID
// STUDIO_TO_CATALOG:       internal UI model ID → ?model= URL param (for writing back)
const CATALOG_TO_STUDIO_MODEL: Record<string, string> = {
  "gpt-image-2":     "gpt-image-2",
  "gpt-image-15":    "dalle3",
  "nano-banana-2":   "nano-banana-2",
  "nano-banana-pro": "nano-banana-pro",
  "nano-banana":     "nano-banana-standard",
  "seedream-v5":     "seedream-v5",
  "seedream-4-5":    "seedream-4-5",
} as const;

const STUDIO_TO_CATALOG: Record<string, string> = {
  "dalle3":               "gpt-image-15",
  "gpt-image-2":          "gpt-image-2",
  "nano-banana-2":        "nano-banana-2",
  "nano-banana-pro":      "nano-banana-pro",
  "nano-banana-standard": "nano-banana",
  "seedream-v5":          "seedream-v5",
  "seedream-4-5":         "seedream-4-5",
} as const;


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
// Derived from IMAGE_MODEL_CONFIGS (single source of truth in image-model-config.ts).
// Inline AR arrays removed — use getModelDockConfig(key)?.aspectRatios instead.

// Nano Banana Standard/Pro concrete AR passthrough — derived from shared config.
// "Auto" is excluded: it maps to undefined (no AR sent).
const NB_AR_PASSTHROUGH = new Set<AspectRatio>(
  (getModelDockConfig("nano-banana-standard")?.aspectRatios ?? ["1:1"]) as AspectRatio[]
);
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

// SEEDREAM_AR removed — use getModelDockConfig("seedream-v5")?.aspectRatios from image-model-config.ts

// ── Model definitions ─────────────────────────────────────────────────────────
// Order matches navbar dock order: GPT Image 2 → GPT Image 1.5 → NB2 → NB Pro → NB → Seedream v5 → Seedream 4.5
const MODELS: StudioModel[] = [
  {
    id: "gpt-image-2",
    name: "GPT Image 2",
    provider: "OpenAI",
    description: "OpenAI's Cinematic Intelligence Engine · structured composition · precise scene direction",
    badge: "NEW",
    badgeColor: "#10A37F",
    available: true,
    icon: "openai",
    // Quality config lives in image-model-config.ts — getModelDockConfig("gpt-image-2")
  },
  {
    id: "dalle3",           // backend provider key → "dalle" → resolves to "dalle-3" in tool-registry
    name: "GPT Image 1.5",
    provider: "OpenAI",
    description: "OpenAI's advanced image generation model",
    badge: null,
    badgeColor: null,
    available: true,
    icon: "openai",
    // Quality config lives in image-model-config.ts — getModelDockConfig("gpt-image-1")
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
    // Quality config lives in image-model-config.ts — getModelDockConfig("nano-banana-2")
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
    // Quality config lives in image-model-config.ts — getModelDockConfig("nano-banana-pro")
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
    // Quality config lives in image-model-config.ts — getModelDockConfig("nano-banana-standard")
  },
  {
    id: "seedream-v5",
    name: "Seedream v5",
    provider: "ByteDance",
    description: "ByteDance flagship · cinematic quality · richly detailed",
    badge: "HOT",
    badgeColor: "#EF4444",
    available: true,
    icon: "seedream",
    // Quality config lives in image-model-config.ts — getModelDockConfig("seedream-v5")
  },
  {
    id: "seedream-4-5",
    name: "Seedream 4.5",
    provider: "ByteDance",
    description: "Text-to-image + image editing · 2K & 4K native resolution · 10 cr base",
    badge: "EDIT",
    badgeColor: "#8B5CF6",
    available: true,
    icon: "seedream",
    requiresImg: false,
    // Quality config lives in image-model-config.ts — getModelDockConfig("seedream-4-5")
  },
  {
    id: "flux2-pro",
    name: "Flux.2 Pro",
    provider: "Black Forest Labs",
    description: "Professional-grade photorealistic output · coming soon",
    badge: "SOON",
    badgeColor: "#374151",
    available: false,
    icon: "flux",
    // Quality config lives in image-model-config.ts — getModelDockConfig("flux-2-image")
  },
  {
    id: "flux2-flex",
    name: "Flux.2 Flex",
    provider: "Black Forest Labs",
    description: "Flexible creative control · coming soon",
    badge: "SOON",
    badgeColor: "#374151",
    available: false,
    icon: "flux",
    // Quality config lives in image-model-config.ts — getModelDockConfig("flux-kontext")
  },
  {
    id: "flux2-max",
    name: "Flux.2 Max",
    provider: "Black Forest Labs",
    description: "Maximum quality · 8K capability · coming soon",
    badge: "SOON",
    badgeColor: "#374151",
    available: false,
    icon: "flux",
    // Quality config lives in image-model-config.ts — getModelDockConfig("flux-2-max")
  },
];

// ── Creative Director v1 — Role system ───────────────────────────────────────

type ImageRole = "character" | "environment" | "style" | "lighting" | "object";

const ROLES: ImageRole[] = ["character", "environment", "style", "lighting", "object"];

const ROLE_CONFIG: Record<ImageRole, {
  label:  string;
  short:  string;   // fits inside 52px chip
  color:  string;   // full opacity — use with alpha for borders/glows
  bg:     string;   // chip background
}> = {
  character:   { label: "Character",   short: "Char",  color: "rgba(59,130,246,1)",  bg: "rgba(59,130,246,0.13)"  },
  environment: { label: "Environment", short: "Env",   color: "rgba(34,197,94,1)",   bg: "rgba(34,197,94,0.13)"   },
  style:       { label: "Style",       short: "Style", color: "rgba(139,92,246,1)",  bg: "rgba(139,92,246,0.13)"  },
  lighting:    { label: "Lighting",    short: "Light", color: "rgba(245,158,11,1)",  bg: "rgba(245,158,11,0.13)"  },
  object:      { label: "Object",      short: "Obj",   color: "rgba(148,163,184,1)", bg: "rgba(148,163,184,0.10)" },
};

/** Inject alpha into an rgba() color string: replaces the last numeric component. */
function roleColor(color: string, alpha: number): string {
  return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
}

const ROLE_LABEL: Record<ImageRole, string> = {
  character:   "Character Reference",
  environment: "Environment Reference",
  style:       "Style Reference",
  lighting:    "Lighting Reference",
  object:      "Object Reference",
};

// ── Reference image mention enrichment ───────────────────────────────────────
// Builds an enriched prompt string that maps @imgN references for backend clarity.
// Only used internally before sending to the API — never shown in the UI textarea.
//
// Role injection: [Character Reference: url] / [Environment Reference: url] / …
// Natural language detection (safe):
//   "image 1" / "image attached 1" / "uploaded image 1" / "analyse image 1"
//   → normalized to @imgN tag only when refs exist AND index is in range.
//   Textarea text is NEVER mutated — this runs only in the API send path.
function buildEnrichedPrompt(
  userPrompt: string,
  refs: Array<{ cdnUrl: string; role: ImageRole }>,
): string {
  const uploaded = refs.filter(r => r.cdnUrl);
  if (uploaded.length === 0) return userPrompt;

  // Normalize natural-language image references → @imgN tags.
  // Pattern matches (in priority order, most specific first):
  //   "uploaded image N"  /  "image attached N"  /  "image N"
  // "analyse image N" is handled because "image N" matches the tail after "analyse ".
  const nlPattern = /\b(?:uploaded\s+image|image\s+attached|image)\s*(\d+)\b/gi;
  const processedPrompt = userPrompt.replace(nlPattern, (match, numStr) => {
    const n = parseInt(numStr, 10);
    return (n >= 1 && n <= uploaded.length) ? `@img${n}` : match;
  });

  // Role-based reference header — each image gets its semantic label + CDN URL.
  // Fallback to "Image Reference" if role is somehow absent.
  const roleHeader = uploaded
    .map(r => `[${ROLE_LABEL[r.role] ?? "Image Reference"}: ${r.cdnUrl}]`)
    .join("\n");

  return `${roleHeader}\n\nUser prompt: ${processedPrompt}`;
}

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
// ── Model logo — branded SVG marks per provider family ───────────────────────
// Visual approximations of provider identities; not official brand assets.
function ModelLogo({ type, size = 22 }: { type: string; size?: number }) {
  const s = Math.round(size * 0.6);
  const wrap = (bg: string, node: React.ReactNode) => (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, overflow: "hidden",
    }}>{node}</div>
  );

  if (type === "nanobana") {
    return wrap(
      "linear-gradient(135deg, #F59E0B 0%, #10B981 100%)",
      <span style={{ fontSize: Math.round(s * 0.95), lineHeight: 1 }}>🍌</span>,
    );
  }

  if (type === "openai") {
    // Geometric approximation of the OpenAI knot — 3 interlocked ellipses
    return wrap(
      "linear-gradient(135deg, #0d9e73 0%, #0a7a56 100%)",
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <ellipse cx="12" cy="12" rx="4" ry="9" stroke="white" strokeWidth="1.7" fill="none"/>
        <ellipse cx="12" cy="12" rx="4" ry="9" stroke="white" strokeWidth="1.7" fill="none" transform="rotate(60 12 12)"/>
        <ellipse cx="12" cy="12" rx="4" ry="9" stroke="white" strokeWidth="1.7" fill="none" transform="rotate(120 12 12)"/>
      </svg>,
    );
  }

  if (type === "seedream") {
    // Swirl-inspired mark suggesting flow and generation
    return wrap(
      "linear-gradient(135deg, #0c3b5e 0%, #0e5f8a 100%)",
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3.5C16.7 3.5 20.5 7.3 20.5 12C20.5 16.7 16.7 20.5 12 20.5C8.6 20.5 6.5 18 6.5 15.5C6.5 13 8.6 11 11 11C12.9 11 14.5 12.5 14.5 14.5C14.5 15.8 13.6 16.8 12.5 17"
          stroke="white" strokeWidth="1.7" strokeLinecap="round" fill="none"
        />
        <circle cx="12" cy="3.5" r="1.2" fill="white"/>
      </svg>,
    );
  }

  if (type === "flux") {
    // Crystalline triangle mark — geometric precision
    return wrap(
      "linear-gradient(135deg, #1a1a30 0%, #2a2a4a 100%)",
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 4L21 19H3L12 4Z" stroke="white" strokeWidth="1.7" strokeLinejoin="round" fill="rgba(255,255,255,0.08)"/>
        <line x1="12" y1="4" x2="12" y2="19" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round"/>
        <line x1="3" y1="19" x2="15.5" y2="11.5" stroke="rgba(255,255,255,0.28)" strokeWidth="1" strokeLinecap="round"/>
        <line x1="21" y1="19" x2="8.5" y2="11.5" stroke="rgba(255,255,255,0.28)" strokeWidth="1" strokeLinecap="round"/>
      </svg>,
    );
  }

  return wrap("#374151", <span style={{ fontSize: Math.round(size * 0.42), fontWeight: 700, color: "#fff" }}>AI</span>);
}

// ── Badge color helpers ───────────────────────────────────────────────────────
function modelBadgeBg(badge: string | null): string {
  if (badge === "Fast") return "rgba(6,78,59,0.85)";
  if (badge === "Pro")  return "rgba(30,58,95,0.85)";
  if (badge === "NEW")  return "rgba(12,74,110,0.85)";
  if (badge === "SOON") return "rgba(255,255,255,0.07)";
  return "rgba(55,65,81,0.85)";
}
function modelBadgeFg(badge: string | null): string {
  if (badge === "Fast") return "#34d399";
  if (badge === "Pro")  return "#60a5fa";
  if (badge === "NEW")  return "#38bdf8";
  if (badge === "SOON") return "rgba(255,255,255,0.32)";
  return "#fff";
}

// ── Shimmer placeholder ───────────────────────────────────────────────────────
function GeneratingPlaceholder({ ar, onCancel }: { ar: AspectRatio; onCancel?: () => void }) {
  // The grid item (wrapper div) controls the cell dimensions via colSpan + rowSpan.
  // This placeholder fills it edge-to-edge with position:absolute — no self-imposed AR.
  // The `ar` prop is kept for the cancel button label/accessibility only.
  void ar;

  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: 0, overflow: "hidden" }}>
      {/* Glowing border trace — travels around all 4 sides while generating */}
      <GeneratingBorderTrace borderRadius={0} />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(110deg, #060D1A 25%, #0B1530 50%, #060D1A 75%)",
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
        {onCancel && (
          <button
            onClick={(e) => { e.stopPropagation(); onCancel(); }}
            title="Cancel generation"
            style={{
              marginTop: 4,
              padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
              background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.35)", cursor: "pointer", letterSpacing: "0.02em",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.15)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.35)"; (e.currentTarget as HTMLElement).style.color = "rgba(252,165,165,0.9)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; }}
          >Cancel</button>
        )}
      </div>
    </div>
  );
}

// ── Masonry gallery helpers ───────────────────────────────────────────────────
// The Image Studio uses CSS columns masonry.  Every image renders at its
// natural aspect ratio — no forced height, no cropping, no black dead-space.
// Column count is driven by zoomLevel (1-5): higher zoom = fewer, larger columns.

/** Parse "W:H" → CSS aspect-ratio string ("W / H").  Returns undefined for Auto/invalid. */
function getAspectRatioCss(aspectRatio?: string | null): string | undefined {
  if (!aspectRatio || aspectRatio === "Auto") return undefined;
  const parts = aspectRatio.split(":");
  if (parts.length !== 2) return undefined;
  const w = Number(parts[0]);
  const h = Number(parts[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return undefined;
  return `${w} / ${h}`;
}

// ── Skeleton card (history loading) ──────────────────────────────────────────
// Preset numeric aspect ratios covering the common AR distribution so the
// skeleton looks like a real gallery (mix of portrait / square / landscape).
const SKELETON_RATIOS = [
  0.5625, 0.75, 1, 1.7778, 1.7778, 0.5625, 1.3333, 2.1,
  0.75, 1, 0.5625, 1.7778, 1, 0.75, 1.3333,
];

function SkeletonCard({ index }: { index: number }) {
  // Stagger capped at card 20 — beyond that all appear together
  const delay = `${Math.min(index, 20) * 40}ms`;

  // The flex wrapper sets exact width × height — this card fills it absolutely.
  return (
    <div style={{
      position: "absolute", inset: 0,
      borderRadius: 0,
      overflow: "hidden",
      opacity: 0,
      animation: `fadeIn 0.4s ease ${delay} forwards`,
    }}>
      {/* Base layer — very faint white tint */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(255,255,255,0.03)",
      }} />
      {/* Shimmer sweep overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.045) 50%, transparent 75%)",
        backgroundSize: "200% 100%",
        animation: `skeletonSweep 2.2s ease-in-out ${Math.min(index, 20) * 60}ms infinite`,
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
    // Only show "project" visibility if actually linked to a project.
    // "private" means no badge is shown in the card overlay we render in page.tsx.
    visibility:    img.project_id ? "project" : "private",
    project_id:    img.project_id ?? null,
    credits_used:  0,
    created_at:    img.createdAt ?? new Date().toISOString(),
  };
}

function ImageCard({
  img,
  onRegenerate,
  onReusePrompt,
  onOpen,
  onDelete,
  onEnhance,
  onCancel,
  onOpenWorkflow,
  hideHoverActions = false,
  seqNumber,
  onImageLoad,
}: {
  img: GeneratedImage;
  onRegenerate?: (prompt: string, model: string, ar: string) => void;
  onReusePrompt?: (prompt: string) => void;
  onOpen?: () => void;
  onDelete?: (id: string, assetId?: string) => void;
  onEnhance?: () => void;
  onCancel?: () => void;
  onOpenWorkflow?: (flow: WorkflowFlow) => void;
  hideHoverActions?: boolean;
  seqNumber?: number;
  /** Fired when the underlying <img> loads — caller reads naturalWidth/naturalHeight for justified layout. */
  onImageLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  if (img.status === "generating") {
    return <GeneratingPlaceholder ar={img.aspectRatio as AspectRatio} onCancel={onCancel} />;
  }

  if (img.status === "error") {
    const { icon, title, detail } = classifyError(img.error);
    return (
      <div style={{
        position: "absolute", inset: 0, borderRadius: 0,
        background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 10, padding: "20px 16px",
        }}>
          <span style={{ fontSize: 28, lineHeight: 1 }}>{icon}</span>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.75)", margin: 0, marginBottom: 4 }}>
              {title}
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", margin: 0, lineHeight: 1.5 }}>
              {detail}
            </p>
          </div>
          {/* Action row */}
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {img.prompt && (
              <button
                onClick={() => onReusePrompt?.(img.prompt)}
                style={{
                  fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 6,
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
                fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 6,
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

  // Done — render full MediaCard with owner actions.
  // galleryMode fills the grid cell edge-to-edge (no card chrome, objectFit cover).
  // Wrapper onClick: always selects card for right panel;
  // opens fullscreen only when the click target is not an action button.
  return (
    <div
      style={{ animation: "fadeIn 0.3s ease", position: "relative" }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        onOpen?.();
      }}
    >
      <MediaCard
        asset={toPublicAsset(img)}
        isOwner
        galleryMode
        aspectRatio={img.aspectRatio && img.aspectRatio !== "Auto" ? img.aspectRatio : undefined}
        hideHoverActions={hideHoverActions}
        hideVisibilityBadge={true}
        seqNumber={img.status === "done" ? seqNumber : undefined}
        onRegenerate={() => onRegenerate?.(img.prompt, img.model, img.aspectRatio)}
        onReusePrompt={onReusePrompt}
        onEnhance={onEnhance ? () => onEnhance() : undefined}
        onAnimate={(_asset, frame) => onOpenWorkflow?.(frame === "start" ? "start-frame" : "end-frame")}
        onImageLoad={onImageLoad}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASPECT RATIO HELPER — resolves the best AspectRatio for a variation
// Priority: measured pixels → stored AR string → canvas fallback (never "Auto")
// ─────────────────────────────────────────────────────────────────────────────
const VARIATION_SNAP_TARGETS: [number, AspectRatio][] = [
  [16 / 9,  "16:9"],
  [9 / 16,  "9:16"],
  [1,       "1:1"],
  [4 / 3,   "4:3"],
  [3 / 4,   "3:4"],
  [3 / 2,   "3:2"],
  [2 / 3,   "2:3"],
  [4 / 5,   "4:5"],
  [5 / 4,   "5:4"],
  [21 / 9,  "21:9"],
];

function snapToNearestAR(ratio: number): AspectRatio {
  let best: AspectRatio = "16:9";
  let bestDelta = Infinity;
  for (const [target, label] of VARIATION_SNAP_TARGETS) {
    const d = Math.abs(ratio - target);
    if (d < bestDelta) { bestDelta = d; best = label; }
  }
  return best;
}

function resolveVariationAR(
  img: GeneratedImage,
  imageRatios: Record<string, number>,
  canvasFallback: AspectRatio,
): AspectRatio {
  // 1. Real measured dimensions (highest fidelity)
  const measured = imageRatios[img.id];
  if (measured && measured > 0) return snapToNearestAR(measured);

  // 2. Stored AR string if valid and not "Auto"
  if (img.aspectRatio && img.aspectRatio !== "Auto") {
    const parts = img.aspectRatio.split(":");
    if (parts.length === 2) {
      const w = Number(parts[0]);
      const h = Number(parts[1]);
      if (w > 0 && h > 0) return snapToNearestAR(w / h);
    }
  }

  // 3. Canvas AR as last resort — never return "Auto"
  return canvasFallback === "Auto" ? "16:9" : canvasFallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER PAGE
// ─────────────────────────────────────────────────────────────────────────────
function ImageStudioInner() {
  const { user, session, refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

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

  // Resolve initial model from ?model= URL param (module-level maps are safe to read here)
  const modelParam = searchParams.get("model") ?? "";
  const initialModel = CATALOG_TO_STUDIO_MODEL[modelParam] ?? "dalle3";

  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [prompt, setPrompt] = useState(() => {
    const p = searchParams.get("prompt");
    if (p) return p;
    const h = searchParams.get("handle");
    return h ? `@${h.charAt(0).toUpperCase()}${h.slice(1)}` : "";
  });
  const [model, setModel] = useState(initialModel);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [quality, setQuality] = useState<StudioQuality>("1K");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("JPG");
  const [batchSize, setBatchSize] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(4); // 1-5
  const [activeTab, setActiveTab] = useState<Tab>("history");
  // Measured aspect ratios from real loaded images — keyed by image ID.
  // Populated via onImageLoad on the actual rendered <img>. Used to override
  // the stored "Auto" aspectRatio string with the true naturalWidth/naturalHeight
  // so the justified layout engine allocates the correct column width per image.
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  // ── Studio mode — Standard Generate or Creative Director ────────────────────
  // Initialized from ?mode= URL param so navbar / dashboard links deep-link correctly.
  // A useEffect below keeps this in sync when searchParams changes (e.g. back/forward).
  const [studioMode, setStudioMode] = useState<"standard" | "creative-director">(
    searchParams.get("mode") === "creative-director" ? "creative-director" : "standard"
  );

  // ── URL ↔ State sync (model + mode) ─────────────────────────────────────────
  // Keeps React state in sync when the URL changes after mount (back/forward nav,
  // navbar link clicks). Uses the CATALOG_TO_STUDIO_MODEL map so internal model IDs
  // are always resolved from safe catalog keys — "dalle3" never appears in the URL.
  useEffect(() => {
    const urlModel  = searchParams.get("model") ?? "";
    const resolved  = CATALOG_TO_STUDIO_MODEL[urlModel] ?? "dalle3";
    setModel(resolved);
  }, [searchParams]);

  useEffect(() => {
    const urlMode = searchParams.get("mode");
    setStudioMode(urlMode === "creative-director" ? "creative-director" : "standard");
  }, [searchParams]);

  const [authModal, setAuthModal] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState("");   // source image for edit models

  // ── Prompt enhancement ───────────────────────────────────────────────────────
  const [enhancing, setEnhancing] = useState(false);
  const [preEnhancePrompt, setPreEnhancePrompt] = useState<string | null>(null);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  // Panel state — never auto-replaces prompt
  const [enhancerOpen, setEnhancerOpen]         = useState(false);
  const [enhancedResult, setEnhancedResult]     = useState<string | null>(null);
  // ── @ mention menu ────────────────────────────────────────────────────────────
  const [atMenuOpen, setAtMenuOpen]             = useState(false);
  const [atMenuFilter, setAtMenuFilter]         = useState("");

  // ── Fullscreen viewer ────────────────────────────────────────────────────────
  const [viewingImage, setViewingImage] = useState<GeneratedImage | null>(null);

  // ── Right details panel ──────────────────────────────────────────────────────
  const [selectedImage, setSelectedImage]   = useState<GeneratedImage | null>(null);
  const [panelDetails, setPanelDetails]     = useState<AssetDetailsResponse | null>(null);
  const [panelLoading, setPanelLoading]     = useState(false);
  const [panelAnimateOpen, setPanelAnimateOpen] = useState(false);   // animate dropdown
  const [panelMetaExpanded, setPanelMetaExpanded] = useState(true); // metadata accordion — open by default
  const [panelCollapsed, setPanelCollapsed]     = useState(false);  // collapse/expand handle

  // ── Workflow transition modal ──────────────────────────────────────────────────
  const [workflowModal, setWorkflowModal] = useState<{
    open: boolean;
    defaultFlow: WorkflowFlow;
    asset: WorkflowTransitionAsset | null;
  }>({ open: false, defaultFlow: "animate", asset: null });

  const openVideoWorkflow = useCallback((img: GeneratedImage, flow: WorkflowFlow) => {
    if (!img.url) return;
    setWorkflowModal({
      open: true,
      defaultFlow: flow,
      asset: {
        url:         img.url,
        prompt:      img.prompt       || undefined,
        assetId:     img.assetId      || undefined,
        projectId:   img.project_id   || undefined,
        // Transfer the image's own AR so Video Studio opens with the same ratio.
        // Exclude "Auto" — VideoStudioShell will fall back to its own default.
        aspectRatio: (img.aspectRatio && img.aspectRatio !== "Auto")
          ? img.aspectRatio
          : undefined,
      },
    });
  }, []);

  // ── History error ─────────────────────────────────────────────────────────────
  const [historyError, setHistoryError] = useState(false);

  // ── Infinite scroll — cursor pagination state ─────────────────────────────────
  // galleryNextCursor: ISO timestamp returned by /api/assets as `nextCursor`.
  //   Passed as `?cursor=` on the next page request (created_at < cursor).
  // galleryHasMore: false once the API confirms no further pages exist.
  // galleryFetchingMore: guards against concurrent page requests.
  const [galleryNextCursor, setGalleryNextCursor] = useState<string | null>(null);
  const [galleryHasMore,    setGalleryHasMore]    = useState(false);
  const [galleryFetchingMore, setGalleryFetchingMore] = useState(false);

  // ── Toast — lightweight, variant-aware ───────────────────────────────────────
  const [toastState, setToastState] = useState<{ msg: string; variant: "success" | "error" | "info" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, variant: "success" | "error" | "info" = "info") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastState({ msg, variant });
    toastTimerRef.current = setTimeout(() => setToastState(null), 3200);
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

  // ── Multi-image reference state ───────────────────────────────────────────────
  const [referenceImages, setReferenceImages] = useState<Array<{
    id: string;
    previewUrl: string;   // blob URL for display
    cdnUrl: string;       // real CDN URL — empty while uploading
    uploading: boolean;
    role: ImageRole;      // Creative Director v1 — semantic role
  }>>([]);

  // Derived values from referenceImages array
  const referenceUploading = referenceImages.some(r => r.uploading);
  const referenceImageUrls = referenceImages.filter(r => r.cdnUrl).map(r => r.cdnUrl);
  // Backward compat for character lock logic (uses first image):
  const referenceImageUrl = referenceImageUrls[0] ?? "";
  const referencePreviewUrl = referenceImages[0]?.previewUrl ?? "";

  // Transform mode: GPT Image + reference image uploaded → provider routes to /v1/images/edits.
  // OpenAI /v1/images/edits ignores quality. Selector is hidden and pricing is flat in this mode.
  // Source of truth: whether referenceImageUrl is set AND the current model is dalle3.
  const isTransformMode = model === "dalle3" && !!referenceImageUrl;

  // ── @imgN intelligence — derived from prompt ──────────────────────────────────
  // Set of 0-based indices of reference images currently mentioned in the prompt.
  // Used to drive thumbnail glow without any extra state atom.
  const activeRefIndices = useMemo(() => {
    const indices = new Set<number>();
    for (const m of prompt.matchAll(/@img(\d+)\b/gi)) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= referenceImages.length) indices.add(n - 1);
    }
    return indices;
  }, [prompt, referenceImages.length]);

  // Thumbnail hover state — drives floating preview above the hovered chip.
  const [hoverRefIdx, setHoverRefIdx] = useState<number | null>(null);
  // Role dropdown — which thumbnail has its role menu open (null = none).
  const [roleMenuIdx, setRoleMenuIdx] = useState<number | null>(null);
  // Add-button tooltip — managed manually so it reliably hides when file dialog opens.
  const [addBtnHovered, setAddBtnHovered] = useState(false);

  // ── Dock collapse state ───────────────────────────────────────────────────────
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);

  // ── Gallery multi-select ──────────────────────────────────────────────────────
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());

  // ── Real gallery actions — Make Public / Move to Project ─────────────────────
  const [makePublicModal,    setMakePublicModal]    = useState(false);
  const [makePublicLoading,  setMakePublicLoading]  = useState(false);
  const [moveProjectModal,   setMoveProjectModal]   = useState(false);
  const [userProjects,       setUserProjects]       = useState<{ id: string; name: string }[]>([]);
  const [projectsLoading,    setProjectsLoading]    = useState(false);
  const [moveProjectLoading, setMoveProjectLoading] = useState(false);

  const fetchUserProjects = useCallback(async () => {
    if (!session?.access_token || userProjects.length > 0) return;
    setProjectsLoading(true);
    try {
      const res = await fetch("/api/projects", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const json = await res.json() as { data?: { id: string; name: string }[] };
      setUserProjects(json.data ?? []);
    } catch { /* silent */ }
    finally { setProjectsLoading(false); }
  }, [session?.access_token, userProjects.length]);

  const handleBulkMakePublic = useCallback(async () => {
    if (!session?.access_token) return;
    setMakePublicLoading(true);
    const targets = images.filter(img => selectedImageIds.has(img.id) && img.assetId && img.status === "done");
    let success = 0;
    await Promise.all(targets.map(async (img) => {
      try {
        const res = await fetch(`/api/assets/${img.assetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ visibility: "public" }),
        });
        if (res.ok) {
          setImages(prev => prev.map(i => i.id === img.id ? { ...i, visibility: "public" as const } : i));
          success++;
        }
      } catch { /* silent */ }
    }));
    setMakePublicLoading(false);
    setMakePublicModal(false);
    setSelectedImageIds(new Set());
    showToast(success > 0 ? `${success} image${success === 1 ? "" : "s"} made public` : "No changes made", success > 0 ? "success" : "info");
  }, [session?.access_token, images, selectedImageIds, showToast]);

  const handleBulkMoveToProject = useCallback(async (projectId: string, projectName: string) => {
    if (!session?.access_token) return;
    setMoveProjectLoading(true);
    const targets = images.filter(img => selectedImageIds.has(img.id) && img.assetId && img.status === "done");
    let success = 0;
    await Promise.all(targets.map(async (img) => {
      try {
        const res = await fetch(`/api/assets/${img.assetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ visibility: "project", project_id: projectId }),
        });
        if (res.ok) {
          setImages(prev => prev.map(i => i.id === img.id ? { ...i, project_id: projectId } : i));
          success++;
        }
      } catch { /* silent */ }
    }));
    setMoveProjectLoading(false);
    setMoveProjectModal(false);
    setSelectedImageIds(new Set());
    showToast(success > 0 ? `Moved to "${projectName}"` : "No changes made", success > 0 ? "success" : "info");
  }, [session?.access_token, images, selectedImageIds, showToast]);

  // ── Hero strip hover state (empty state only) ────────────────────────────────
  const [hoveredHeroIdx, setHoveredHeroIdx] = useState<number | null>(null);

  // ── Style Preview System — derives hero images + label from selected model ────
  const heroImages    = useMemo(() => getHeroImagesForModel(model), [model]);
  const heroModelLabel = useMemo(() => getHeroModelLabel(model), [model]);

  // ── Cancel flow — tracks which placeholder IDs the user has cancelled ─────────
  // cancelledRef is a ref (not state) so the polling loop can read it synchronously.
  const cancelledRef = useRef<Set<string>>(new Set());

  // ── Auto-scroll to top of gallery on generate ────────────────────────────────
  const galleryScrollRef = useRef<HTMLDivElement>(null);
  // Sentinel div observed by IntersectionObserver to trigger infinite scroll fetches.
  // Placed at the bottom of the justified gallery; observer fires when it enters the
  // expanded viewport (rootMargin: "800px" prefetches well before the user hits bottom).
  const infiniteScrollSentinelRef = useRef<HTMLDivElement>(null);
  // Ref-based guard against stale-closure double-fires from IntersectionObserver.
  // Using a ref (not state) avoids re-creating the observer on every fetch cycle.
  const isFetchingMoreRef = useRef(false);
  // Stable ref to fetchMoreImages — updated each render so the IntersectionObserver
  // effect never goes stale without needing to list fetchMoreImages in its dep array.
  const fetchMoreRef = useRef<() => void>(() => {});
  // Card-level scroll targeting — keyed by image id
  const imageCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [generateGlow, setGenerateGlow] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

  // ── Character Consistency
  const [refFaceDetected,     setRefFaceDetected]     = useState(false);
  const [characterLock,       setCharacterLock]       = useState(false);
  const [consistencyStrength, setConsistencyStrength] = useState<"low" | "medium" | "high">("medium");
  const currentModel = MODELS.find((m) => m.id === model) ?? MODELS[0];

  // ── Upload cap for current model ──────────────────────────────────────────────
  const currentModelKey = MODEL_TO_KEY[model] ?? "gpt-image-1";
  const maxRefs = MODEL_CAPABILITIES[currentModelKey]?.maxReferenceImages ?? 1;

  // ── Shared dock config — single source of truth from image-model-config.ts ──
  const currentDockConfig  = getModelDockConfig(currentModelKey);

  // ── Effective batch size — locked models (NB, Flux) are capped at 1 ────────
  const batchLocked       = BATCH_LOCKED_MODEL_KEYS.has(currentModelKey);
  const effectiveBatchSize = batchLocked ? 1 : batchSize;

  // ── AI Influencer @handle detection (local only — no DB, no async) ───────────
  // Purely syntactic: detects @Handle tokens in the current prompt so the UI can
  // show "Using @[handle] identity" badges before the user hits Generate.
  // The server-side resolveInfluencerHandles() is the authority for actual resolution.
  const detectedHandles = useMemo(
    () => [
      ...new Set(
        [...prompt.matchAll(/@([a-zA-Z][a-zA-Z0-9_]{0,30})/g)]
          .map(m => m[1])
          .filter(h => !/^img\d+$/i.test(h) && !/^image\d+$/i.test(h)),
      ),
    ],
    [prompt],
  );

  // ── Influencer avatar URLs — fetched from readiness endpoint ─────────────────
  // Populated whenever detectedHandles changes. Used for @handle badge avatars.
  // Same endpoint as Video Studio; no separate fetch logic needed.
  const [handleAvatarUrls, setHandleAvatarUrls] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (detectedHandles.length === 0) { setHandleAvatarUrls({}); return; }
    const token = user?.accessToken;
    if (!token) return;
    const params = new URLSearchParams({ handles: detectedHandles.join(",") });
    fetch(`/api/studio/influencer/readiness?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok
        ? res.json() as Promise<Record<string, { ready: boolean; avatarUrl: string | null }>>
        : Promise.resolve({})
      )
      .then(data => {
        const urls: Record<string, string | null> = {};
        for (const [handle, val] of Object.entries(data)) {
          const v = val as { ready: boolean; avatarUrl: string | null };
          urls[handle] = v.avatarUrl;
        }
        setHandleAvatarUrls(urls);
      })
      .catch(() => {});
  }, [detectedHandles, user?.accessToken]);

  // ── Justified gallery layout ──────────────────────────────────────────────
  // targetRowHeight is driven by the zoom slider.
  // Higher zoom → taller rows → fewer images per row → larger images.
  const targetRowHeight = useMemo(() => {
    if (zoomLevel >= 5) return 440;
    if (zoomLevel >= 4) return 340;
    if (zoomLevel >= 3) return 260;
    if (zoomLevel >= 2) return 200;
    return 160;
  }, [zoomLevel]);

  // Container pixel width — measured by ResizeObserver watching galleryScrollRef.
  // contentBoxSize.inlineSize excludes padding so this is the true available width.
  const [containerWidth, setContainerWidth] = useState(0);

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

  // ── ResizeObserver — track gallery content width for justified layout ────────
  // Observes galleryScrollRef (the scroll container with padding: 24px).
  // contentBoxSize.inlineSize reports the content-box width, i.e. after padding
  // is subtracted — exactly the space available to gallery rows.
  //
  // BUG FIX: This effect depends on studioMode so it re-runs whenever the user
  // switches back to "standard" mode. Without this, the gallery div is conditionally
  // unmounted in Creative Director mode — some browsers fire the ResizeObserver
  // callback one final time with width=0 on unmount, zeroing containerWidth. When
  // the gallery div remounts, the old [] effect never re-runs, leaving containerWidth=0
  // and justifiedRows empty → blank gallery. Re-running on studioMode change re-seeds
  // from the freshly mounted div and re-attaches the observer.
  useEffect(() => {
    if (studioMode !== "standard") return; // gallery div is not mounted in CD mode
    const el = galleryScrollRef.current;
    if (!el) return;
    // Seed immediately so the first layout pass runs synchronously
    setContainerWidth(el.clientWidth - 48); // subtract left+right 24px padding
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w =
        entry.contentBoxSize?.[0]?.inlineSize ??
        entry.contentRect.width;
      setContainerWidth(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  // studioMode included — re-seed & re-attach when switching back to standard
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioMode]);

  // ── Character Consistency: detect face when CDN URL becomes available ────────
  const firstRefCdnUrl = referenceImages[0]?.cdnUrl ?? "";
  useEffect(() => {
    if (!firstRefCdnUrl) { setRefFaceDetected(false); setCharacterLock(false); return; }
    (async () => {
      try {
        if (typeof window === "undefined" || !("FaceDetector" in window)) return;
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = firstRefCdnUrl;
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const det = new (window as any).FaceDetector({ fastMode: true });
        const faces: unknown[] = await det.detect(img);
        setRefFaceDetected(faces.length > 0);
      } catch { /* FaceDetector unavailable — no-op */ }
    })();
  }, [firstRefCdnUrl]);

  // ── Justified layout rows — recomputes only when images or containerWidth change ──
  // Type alias so images can carry the `src` field required by JustifiedInput.
  type ImageJustifiedItem = GeneratedImage & JustifiedInput;
  // Map GeneratedImage → JustifiedInput (adds `src` = url).
  // When a real naturalWidth/naturalHeight has been measured via onImageLoad,
  // encode it as integer pixel dimensions so parseAspectRatio() in the layout
  // engine picks them up in priority over the stored "Auto" string.
  const justifiedImages = useMemo<ImageJustifiedItem[]>(
    () => images.map((img) => {
      const measuredRatio = imageRatios[img.id];
      return {
        ...img,
        src: img.url,
        // Pass measured ratio as synthetic pixel dimensions (10000 is an
        // arbitrary large integer; only the ratio w/h matters to the engine).
        naturalWidth:  measuredRatio != null ? Math.round(measuredRatio * 10000) : undefined,
        naturalHeight: measuredRatio != null ? 10000 : undefined,
      };
    }),
    [images, imageRatios],
  );
  const justifiedRows = useMemo(
    () => buildJustifiedRows(justifiedImages, containerWidth, targetRowHeight, 12),
    [justifiedImages, containerWidth, targetRowHeight],
  );

  // Skeleton rows — same algorithm, fake items from SKELETON_RATIOS
  const skeletonRows = useMemo(() => {
    if (containerWidth <= 0) return [];
    const fakeItems = SKELETON_RATIOS.map((ratio, i) => ({
      id: `sk-${i}`,
      src: null,
      aspectRatio: "Auto",
      naturalWidth: Math.round(ratio * 1000),
      naturalHeight: 1000,
    }));
    return buildJustifiedRows(fakeItems, containerWidth, targetRowHeight, 12);
  }, [containerWidth, targetRowHeight]);

  // ── Hydrate gallery instantly from localStorage cache on mount ───────────────
  // Runs once user.id is known. Populates images before the API fetch completes
  // so returning users never see a blank gallery on load.
  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;
    const cacheKey = `zencra_gallery_cache_image_${user.id}`;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const cached: GeneratedImage[] = JSON.parse(raw) as GeneratedImage[];
        if (cached.length > 0) {
          setImages((prev) => {
            // Session-generated images take priority — don't overwrite them
            if (prev.length > 0) return prev;
            return cached;
          });
        }
      }
    } catch { /* ignore — corrupted cache is safe to skip */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Hydrate imageRatios from localStorage on mount ───────────────────────────
  // Pre-populates the real measured ratios so the justified layout renders at
  // correct widths immediately — before any <img> onLoad fires.
  // This eliminates the micro-shift where images first render at the stored AR
  // fallback then jump to their true dimensions as they decode.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("zencra_image_ratios");
      if (raw) {
        const cached = JSON.parse(raw) as Record<string, number>;
        if (cached && typeof cached === "object") {
          setImageRatios(cached);
        }
      }
    } catch { /* corrupted cache — safe to ignore */ }
  // Run once on mount — no deps needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist imageRatios to localStorage whenever new ratios are measured ─────
  // Written on every change so the cache stays in sync as images load.
  // Uses the image ID as key so ratios survive across sessions and page refreshes.
  // Not scoped per-user: ratios are derived from public CDN image dimensions and
  // carry no personal data, so sharing a key across users on the same browser is safe.
  useEffect(() => {
    if (typeof window === "undefined" || Object.keys(imageRatios).length === 0) return;
    try {
      localStorage.setItem("zencra_image_ratios", JSON.stringify(imageRatios));
    } catch { /* quota exceeded — non-fatal */ }
  }, [imageRatios]);

  // ── Load user's image history on mount (once auth is ready) ─────────────────
  useEffect(() => {
    if (!user || historyLoaded) return;

    (async () => {
      console.time("[Gallery] fetch image");
      // ── Token strategy ─────────────────────────────────────────────────────
      // getSession() reads from localStorage and can return a stale expired token
      // before the SDK's background refresh cycle has run (race: user state
      // updates via INITIAL_SESSION before TOKEN_REFRESHED fires).
      // Strategy: getSession() first; if the server returns 401 (expired token),
      // call refreshSession() to force a new access token and retry once.
      // This keeps the common path cheap (one getSession + one fetch) while
      // being resilient to the local-dev startup timing issue.
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      let accessToken = freshSession?.access_token ?? null;

      // No session token — unconfigured local env or not actually logged in.
      // Show empty state rather than an error.
      if (!accessToken) {
        setHistoryLoaded(true);
        return;
      }

      // ── Shared fetch helper — /api/assets cursor-paginated endpoint ─────────
      const doFetch = (token: string, cursor?: string) => {
        const params = new URLSearchParams({
          studio:          "image",
          limit:           "50",
          include_failed:  "true",
        });
        if (cursor) params.set("cursor", cursor);
        return fetch(`/api/assets?${params.toString()}`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
      };

      try {
        let res = await doFetch(accessToken);

        // ── 401 retry: token expired — refresh and try once more ───────────
        if (res.status === 401) {
          console.warn("[ImageStudio] Bearer token expired — refreshing session and retrying");
          try {
            const { data: { session: refreshed }, error: refreshErr } =
              await supabase.auth.refreshSession();
            if (refreshErr || !refreshed?.access_token) {
              console.error("[ImageStudio] refreshSession failed:", refreshErr?.message ?? "no session");
              setHistoryError(true);
              return;
            }
            accessToken = refreshed.access_token;
            res = await doFetch(accessToken);
          } catch (refreshEx) {
            console.error("[ImageStudio] refreshSession threw:", refreshEx);
            setHistoryError(true);
            return;
          }
        }

        if (!res.ok) {
          console.error(
            "[ImageStudio] history fetch failed — status:", res.status,
            await res.text().catch(() => "(unreadable body)")
          );
          setHistoryError(true);
          return;
        }

        const json = await res.json();
        if (!json.success || !Array.isArray(json.data)) {
          console.error("[ImageStudio] history response shape unexpected:", json);
          setHistoryError(true);
          return;
        }

        // Map /api/assets rows → GeneratedImage.
        // /api/assets uses: id, model_key, url, aspect_ratio, status("ready"|"failed"|"pending")
        // Pending rows are in-flight and have no URL — skip them on initial load.
        const loaded: GeneratedImage[] = (json.data as Array<{
          id: string;
          model_key: string;
          prompt: string;
          status: string;
          url: string | null;
          aspect_ratio: string | null;
          error_message?: string | null;
          project_id?: string | null;
          created_at?: string | null;
        }>)
          .filter((row) => row.status === "ready" || row.status === "failed")
          .map((row) => ({
            id:          row.id,
            assetId:     row.id,
            url:         row.url ?? null,
            prompt:      row.prompt ?? "",
            model:       KEY_TO_MODEL[row.model_key] ?? row.model_key ?? "dalle3",
            aspectRatio: (row.aspect_ratio ?? "Auto") as AspectRatio,
            status:      (row.status === "failed" ? "error" : "done") as GeneratedImage["status"],
            error:       row.status === "failed" ? (row.error_message ?? undefined) : undefined,
            createdAt:   row.created_at ?? undefined,
            project_id:  row.project_id ?? null,
          }));

        console.timeEnd("[Gallery] fetch image");
        console.log("[Gallery] loaded count:", loaded.length);

        // Store pagination cursor for infinite scroll.
        setGalleryNextCursor(json.nextCursor ?? null);
        setGalleryHasMore(json.hasMore ?? false);

        // Additive Map merge → write newest 50 to localStorage cache.
        // Cache write lives inside the functional updater so it always reflects
        // the post-merge state (safe: idempotent, no rendering dependency).
        setImages((prev) => {
          if (!loaded || loaded.length === 0) return prev; // never wipe
          const map = new Map(prev.map((a) => [a.id, a]));
          loaded.forEach((a) => map.set(a.id, a));
          const merged = Array.from(map.values()).sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
          });
          // Persist newest 50 so investor-demo cache stays fresh on reload.
          try {
            localStorage.setItem(
              `zencra_gallery_cache_image_${user.id}`,
              JSON.stringify(merged.slice(0, 200)),
            );
          } catch { /* quota exceeded or SSR — safe to skip */ }
          return merged;
        });
      } catch (err) {
        console.error("[ImageStudio] history fetch threw:", err);
        setHistoryError(true);
      } finally {
        setHistoryLoaded(true);
      }
    })();
  // session intentionally omitted — we read the token via supabase.auth.getSession()
  // at fetch time to avoid the INITIAL_SESSION → TOKEN_REFRESHED stale-state race.
  // If the stored token is expired (common after a local dev restart), a single
  // refreshSession() call re-issues a valid token and the fetch is retried once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, historyLoaded]);

  // ── Infinite scroll — load next page when sentinel enters expanded viewport ──

  /** Shape of a single row returned by GET /api/assets */
  type AssetRow = {
    id: string;
    model_key: string;
    prompt: string;
    status: string;           // "ready" | "failed" | "pending"
    url: string | null;
    aspect_ratio: string | null;
    error_message?: string | null;
    project_id?: string | null;
    created_at?: string | null;
  };

  /**
   * Map /api/assets rows to GeneratedImage[].
   * Skips pending rows (in-flight, no URL yet).
   * Maps "ready" → "done", "failed" → "error".
   */
  function mapAssetRows(rows: AssetRow[]): GeneratedImage[] {
    return rows
      .filter((row) => row.status === "ready" || row.status === "failed")
      .map((row) => ({
        id:          row.id,
        assetId:     row.id,
        url:         row.url ?? null,
        prompt:      row.prompt ?? "",
        model:       KEY_TO_MODEL[row.model_key] ?? row.model_key ?? "dalle3",
        aspectRatio: (row.aspect_ratio ?? "Auto") as AspectRatio,
        status:      (row.status === "failed" ? "error" : "done") as GeneratedImage["status"],
        error:       row.status === "failed" ? (row.error_message ?? undefined) : undefined,
        createdAt:   row.created_at ?? undefined,
        project_id:  row.project_id ?? null,
      }));
  }

  /**
   * Fetch the next page of assets using the stored cursor.
   * Guards against concurrent calls via isFetchingMoreRef.
   * Writes merged-newest-50 to localStorage after every successful page.
   */
  const fetchMoreImages = useCallback(async () => {
    if (!user || !galleryHasMore || !galleryNextCursor || isFetchingMoreRef.current) return;

    isFetchingMoreRef.current = true;
    setGalleryFetchingMore(true);

    try {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      const token = freshSession?.access_token;
      if (!token) return;

      const params = new URLSearchParams({
        studio:         "image",
        limit:          "50",
        include_failed: "true",
        cursor:         galleryNextCursor,
      });
      const res = await fetch(`/api/assets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error("[Gallery] fetchMore failed:", res.status);
        return;
      }
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) return;

      const loaded = mapAssetRows(json.data as AssetRow[]);

      setGalleryNextCursor(json.nextCursor ?? null);
      setGalleryHasMore(json.hasMore ?? false);

      setImages((prev) => {
        if (!loaded || loaded.length === 0) return prev;
        const map = new Map(prev.map((a) => [a.id, a]));
        loaded.forEach((a) => map.set(a.id, a));
        const merged = Array.from(map.values()).sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
        try {
          localStorage.setItem(
            `zencra_gallery_cache_image_${user.id}`,
            JSON.stringify(merged.slice(0, 200)),
          );
        } catch { /* quota exceeded or SSR */ }
        return merged;
      });
    } catch (err) {
      console.error("[Gallery] fetchMore threw:", err);
    } finally {
      isFetchingMoreRef.current = false;
      setGalleryFetchingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, galleryHasMore, galleryNextCursor]);

  // Keep fetchMoreRef in sync with the latest fetchMoreImages identity so the
  // IntersectionObserver effect never captures a stale closure.
  useEffect(() => {
    fetchMoreRef.current = fetchMoreImages;
  }, [fetchMoreImages]);

  // IntersectionObserver — watches the sentinel div at the bottom of the gallery.
  // root: galleryScrollRef (the scroll container, not the viewport) so rootMargin
  // applies to the container's visible area. "800px" prefetches one screen ahead.
  useEffect(() => {
    const sentinel = infiniteScrollSentinelRef.current;
    const root     = galleryScrollRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchMoreRef.current();
        }
      },
      { root, rootMargin: "800px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  // galleryScrollRef and infiniteScrollSentinelRef are stable refs — no deps needed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When model changes: reset quality to the new model's default, clear edit image
  // if not needed, and hard-reset aspect ratio if the current AR is not supported.
  useEffect(() => {
    const cm = MODELS.find((m) => m.id === model);
    if (!cm) return;
    const modelKey   = MODEL_TO_KEY[model] ?? "gpt-image-1";
    const dockConfig = getModelDockConfig(modelKey);

    if (dockConfig?.qualityOptions) {
      // Use the model's own declared default; fall back to first option if none marked.
      const defaultOpt = dockConfig.qualityOptions.find((o) => o.isDefault) ?? dockConfig.qualityOptions[0];
      setQuality((defaultOpt?.apiValue as StudioQuality) ?? "medium");
    } else if (dockConfig?.allowedQualities && !dockConfig.allowedQualities.includes(quality as ResolutionQuality)) {
      setQuality(dockConfig.allowedQualities[0]);
    }
    if (!cm.requiresImg) setEditImageUrl("");
    if (cm.requiresImg) setBatchSize(1);  // edit models: 1 at a time

    // ── AR hard-lock per model ────────────────────────────────────────────────
    // If the current AR is not in the target model's supported list, reset to 1:1.
    // Derived from IMAGE_MODEL_CONFIGS — no inline AR arrays needed.
    setAspectRatio((cur) => {
      const supported = dockConfig?.aspectRatios as readonly string[] | undefined;
      if (!supported) return cur;
      return supported.includes(cur) ? cur : "1:1";
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  // ESC closes fullscreen viewer and right panel
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setViewingImage(null);
        setSelectedImage(null);
        setPanelDetails(null);
        setPanelAnimateOpen(false);
        setPanelMetaExpanded(false);
      }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // FIX 3 — Hide navbar + lock scroll while fullscreen is open
  useEffect(() => {
    if (viewingImage) {
      document.body.classList.add("fullscreen-active");
      document.body.style.overflow = "hidden";
    } else {
      document.body.classList.remove("fullscreen-active");
      document.body.style.overflow = "";
    }
    return () => {
      document.body.classList.remove("fullscreen-active");
      document.body.style.overflow = "";
    };
  }, [viewingImage]);

  // FIX 5 — Close handler: reset BOTH fullscreen + panel cleanly
  function handleCloseFullscreen() {
    setViewingImage(null);
    setSelectedImage(null);
  }

  // ── Fetch asset details when a card is selected ───────────────────────────────
  useEffect(() => {
    if (!selectedImage?.assetId || !session?.access_token) {
      setPanelDetails(null);
      return;
    }
    let cancelled = false;
    setPanelLoading(true);
    setPanelDetails(null);

    fetch(`/api/assets/${selectedImage.assetId}/details`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: AssetDetailsResponse | null) => {
        if (!cancelled) setPanelDetails(data);
      })
      .catch(() => { if (!cancelled) setPanelDetails(null); })
      .finally(() => { if (!cancelled) setPanelLoading(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImage?.assetId]);

  const filteredModels = MODELS.filter(
    (m) => m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.provider.toLowerCase().includes(modelSearch.toLowerCase())
  );

  // ── Scroll helpers ─────────────────────────────────────────────────────────
  function isImageElementMostlyVisible(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    return rect.top >= 80 && rect.bottom <= window.innerHeight - 120;
  }

  // ── Generate ───────────────────────────────────────────────────────────────
  const generate = useCallback(async (overrides?: { prompt?: string; model?: string; aspectRatio?: string }) => {
    const rawPrompt   = overrides?.prompt ?? prompt;
    // Enrich with reference-image mapping for backend clarity (UI prompt unchanged)
    const activePrompt = buildEnrichedPrompt(rawPrompt, referenceImages);
    const activeModel  = overrides?.model      ?? model;
    const activeAr     = (overrides?.aspectRatio ?? aspectRatio) as AspectRatio;
    const activeCurrentModel = MODELS.find((m) => m.id === activeModel) ?? MODELS[0];

    if (!rawPrompt.trim()) return;
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
    const isLocked   = BATCH_LOCKED_MODEL_KEYS.has(modelKey);
    const count      = (isAsync || isLocked) ? 1 : Math.min(batchSize, 4);
    // AR routing: NB → mapped string; GPT Image 2 → direct passthrough (10-AR size maps in provider);
    // GPT Image 1 → collapsed 4-ratio set via mapArToApiAr
    const apiAr = isNanoB
      ? mapArForNB(activeAr)
      : modelKey === "gpt-image-2"
        ? activeAr   // GPT Image 2: provider size maps handle all 10 ARs directly
        : mapArToApiAr(activeAr);

    console.log("[ImageStudio] dispatch", { modelKey, prompt: activePrompt, aspectRatio: apiAr, count });

    // ── Upfront balance check — reject early if credits insufficient for full batch ──
    {
      const singleCost = getGenerationCreditCost(modelKey, isTransformMode ? {} : { quality });
      if (singleCost !== null && count > 1) {
        const totalNeeded = singleCost * count;
        try {
          const balRes  = await fetch("/api/credits/balance", {
            headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
          });
          if (balRes.ok) {
            const balData = await balRes.json();
            const available: number = balData?.data?.available ?? Infinity;
            if (available < totalNeeded) {
              showToast(
                `Not enough credits for ${count} images (need ${totalNeeded} cr, have ${available} cr).`,
                "error"
              );
              return;
            }
          }
        } catch {
          // Non-fatal — if balance check fails, let the generation proceed; backend is authoritative
        }
      }
    }

    // Add placeholder(s) immediately so the grid shows shimmer
    // Store rawPrompt (not enriched) so the card displays the user's original text
    const placeholders: GeneratedImage[] = Array.from({ length: count }, (_, i) => ({
      id: `gen-${Date.now()}-${i}`,
      url: null,
      prompt: rawPrompt,
      model:  activeModel,
      aspectRatio: activeAr,
      status: "generating" as const,
    }));
    setImages((prev) => [...placeholders, ...prev]);

    // Scroll to the first placeholder card (card-level precision)
    setTimeout(() => {
      const firstId = placeholders[0]?.id;
      if (firstId) {
        const cardEl = imageCardRefs.current[firstId];
        if (cardEl && !isImageElementMostlyVisible(cardEl)) {
          cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (!cardEl) {
          // Fallback: scroll gallery container to top
          galleryScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    }, 120);
    // Glow pulse: highlight the gallery for 700ms
    setGenerateGlow(true);
    setTimeout(() => setGenerateGlow(false), 700);

    for (let i = 0; i < count; i++) {
      const ph = placeholders[i];
      try {
        const body: Record<string, unknown> = {
          modelKey,
          prompt: activePrompt,
          ...(apiAr ? { aspectRatio: apiAr } : {}),
        };

        if (modelKey === "gpt-image-1") {
          // GPT Image 1.5: quality is the provider-native API value ("low" | "medium" | "high").
          // In transform mode, /v1/images/edits ignores quality — adapter does not forward it to FormData.
          // No translation needed: quality state IS the OpenAI API value for this model.
          // outputCount NOT passed — native n= batching conflicts with the loop strategy.
          // Phase B (single-call native batch + frontend urls[] consumption) is deferred.
          body.providerParams = { quality };
          if (referenceImageUrl) body.imageUrl = referenceImageUrl;
        } else if (modelKey === "gpt-image-2") {
          // GPT Image 2: quality is a Zencra term ("fast" | "cinematic") — NOT an OpenAI value.
          // Translation to OpenAI API values ("low" | "medium") happens in gpt-image.ts
          // via the ZENCRA_TO_OPENAI_QUALITY constant. UI never surfaces OpenAI terminology.
          // In transform mode, quality is still sent — the provider forwards it to /v1/images/edits.
          // outputCount NOT passed — Phase B (native n=) deferred to a dedicated PR.
          body.providerParams = { quality };
          // Reference Stack (Phase 1C): 2 refs → imageUrls[] (scene orchestration);
          // 1 ref → imageUrl (standard single-image edit path).
          // referenceImageUrls is ordered: [0] = subject/identity, [1] = scene/style.
          if (referenceImageUrls.length >= 2) {
            body.imageUrls = referenceImageUrls.slice(0, 2); // hard cap: subject + scene
          } else if (referenceImageUrls.length === 1) {
            body.imageUrl = referenceImageUrls[0];
          }
        } else if (modelKey === "seedream-4-5") {
          // Seedream 4.5: quality is the chip value ("2K" | "4K" | "" for default).
          // The provider maps "2K"→auto_2K and "4K"→auto_4K via V45_QUALITY_TO_SIZE.
          // Empty string means no image_size param → provider default (~1K).
          if (quality) body.providerParams = { quality };
          // Edit mode: attach reference image if present; adapter uses image_urls[] (array).
          if (referenceImageUrl) body.imageUrl = referenceImageUrl;
        } else if (isNanoB) {
          // Nano Banana family: pass quality for resolution selection.
          // outputFormat (JPG/PNG) only sent for NB2 — standard and Pro use NB default.
          // googleSearch is backend-ready but NOT exposed from UI yet (Phase 1 lock).
          const nbParams: Record<string, unknown> = { quality };
          if (modelKey === "nano-banana-2") {
            nbParams.outputFormat = outputFormat;
          }
          if (referenceImageUrls.length > 0) {
            // Multi-reference — pass all CDN URLs; provider builds imageUrls[] array
            nbParams.referenceUrls = referenceImageUrls;
          }
          body.providerParams = nbParams;
        }

        // Attach character consistency when face is locked
        if (characterLock && refFaceDetected && referenceImageUrl) {
          body.characterLock       = true;
          body.characterReference  = referenceImageUrl;
          body.consistencyStrength = consistencyStrength;
        }

        // ── Pre-dispatch safety check: verify displayed cost matches live DB cost ──
        {
          const modelKey = MODEL_TO_KEY[model] ?? "gpt-image-1";
          // In transform mode, quality selector is hidden and pricing is flat — no quality param.
          const displayedCost = getGenerationCreditCost(modelKey, isTransformMode ? {} : { quality });
          try {
            const costsRes = await fetch("/api/credits/model-costs", {
              headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
            });
            if (costsRes.ok) {
              const costsData = await costsRes.json();
              const liveCost: number | undefined = costsData?.data?.[modelKey];
              if (liveCost !== undefined && displayedCost !== null && liveCost !== displayedCost) {
                showToast("Credit estimate changed. Please refresh and try again.", "error");
                setImages((prev) => prev.filter((img) => !placeholders.some((p) => p.id === img.id)));
                return;
              }
            }
          } catch {
            // Non-fatal: if the safety check fails, allow generation to proceed
          }
        }

        const res = await fetch("/api/studio/image/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:  `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify(body),
        });

        // ── HTTP error handling — extract the real server message ─────────────
        if (res.status === 401) {
          // Session expired or missing — don't parse body, just throw clearly
          throw new Error("Session expired — please sign in again");
        }

        const data = await res.json();

        if (res.status === 402) {
          // Insufficient credits / trial exhausted — server returns { error: "...", code: "..." }
          throw new Error(data.error ?? "Insufficient credits — add credits to continue");
        }

        if (res.status === 403 && data.code === "FREE_LIMIT_REACHED") {
          // Free-tier limit hit — redirect to upgrade page, do not show error toast
          router.push("/waitlist");
          return;
        }

        // All other non-ok statuses: surface the server error message directly
        // Server returns { success: false, error: "...", code: "..." }
        if (!res.ok) throw new Error(data.error ?? data.data?.error ?? "Generation failed");

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

            // ── User cancelled this generation — break immediately ──────────
            if (cancelledRef.current.has(ph.id)) {
              cancelledRef.current.delete(ph.id);
              break; // card is already in "error" state from handleCancelGeneration
            }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, user, refreshUser, currentModel, aspectRatio, quality, outputFormat, batchSize, model, editImageUrl, referenceImageUrl, referenceImageUrls, recordFlowStep]);

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

  // ── Cancel flow — marks a generating placeholder as cancelled ────────────────
  // Sets the card to error state immediately; the polling loop checks cancelledRef
  // and breaks out on the next tick, so no further state mutations happen after.
  const handleCancelGeneration = useCallback((id: string) => {
    cancelledRef.current.add(id);
    setImages((prev) =>
      prev.map((img) =>
        img.id === id
          ? {
              ...img,
              status: "error" as const,
              error:  "Generation cancelled. Credits may not be refunded if the job had already started on the provider.",
            }
          : img
      )
    );
  }, []);

  // handleVariation removed — NextStepPanel no longer mounts in Image Studio

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
  };

  const hasImages = images.length > 0;

  // ── Prompt enhancement ────────────────────────────────────────────────────────
  const handleEnhance = useCallback(async () => {
    if (!prompt.trim() || enhancing) return;
    if (!user) { setAuthModal(true); return; }

    // Open panel immediately — show loading state right away
    setEnhancerOpen(true);
    setEnhancedResult(null);
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
        setEnhancedResult(json.enhancedPrompt);
        setEnhanceError(null);
      } else {
        console.warn("[prompt-enhance] failed:", json.error);
        setEnhanceError("Enhancement failed — please try again");
        setEnhancedResult(null);
      }
    } catch (err) {
      console.warn("[prompt-enhance] network error:", err);
      setEnhanceError("Network error — please check your connection");
      setEnhancedResult(null);
    } finally {
      setEnhancing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, enhancing, user, model]);

  /** Apply the enhanced prompt — replaces field + flash highlight */
  const handleApplyEnhanced = useCallback((enhanced: string) => {
    setPrompt(enhanced);
    setEnhancerOpen(false);
    setEnhancedResult(null);
    setPreEnhancePrompt(null);
    // Resize textarea
    if (promptRef.current) {
      promptRef.current.style.height = "auto";
      promptRef.current.style.height = Math.min(promptRef.current.scrollHeight, 140) + "px";
      // Flash highlight
      promptRef.current.style.borderColor = "rgba(99,179,237,0.8)";
      promptRef.current.style.boxShadow   = "0 0 20px rgba(59,130,246,0.3)";
      setTimeout(() => {
        if (promptRef.current) {
          promptRef.current.style.borderColor = "";
          promptRef.current.style.boxShadow   = "";
        }
      }, 600);
    }
  }, []);

  // ── @ mention insertion ────────────────────────────────────────────────────────
  const insertAtMention = useCallback((tag: string) => {
    const textarea = promptRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? prompt.length;
    const end   = textarea.selectionEnd   ?? start;
    const before = prompt.slice(0, start);
    const atStart = before.lastIndexOf("@");
    const newPrompt = (atStart >= 0 ? prompt.slice(0, atStart) : prompt) + tag + " " + prompt.slice(end);
    setPrompt(newPrompt);
    setAtMenuOpen(false);
    setAtMenuFilter("");
    setTimeout(() => {
      if (!textarea) return;
      const newPos = (atStart >= 0 ? atStart : start) + tag.length + 1;
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }, [prompt]);

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
      background: "linear-gradient(165deg, #060810 0%, #080B18 50%, #07091A 100%)",
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
        @keyframes generateGlowPulse {
          0%   { box-shadow: inset 0 0 0 2px rgba(59,130,246,0.4), inset 0 0 28px rgba(59,130,246,0.15); }
          50%  { box-shadow: inset 0 0 0 2px rgba(59,130,246,0.6), inset 0 0 40px rgba(59,130,246,0.22); }
          100% { box-shadow: inset 0 0 0 2px rgba(59,130,246,0), inset 0 0 0 rgba(59,130,246,0); }
        }
        @keyframes refSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes modelSelectPulse {
          0%   { background: rgba(99,102,241,0.18); }
          50%  { background: rgba(99,102,241,0.32); }
          100% { background: rgba(99,102,241,0.18); }
        }
        @keyframes dockBreathGlow {
          0%, 100% {
            box-shadow:
              0 0 0 1px rgba(255,255,255,0.28),
              0 0 22px rgba(255,255,255,0.14),
              0 0 54px rgba(120,180,255,0.08),
              inset 0 1px 0 rgba(255,255,255,0.12);
          }
          50% {
            box-shadow:
              0 0 0 1px rgba(255,255,255,0.42),
              0 0 30px rgba(255,255,255,0.22),
              0 0 72px rgba(120,180,255,0.14),
              inset 0 1px 0 rgba(255,255,255,0.18);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .dock-breath { animation: none !important; }
        }
        .model-dd-scroll::-webkit-scrollbar { width: 4px; }
        .model-dd-scroll::-webkit-scrollbar-track { background: transparent; }
        .model-dd-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .model-dd-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
      `}</style>
      {/* ── TOP BAR WRAPPER — FlowBar hangs below via position:absolute ──── */}
      {/* position:relative here (no zIndex) so FlowBar's zIndex participates  */}
      {/* in the global stacking context, not a nested one.                    */}
      <div style={{ position: "relative" }}>
      {/* ── TOP BAR ───────────────────────────────────────────────────────── */}
      <div style={{
        position: "relative",
        display: "flex", alignItems: "center",
        padding: "0 24px", height: 58, minHeight: 58,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(10,10,10,0.95)", backdropFilter: "blur(16px)",
        zIndex: 10,
      }}>
        {/* Left: gallery tabs — standard mode only */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
          {/* History / Community tabs — standard mode only, Zencra premium style */}
          {studioMode === "standard" && (
            <div style={{ display: "flex", gap: 2, padding: "4px", borderRadius: 11, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {([
                { id: "history",   label: "History",   icon: "⊞" },
                { id: "community", label: "Explore",   icon: "◈" },
              ] as { id: Tab; label: string; icon: string }[]).map(({ id, label, icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    style={{
                      display:       "flex",
                      alignItems:    "center",
                      justifyContent: "center",
                      gap:           6,
                      height:        34,
                      padding:       "0 14px",
                      borderRadius:  8,
                      fontSize:      13,
                      fontWeight:    600,
                      cursor:        "pointer",
                      letterSpacing: "0.01em",
                      lineHeight:    1,
                      transition:    "all 0.15s ease",
                      border:        isActive ? "1px solid rgba(120,160,255,0.2)" : "1px solid transparent",
                      background:    isActive ? "#151D34" : "transparent",
                      color:         isActive ? "#F5F7FF" : "rgba(167,176,197,0.5)",
                    }}
                  >
                    <span style={{ fontSize: 13, lineHeight: 1, opacity: isActive ? 1 : 0.6 }}>{icon}</span>
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Center: studio mode toggle — always absolutely centered in the bar */}
        <div style={{
          position: "absolute",
          left: 0, right: 0,
          display: "flex", justifyContent: "center", alignItems: "center",
          pointerEvents: "none",
        }}>
          {/* ── Studio mode switcher — animated sliding pill toggle ── */}
          <div
            style={{
              pointerEvents:  "auto",
              position:       "relative",
              display:        "inline-flex",
              alignItems:     "center",
              height:         44,
              padding:        0,
              borderRadius:   13,
              background:     "#0B1022",
              border:         "1px solid rgba(120,160,255,0.1)",
              flexShrink:     0,
            }}
          >
            {/* Sliding pill — fills each half, 5px inset from all edges */}
            <div
              aria-hidden="true"
              style={{
                position:   "absolute",
                top:        5,
                bottom:     5,
                left:       studioMode === "standard" ? 5 : "50%",
                right:      studioMode === "standard" ? "50%" : 5,
                borderRadius: 9,
                transition: "left 0.22s cubic-bezier(0.4,0,0.2,1), right 0.22s cubic-bezier(0.4,0,0.2,1), background 0.22s ease, box-shadow 0.22s ease",
                background: studioMode === "standard"
                  ? "#151D34"
                  : "linear-gradient(135deg, rgba(59,130,246,0.26), rgba(79,70,229,0.2))",
                border: studioMode === "standard"
                  ? "1px solid rgba(120,160,255,0.16)"
                  : "1px solid rgba(86,140,255,0.44)",
                boxShadow: studioMode === "creative-director"
                  ? "0 0 14px rgba(86,140,255,0.32), 0 2px 8px rgba(0,0,0,0.3)"
                  : "0 1px 4px rgba(0,0,0,0.2)",
                pointerEvents: "none",
                zIndex:     0,
              }}
            />
            {/* Tab buttons */}
            {([
              { id: "standard",          label: "Quick Gen",         badge: null  },
              { id: "creative-director", label: "Creative Director",  badge: "NEW" },
            ] as const).map(({ id, label, badge }) => {
              const isActive = studioMode === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setStudioMode(id);
                    // Write mode to URL so refreshes, back/forward, and shared links work.
                    const params = new URLSearchParams(searchParams.toString());
                    if (id === "creative-director") {
                      params.set("mode", "creative-director");
                    } else {
                      params.delete("mode");
                    }
                    // Preserve current model param in URL
                    const catalogId = STUDIO_TO_CATALOG[model];
                    if (catalogId) params.set("model", catalogId);
                    else params.delete("model");
                    router.replace(`/studio/image?${params.toString()}`, { scroll: false });
                  }}
                  style={{
                    position:       "relative",
                    zIndex:         1,
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    gap:            6,
                    height:         34,
                    padding:        "0 18px",
                    minWidth:       168,
                    borderRadius:   9,
                    fontSize:       14,
                    fontWeight:     600,
                    cursor:         "pointer",
                    letterSpacing:  "-0.01em",
                    lineHeight:     1,
                    transition:     "color 0.18s ease",
                    border:         "none",
                    background:     "transparent",
                    color:          isActive ? "#F5F7FF" : "rgba(167,176,197,0.45)",
                  }}
                >
                  {label}
                  {badge && (
                    <span style={{
                      fontSize:      9,
                      fontWeight:    800,
                      letterSpacing: "0.07em",
                      background:    "rgba(199,243,107,0.12)",
                      color:         "#C7F36B",
                      border:        "1px solid rgba(199,243,107,0.25)",
                      padding:       "2px 5px",
                      borderRadius:  4,
                      lineHeight:    1,
                    }}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Zoom slider — hidden in Creative Director mode */}
        {studioMode === "standard" && (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Zoom control with % display */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Tooltip content="Zoom out">
              <button
                onClick={() => setZoomLevel(Math.max(1, zoomLevel - 1))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 16, lineHeight: 1, padding: "2px 4px", borderRadius: 4, transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
              >−</button>
              </Tooltip>
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
              <Tooltip content="Zoom in">
              <button
                onClick={() => setZoomLevel(Math.min(5, zoomLevel + 1))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 16, lineHeight: 1, padding: "2px 4px", borderRadius: 4, transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
              >+</button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>{/* end TOP BAR */}

      {/* FlowBar hangs here via position:absolute top:"100%" inside this wrapper */}
      {studioMode === "standard" && <FlowBar />}

      </div>{/* end TOP BAR WRAPPER */}

      {/* ── MAIN CANVAS ───────────────────────────────────────────────────── */}
      {/* ── Creative Director mode — full-width shell, replaces gallery ── */}
      {studioMode === "creative-director" && (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <CDv2Shell onExitDirectorMode={() => {
            setStudioMode("standard");
            // Remove ?mode= from URL so back/forward and refresh land in standard mode
            const params = new URLSearchParams(searchParams.toString());
            params.delete("mode");
            const catalogId = STUDIO_TO_CATALOG[model];
            if (catalogId) params.set("model", catalogId);
            else params.delete("model");
            router.replace(`/studio/image?${params.toString()}`, { scroll: false });
          }} />
        </div>
      )}

      {/* ── Standard Generate mode — gallery + generate bar ── */}
      {/* 3 states:
          1. user logged in + history loading → skeleton shimmer grid
          2. history loaded + no images       → empty state with quick prompts
          3. has images                       → masonry grid with progressive fade-in
      */}
      {studioMode === "standard" && (
      <div
        ref={galleryScrollRef}
        style={{
          flex: 1, overflowY: "auto",
          padding: `0 24px ${isDockCollapsed ? "48px" : "160px"}`,
          animation: generateGlow ? "generateGlowPulse 0.7s ease-out forwards" : "none",
          "--gallery-zoom": zoomLevel / 5,
        } as React.CSSProperties}
      >

        {/* ── STATE 1: History loading — justified skeleton rows ───────────── */}
        {/* Only show when no cache data is available yet (images.length === 0) */}
        {user && !historyLoaded && images.length === 0 && skeletonRows.map((row, ri) => (
          <div
            key={ri}
            style={{
              display: "flex",
              gap: "12px",
              marginBottom: "12px",
              height: row.height,
            }}
          >
            {row.items.map((item, ii) => (
              <div
                key={item.data.id}
                style={{
                  width:    item.width,
                  height:   row.height,
                  flexShrink: 0,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <SkeletonCard index={ri * 8 + ii} />
              </div>
            ))}
          </div>
        ))}

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

        {/* ── STATE 2: Style Preview System — visible only when images.length === 0 ── */}
        {(!user || historyLoaded) && images.length === 0 && !historyError && (() => {
          // ── Hero strip layout config ──────────────────────────────────────
          // Compute per-card rotation / Y offset / z-index from center outward.
          // Works for 3–5 images (clamp to what's configured in heroImages.ts).
          // heroImages is derived from the selected model via useMemo.
          const heroImgs  = heroImages.slice(0, 5);
          const n         = heroImgs.length;
          const centerIdx = Math.floor(n / 2);

          // Per-card base config (indexed 0..n-1)
          const cardConfig = heroImgs.map((_, i) => {
            const offset  = i - centerIdx;          // -2..+2 for n=5
            const rotate  = offset * 3;             // -6..+6 deg
            const baseY   = Math.abs(offset) * 5;  // 0..10 px
            // Layer hierarchy: center=30, adjacent=20, outer=10
            const absOff  = Math.abs(offset);
            const zIdx    = absOff === 0 ? 30 : absOff === 1 ? 20 : 10;
            const scale   = offset === 0 ? 1.05 : 1;
            return { rotate, baseY, zIdx, scale };
          });

          const CARD_W    = 152;   // px — portrait card width
          const CARD_H    = 204;   // px — ~4:3 portrait height
          // Responsive overlap: tighter on smaller screens
          const OVERLAP   = typeof window !== "undefined" && window.innerWidth < 1200 ? 24 : 32;
          const FLOAT_DUR = [7000, 7800, 7200, 8000, 7500]; // ms — stagger per card

          return (
            // key=model forces React to remount the whole empty state when model changes,
            // which re-triggers the fadeIn animation for a smooth cross-fade on model switch.
            <div key={model} style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 0,
              minHeight: "calc(100vh - 58px - 100px)",
              padding: "48px 24px 40px",
              animation: "fadeIn 0.25s ease forwards",
            }}>

              {/* ── Style Preview label ──────────────────────────────────── */}
              <div style={{
                marginBottom: 20,
                animation: "fadeIn 0.4s ease forwards",
                opacity: 0,
              }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 12px",
                  borderRadius: 20,
                  border: "1px solid rgba(37,99,235,0.35)",
                  background: "rgba(37,99,235,0.08)",
                  fontSize: 13, fontWeight: 500,
                  color: "rgba(96,165,250,0.9)",
                  letterSpacing: "0.01em",
                  boxShadow: "0 0 12px rgba(37,99,235,0.12)",
                }}>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>●</span>
                  Preview style: {heroModelLabel}
                </span>
              </div>

              {/* ── Hero image strip ─────────────────────────────────────── */}
              <div style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                marginBottom: 32,
                // Negative margin collapses overlap between cards
                gap: 0,
                animation: "fadeIn 0.4s ease 0.05s forwards",
                opacity: 0,
              }}>
                {heroImgs.map((src, i) => {
                  const cfg     = cardConfig[i];
                  const isHover = hoveredHeroIdx === i;

                  // Hover: lift only — rotation stays constant, no spring overshoot
                  const baseTransform  = `rotate(${cfg.rotate}deg) translateY(${cfg.baseY}px) scale(${cfg.scale})`;
                  const hoverTransform = `rotate(${cfg.rotate}deg) translateY(-6px) scale(1.03)`;

                  const baseShadow  = "0 10px 40px rgba(0,0,0,0.5), 0 0 30px rgba(59,130,246,0.12)";
                  const hoverShadow = "0 20px 60px rgba(0,0,0,0.65), 0 0 40px rgba(59,130,246,0.28)";

                  return (
                    <div
                      key={src}
                      onMouseEnter={() => setHoveredHeroIdx(i)}
                      onMouseLeave={() => setHoveredHeroIdx(null)}
                      style={{
                        // Outer — base tilt + overlap
                        width: CARD_W,
                        height: CARD_H,
                        flexShrink: 0,
                        // Overlap: pull cards left except the first
                        marginLeft: i === 0 ? 0 : -OVERLAP,
                        // Base transform + hover override
                        transform: isHover ? hoverTransform : baseTransform,
                        transition: "transform 0.35s ease-out, box-shadow 0.35s ease",
                        zIndex: isHover ? 40 : cfg.zIdx,
                        borderRadius: 20,
                        overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.08)",
                        boxShadow: isHover ? hoverShadow : baseShadow,
                        cursor: "default",
                        position: "relative",
                      }}
                    >
                      {/* Inner — idle float animation only (no base tilt conflict) */}
                      <div style={{
                        width: "100%", height: "100%",
                        animation: `heroFloat ${FLOAT_DUR[i] ?? 7500}ms ease-in-out ${i * 400}ms infinite`,
                        // Pause float on hover for a clean lift feel
                        animationPlayState: isHover ? "paused" : "running",
                      }}>
                        {/* Placeholder gradient — shows when image hasn't loaded */}
                        <div style={{
                          position: "absolute", inset: 0,
                          background: `linear-gradient(${150 + i * 30}deg,
                            rgba(37,${80 + i * 8},235,0.22) 0%,
                            rgba(${60 + i * 15},${40 + i * 5},180,0.18) 50%,
                            rgba(14,${100 + i * 10},160,0.14) 100%)`,
                          borderRadius: 20,
                        }} />
                        {/* Actual hero image */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`Hero preview ${i + 1}`}
                          style={{
                            width: "100%", height: "100%",
                            objectFit: "cover",
                            display: "block",
                            borderRadius: 20,
                            position: "relative", zIndex: 1,
                          }}
                          onError={(e) => {
                            // Hide broken image — placeholder gradient shows through
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Headline + subtitle ─────────────────────────────────── */}
              <div style={{ textAlign: "center", marginBottom: 20, animation: "fadeIn 0.4s ease 0.12s forwards", opacity: 0 }}>
                <p style={{
                  fontSize: 22, fontWeight: 700,
                  color: "rgba(255,255,255,0.88)",
                  letterSpacing: "-0.01em", marginBottom: 10,
                }}>
                  Describe what you want to create
                </p>
                <p style={{
                  fontSize: 14, color: "rgba(255,255,255,0.3)",
                  maxWidth: 400, lineHeight: 1.65,
                }}>
                  Your generated images will appear here. Type a prompt below and hit Generate — or choose a suggestion to get started.
                </p>
              </div>

              {/* ── Suggestion chips ────────────────────────────────────── */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 560, animation: "fadeIn 0.4s ease 0.22s forwards", opacity: 0 }}>
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
          );
        })()}

        {/* ── STATE 3: CSS grid — left-to-right, newest first ──────────────── */}
        {images.length > 0 && (() => {
          // Compute stable global sequence numbers for done images.
          // images[] is ordered newest-first (prepend for new gens, history appended newest-first).
          // doneImages[0] = newest → gets seqNum = totalDone (highest)
          // doneImages[N-1] = oldest → gets seqNum = 1
          const doneImages = images.filter(i => i.status === "done");
          const totalDone  = doneImages.length;
          const seqMap     = new Map<string, number>(
            doneImages.map((img, i) => [img.id, totalDone - i])
          );

          // Hoist recentImages so both sticky section + rest of IIFE can reference it
          const recentImages = images
            .filter((img) => img.status === "done" && img.url)
            .slice(0, 14);

          return (
            <>
            {/* ── Recently Generated — sticky horizontal filmstrip ──────── */}
            {recentImages.length >= 2 && (
              <div style={{
                position: "sticky", top: 0, zIndex: 20,
                marginLeft: -24, marginRight: -24,
                paddingLeft: 24, paddingRight: 24,
                paddingTop: 12, paddingBottom: 14,
                marginBottom: 10,
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                background: "linear-gradient(180deg, rgba(6,10,20,0.95) 0%, rgba(6,10,20,0.82) 100%)",
              }}>
                <span style={{
                  display: "block", fontSize: 13, fontWeight: 700,
                  letterSpacing: "0.14em", color: "rgba(255,255,255,0.72)",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-body, system-ui, sans-serif)",
                  marginBottom: 10,
                }}>
                  Recently Generated
                </span>
                {/* Wrapper: relative so left/right fade overlays are positioned inside */}
                <div style={{ position: "relative" }}>
                  {/* Left fade — masks scroll start edge */}
                  <div style={{
                    position: "absolute", top: 0, bottom: 0, left: 0,
                    width: 40, zIndex: 2, pointerEvents: "none",
                    background: "linear-gradient(to right, #0b0f1a, transparent)",
                  }} />
                  {/* Right fade — masks scroll end edge */}
                  <div style={{
                    position: "absolute", top: 0, bottom: 0, right: 0,
                    width: 40, zIndex: 2, pointerEvents: "none",
                    background: "linear-gradient(to left, #0b0f1a, transparent)",
                  }} />
                  <div
                    style={{
                      display: "flex", gap: 6, overflowX: "auto",
                      scrollbarWidth: "none",
                      scrollBehavior: "smooth",
                      // momentum scrolling on iOS / Safari
                      WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
                    } as React.CSSProperties}
                  >
                    {recentImages.map((img, index) => {
                      // Prefer real measured ratio (imageRatios), fall back to stored
                      // string, fall back to cinematic default — same priority as justifiedLayout.
                      const ar = imageRatios[img.id] ?? (() => {
                        if (img.aspectRatio && img.aspectRatio !== "Auto") {
                          const parts = img.aspectRatio.split(":");
                          if (parts.length === 2) {
                            const w = Number(parts[0]);
                            const h = Number(parts[1]);
                            if (w > 0 && h > 0) return w / h;
                          }
                        }
                        return 16 / 9;
                      })();
                      const thumbW = Math.round(100 * ar);
                      return (
                        <div
                          key={img.id}
                          style={{
                            position: "relative",
                            width: thumbW, height: 100, flexShrink: 0,
                            cursor: "pointer", overflow: "hidden",
                            borderRadius: 0,
                            transition: "transform 0.15s ease",
                            background: "rgba(255,255,255,0.04)",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.04)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
                          onClick={() => {
                            // Clear any stale selectedImage so no ghost premium panel
                            // appears behind the fullscreen viewer when browsing filmstrip
                            setSelectedImage(null);
                            setPanelDetails(null);
                            setViewingImage(img);
                          }}
                        >
                          <img
                            src={img.url!}
                            alt={img.prompt.slice(0, 60)}
                            loading="lazy"
                            style={{
                              width: "100%", height: "100%",
                              objectFit: "cover", display: "block",
                            }}
                          />
                          {/* NEW badge — first item only */}
                          {index === 0 && (
                            <div style={{
                              position: "absolute", top: 6, left: 6,
                              fontSize: 9, fontWeight: 700,
                              letterSpacing: "0.08em",
                              padding: "2px 6px",
                              background: "rgba(255,255,255,0.12)",
                              backdropFilter: "blur(6px)",
                              color: "rgba(255,255,255,0.85)",
                              textTransform: "uppercase",
                              lineHeight: 1.4,
                              pointerEvents: "none",
                            }}>
                              NEW
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Working Canvas label */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              marginBottom: 14,
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{
                  fontSize: 13, fontWeight: 700, letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.72)", textTransform: "uppercase",
                  fontFamily: "var(--font-body, system-ui, sans-serif)",
                }}>
                  Working Canvas
                </span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.58)", letterSpacing: "0.01em", lineHeight: 1.3, marginTop: 4 }}>
                  Recent creations
                </span>
              </div>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.14)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.68)", letterSpacing: "0.02em", fontFamily: "var(--font-body, system-ui, sans-serif)" }}>
                {images.filter(i => i.status === "done").length} image{images.filter(i => i.status === "done").length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* ── Justified rows — Higgsfield / Google Photos layout ─────── */}
            {justifiedRows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                style={{
                  display: "flex",
                  gap: "12px",
                  marginBottom: "12px",
                  height: row.height,
                }}
              >
              {row.items.map(({ data: img, width }, index) => {
                const globalIndex = justifiedRows
                  .slice(0, rowIndex)
                  .reduce((sum, r) => sum + r.items.length, 0) + index;
                return (
                <div
                  key={img.id}
                  ref={el => { imageCardRefs.current[img.id] = el; }}
                  className="img-card-wrapper"
                  style={{
                    width,
                    height:     row.height,
                    flexShrink: 0,
                    position:   "relative",
                    // overflow intentionally omitted — MediaCard's inner containers
                    // already clip the image. Removing it here lets box-shadow and
                    // hover elevation (translateY) escape the tile boundary.
                    opacity:    0,
                    animation:  `fadeIn 0.4s ease ${img.status === "generating" ? 0 : Math.min(globalIndex, 20) * 40}ms forwards`,
                    outline:       selectedImageIds.has(img.id) ? "2px solid rgba(37,99,235,0.7)" : "none",
                    outlineOffset: "-2px",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform  = "translateY(-2px)";
                    e.currentTarget.style.boxShadow  = "0 10px 30px rgba(0,0,0,0.28)";
                    e.currentTarget.style.zIndex     = "1";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform  = "";
                    e.currentTarget.style.boxShadow  = "";
                    e.currentTarget.style.zIndex     = "";
                  }}
                >
                  {/* ── Checkbox — top-left, clear of badge ── */}
                  {img.status === "done" && (
                    <div
                      className="img-checkbox"
                      style={{
                        position: "absolute", top: 12, left: 12, zIndex: 10,
                        opacity: selectedImageIds.has(img.id) ? 1 : 0,
                        transition: "opacity 0.15s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedImageIds.has(img.id)}
                        onChange={() => {
                          setSelectedImageIds(prev => {
                            const next = new Set(prev);
                            if (next.has(img.id)) next.delete(img.id); else next.add(img.id);
                            return next;
                          });
                        }}
                        onClick={e => e.stopPropagation()}
                        style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#2563EB" }}
                      />
                    </div>
                  )}

                  {/* ── "In Project" badge — only when project_id exists ── */}
                  {img.status === "done" && img.project_id && (
                    <div
                      style={{
                        position: "absolute", top: 12, left: 48, zIndex: 10,
                      }}
                      onClick={e => { e.stopPropagation(); router.push(`/dashboard/project/${img.project_id}`); }}
                      title="Open project"
                    >
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px 7px", borderRadius: 20,
                        background: "rgba(59,130,246,0.18)",
                        color: "#60a5fa",
                        fontSize: 10, fontWeight: 600, letterSpacing: "0.03em",
                        backdropFilter: "blur(4px)",
                        cursor: "pointer",
                        border: "1px solid rgba(96,165,250,0.2)",
                      }}>
                        In Project
                      </span>
                    </div>
                  )}

                  <ImageCard
                    img={img}
                    hideHoverActions={zoomLevel < ACTIONS_ZOOM_THRESHOLD}
                    seqNumber={seqMap.get(img.id) ?? (globalIndex + 1)}
                    onRegenerate={(p, m, ar) => generate({ prompt: p, model: m, aspectRatio: ar })}
                    onReusePrompt={(p) => {
                      setPrompt(p);
                      promptRef.current?.focus();
                    }}
                    onOpen={() => {
                      if (img.status === "done") {
                        setSelectedImage(img);
                        setViewingImage(img);
                        setPanelDetails(null);
                        setPanelAnimateOpen(false);
                        setPanelMetaExpanded(false);
                      }
                    }}
                    onDelete={handleDeleteCard}
                    onEnhance={() => showToast("✨ Topaz enhancement is coming soon")}
                    onCancel={img.status === "generating" ? () => setCancelConfirmId(img.id) : undefined}
                    onOpenWorkflow={(flow) => openVideoWorkflow(img, flow)}
                    onImageLoad={(e) => {
                      const el = e.currentTarget;
                      if (el.naturalWidth && el.naturalHeight) {
                        setImageRatios(prev => ({
                          ...prev,
                          [img.id]: el.naturalWidth / el.naturalHeight,
                        }));
                      }
                    }}
                  />
                  {/* Sequence number now rendered inside MediaCard below the action strip */}
                </div>
              );
              })}
              </div>
            ))}

            {/* ── Infinite scroll sentinel + end-state ──────────────────── */}
            {/* Sentinel: observed by IntersectionObserver with root=galleryScrollRef,
                rootMargin="800px" — fires when within 800px of becoming visible     */}
            <div ref={infiniteScrollSentinelRef} style={{ height: 1 }} />

            {/* Loading spinner — visible while the next page is being fetched */}
            {galleryFetchingMore && (
              <div style={{
                display: "flex", justifyContent: "center", alignItems: "center",
                gap: 8, padding: "24px 0", color: "rgba(255,255,255,0.3)",
                fontSize: 12, letterSpacing: "0.05em",
              }}>
                <div style={{
                  width: 14, height: 14, borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.12)",
                  borderTopColor: "rgba(255,255,255,0.5)",
                  animation: "spin 0.7s linear infinite",
                }} />
                Loading more…
              </div>
            )}

            {/* End-of-list indicator — shown once all pages are exhausted */}
            {!galleryHasMore && !galleryFetchingMore && images.filter(i => i.status === "done").length > 0 && (
              <div style={{
                textAlign: "center", padding: "28px 0 16px",
                fontSize: 11, color: "rgba(255,255,255,0.16)",
                letterSpacing: "0.06em", textTransform: "uppercase",
              }}>
                All images loaded
              </div>
            )}
            </>
          );
        })()}
      </div>
      )} {/* end studioMode === "standard" gallery scroll div */}

      {/* ── BOTTOM PROMPT BAR — standard mode only ────────────────────────── */}
      {studioMode === "standard" && (<>
      <div style={{
        position: "fixed", bottom: 16, left: 0, right: 0,
        padding: "0 20px",
        zIndex: 50,
        pointerEvents: "none",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto", pointerEvents: "all" }}>
          {/* Collapse toggle */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 0 }}>
            <button
              onClick={() => setIsDockCollapsed(v => !v)}
              style={{
                background: "rgba(6,10,24,0.9)", backdropFilter: "blur(8px)",
                border: "1px solid rgba(96,165,250,0.25)",
                borderRadius: "10px 10px 0 0",
                padding: "4px 20px 3px",
                color: isDockCollapsed ? "rgba(96,165,250,0.8)" : "rgba(255,255,255,0.45)",
                fontSize: 10, fontWeight: 700, cursor: "pointer",
                letterSpacing: "0.08em", textTransform: "uppercase",
                transition: "all 0.15s",
                boxShadow: "0 -4px 16px rgba(37,99,235,0.12)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = "#93C5FD";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(96,165,250,0.5)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = isDockCollapsed ? "rgba(96,165,250,0.8)" : "rgba(255,255,255,0.45)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(96,165,250,0.25)";
              }}
            >
              {isDockCollapsed ? "▲  Show Dock" : "▼  Hide Dock"}
            </button>
          </div>
          {/* Collapse animation wrapper — no overflow:hidden to avoid clipping dropdowns */}
          <div style={{
            maxHeight: isDockCollapsed ? 0 : 700,
            opacity: isDockCollapsed ? 0 : 1,
            transition: "max-height 0.35s ease, opacity 0.22s ease",
            pointerEvents: isDockCollapsed ? "none" : "auto",
          }}>
        <div
          className="dock-breath"
          style={{
          background: "rgba(4,8,20,0.98)", backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.75)",
          borderRadius: 20,
          boxShadow: [
            "0 0 0 1px rgba(255,255,255,0.35)",
            "0 0 25px rgba(255,255,255,0.18)",
            "0 0 60px rgba(120,180,255,0.10)",
            "inset 0 1px 0 rgba(255,255,255,0.15)",
          ].join(", "),
          animation: "dockBreathGlow 8s ease-in-out infinite",
          overflow: "visible",
          pointerEvents: "all",
        }}>
          {/* ── Hidden file input for reference upload ─────────────────────── */}
          <input
            ref={referenceInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !user) return;
              e.target.value = "";

              if (referenceImages.length >= maxRefs) {
                showToast(`This model supports up to ${maxRefs} reference image${maxRefs === 1 ? "" : "s"}`);
                return;
              }

              const id = `ref-${Date.now()}-${Math.random()}`;
              const blobPreview = URL.createObjectURL(file);
              // Default role: first image → character, subsequent → environment.
              setReferenceImages(prev => [
                ...prev,
                { id, previewUrl: blobPreview, cdnUrl: "", uploading: true, role: prev.length === 0 ? "character" : "environment" },
              ]);

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
                  setReferenceImages(prev => prev.map(r => r.id === id ? { ...r, cdnUrl: json.url as string, uploading: false } : r));
                } else {
                  URL.revokeObjectURL(blobPreview);
                  setReferenceImages(prev => prev.filter(r => r.id !== id));
                  showToast("Upload failed — please try again", "error");
                }
              } catch {
                URL.revokeObjectURL(blobPreview);
                setReferenceImages(prev => prev.filter(r => r.id !== id));
                showToast("Upload failed — network error", "error");
              }
            }}
          />

          {/* ── Thumbnail strip — slides in above prompt row when images uploaded ── */}
          {referenceImages.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "12px 16px 0",
              animation: "refSlideIn 0.18s ease",
            }}>
              {referenceImages.map((ref, idx) => {
                const isActive = activeRefIndices.has(idx);
                const rc = ROLE_CONFIG[ref.role];
                return (
                <div
                  key={ref.id}
                  style={{ position: "relative", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
                  onMouseEnter={() => setHoverRefIdx(idx)}
                  onMouseLeave={() => setHoverRefIdx(null)}
                >
                  {/* ── Premium hover preview — glass card floats above thumbnail ── */}
                  {hoverRefIdx === idx && (ref.cdnUrl || ref.previewUrl) && !ref.uploading && (
                    <div style={{
                      position: "absolute",
                      bottom: "calc(100% + 12px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 200,
                      pointerEvents: "none",
                      animation: "refSlideIn 0.12s ease",
                      width: 132,
                      background: "rgba(8,10,20,0.92)",
                      backdropFilter: "blur(18px)",
                      WebkitBackdropFilter: "blur(18px)",
                      border: `1px solid ${roleColor(rc.color, 0.55)}`,
                      borderRadius: 10,
                      boxShadow: `0 16px 40px rgba(0,0,0,0.45), 0 0 24px ${roleColor(rc.color, 0.28)}`,
                      padding: "8px 8px 6px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 5,
                    }}>
                      {/* Header label — IMG N · Role */}
                      <div style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.07em",
                        color: roleColor(rc.color, 0.9),
                        textTransform: "uppercase" as const,
                        alignSelf: "flex-start",
                        paddingLeft: 1,
                      }}>
                        IMG {idx + 1} · {rc.label}
                      </div>
                      {/* Square image */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ref.cdnUrl || ref.previewUrl}
                        alt={`Preview ${idx + 1}`}
                        style={{
                          width: 112, height: 112, objectFit: "cover",
                          borderRadius: 6,
                          display: "block",
                          flexShrink: 0,
                        }}
                      />
                      {/* Caret pointer */}
                      <div style={{
                        position: "absolute",
                        bottom: -6, left: "50%", transform: "translateX(-50%)",
                        width: 0, height: 0,
                        borderLeft: "7px solid transparent",
                        borderRight: "7px solid transparent",
                        borderTop: `7px solid ${roleColor(rc.color, 0.55)}`,
                      }} />
                    </div>
                  )}

                  {/* ── Image chip wrapper (52 × 52) ─────────────────────── */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ref.previewUrl || ref.cdnUrl}
                      alt={`Reference ${idx + 1}`}
                      style={{
                        width: 52, height: 52, borderRadius: 10, objectFit: "cover", display: "block",
                        border: ref.cdnUrl
                          ? `1.5px solid ${roleColor(rc.color, isActive ? 0.9 : 0.45)}`
                          : "1px solid rgba(255,255,255,0.2)",
                        opacity: ref.uploading ? 0.45 : 1,
                        // Role-colored glow intensifies when @-mentioned in prompt
                        boxShadow: isActive
                          ? `0 0 0 1.5px ${roleColor(rc.color, 0.65)}, 0 0 12px ${roleColor(rc.color, 0.4)}`
                          : "none",
                        transform: isActive ? "scale(1.04)" : "scale(1)",
                        transition: "box-shadow 0.22s ease, transform 0.22s ease, opacity 0.2s, border-color 0.22s ease",
                      }}
                    />
                    {/* IMG N label — bottom gradient overlay */}
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      background: "linear-gradient(to top, rgba(0,0,0,0.80) 0%, transparent 100%)",
                      borderRadius: "0 0 10px 10px",
                      padding: "6px 4px 3px",
                      textAlign: "center",
                      fontSize: 8, fontWeight: 800, letterSpacing: "0.07em",
                      color: isActive ? roleColor(rc.color, 1) : "rgba(255,255,255,0.97)",
                      pointerEvents: "none",
                      transition: "color 0.22s ease",
                      textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                    }}>
                      IMG {idx + 1}
                    </div>
                    {/* Upload spinner */}
                    {ref.uploading && (
                      <div style={{ position: "absolute", inset: 0, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(96,165,250,0.25)", borderTopColor: "#60A5FA", animation: "spin 0.7s linear infinite" }} />
                      </div>
                    )}
                    {/* Green check */}
                    {ref.cdnUrl && !ref.uploading && (
                      <div style={{ position: "absolute", bottom: -4, right: -4, width: 14, height: 14, borderRadius: "50%", background: "rgba(34,197,94,0.9)", border: "1.5px solid rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#fff", lineHeight: 1, pointerEvents: "none" }}>✓</div>
                    )}
                    {/* Remove — strips @imgN from prompt + renumbers subsequent tags */}
                    <button
                      onClick={() => {
                        const removedN = idx + 1;
                        const tagRe = new RegExp(`@img${removedN}\\b`, "gi");
                        const tagInPrompt = tagRe.test(prompt);
                        let updated = prompt.replace(new RegExp(`@img${removedN}\\b`, "gi"), "");
                        for (let k = removedN + 1; k <= referenceImages.length; k++) {
                          updated = updated.replace(new RegExp(`@img${k}\\b`, "gi"), `@img${k - 1}`);
                        }
                        updated = updated.replace(/\s{2,}/g, " ").trim();
                        setPrompt(updated);
                        if (tagInPrompt) showToast(`@img${removedN} removed from prompt`, "info");
                        URL.revokeObjectURL(ref.previewUrl);
                        setReferenceImages(prev => prev.filter(r => r.id !== ref.id));
                        setRoleMenuIdx(null);
                      }}
                      style={{ position: "absolute", top: -6, right: -6, width: 16, height: 16, borderRadius: "50%", background: "rgba(239,68,68,0.9)", border: "none", color: "#fff", fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                    >×</button>
                  </div>

                  {/* ── Role chip — compact 52px-wide selector below the image ── */}
                  <div style={{ position: "relative", width: 52 }}>
                    <button
                      onClick={() => setRoleMenuIdx(roleMenuIdx === idx ? null : idx)}
                      onBlur={() => setTimeout(() => setRoleMenuIdx(prev => prev === idx ? null : prev), 160)}
                      style={{
                        width: "100%", height: 17,
                        borderRadius: 5,
                        border: `1px solid ${roleColor(rc.color, 0.32)}`,
                        background: rc.bg,
                        color: roleColor(rc.color, 0.9),
                        fontSize: 8, fontWeight: 700, letterSpacing: "0.04em",
                        cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 2,
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                    >
                      {rc.short}
                      <svg width="6" height="4" viewBox="0 0 6 4" style={{ opacity: 0.7 }}>
                        <path d="M0 0l3 4 3-4z" fill="currentColor" />
                      </svg>
                    </button>

                    {/* Role dropdown — opens upward, 5 options */}
                    {roleMenuIdx === idx && (
                      <div style={{
                        position: "absolute",
                        bottom: "calc(100% + 5px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 150,
                        background: "rgba(8,10,20,0.97)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 10,
                        overflow: "hidden",
                        zIndex: 300,
                        backdropFilter: "blur(24px)",
                        WebkitBackdropFilter: "blur(24px)",
                        animation: "refSlideIn 0.12s ease",
                        boxShadow: "0 12px 48px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)",
                      }}>
                        {ROLES.map(role => {
                          const r = ROLE_CONFIG[role];
                          const isSelected = ref.role === role;
                          return (
                            <button
                              key={role}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setReferenceImages(prev => prev.map((ri, i) => i === idx ? { ...ri, role } : ri));
                                setRoleMenuIdx(null);
                              }}
                              style={{
                                width: "100%", padding: "10px 12px",
                                border: "none",
                                borderLeft: isSelected ? `2px solid ${roleColor(r.color, 0.8)}` : "2px solid transparent",
                                background: isSelected ? r.bg : "transparent",
                                color: isSelected ? roleColor(r.color, 1) : "rgba(255,255,255,0.85)",
                                fontSize: 13, fontWeight: isSelected ? 700 : 600,
                                cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 9,
                                textAlign: "left" as const,
                                transition: "background 0.1s, color 0.1s",
                                lineHeight: 1,
                              }}
                              onMouseEnter={e => {
                                if (!isSelected) {
                                  (e.currentTarget as HTMLElement).style.background = roleColor(r.color, 0.1);
                                  (e.currentTarget as HTMLElement).style.color = roleColor(r.color, 0.95);
                                }
                              }}
                              onMouseLeave={e => {
                                if (!isSelected) {
                                  (e.currentTarget as HTMLElement).style.background = "transparent";
                                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)";
                                }
                              }}
                            >
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: roleColor(r.color, isSelected ? 1 : 0.8), flexShrink: 0 }} />
                              {r.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                );
              })}

              {/* Character lock — lives in thumbnail strip */}
              {referenceImages[0]?.cdnUrl && refFaceDetected && (
                <Tooltip content="Lock character face identity across generations">
                  <button
                    onClick={() => setCharacterLock((prev) => !prev)}
                    style={{
                      height: 20, padding: "0 7px", borderRadius: 10,
                      border: characterLock ? "1px solid rgba(245,158,11,0.6)" : "1px solid rgba(255,255,255,0.12)",
                      background: characterLock ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.05)",
                      color: characterLock ? "rgba(252,211,77,0.95)" : "rgba(160,175,205,0.7)",
                      fontSize: 9, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const,
                      display: "flex", alignItems: "center", gap: 3,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: 9 }}>{characterLock ? "◉" : "○"}</span>
                    Lock
                  </button>
                </Tooltip>
              )}

              {/* @ hint when images exist */}
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginLeft: 2, letterSpacing: "0.02em" }}>
                type @ to reference
              </span>
            </div>
          )}

          {/* ── Prompt row — add button always fixed, textarea never shifts ──── */}
          <div style={{ display: "flex", alignItems: "flex-start", padding: "14px 16px 0", gap: 0 }}>
            {/* Add button — manual hover tooltip so it reliably hides when file dialog opens */}
            <div
              style={{ position: "relative", flexShrink: 0, marginRight: 10, marginTop: 2 }}
              onMouseEnter={() => setAddBtnHovered(true)}
              onMouseLeave={() => setAddBtnHovered(false)}
            >
              <button
                onClick={() => {
                  setAddBtnHovered(false); // immediately kill tooltip before dialog steals focus
                  if (referenceImages.length < maxRefs) referenceInputRef.current?.click();
                }}
                style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: referenceImages.length >= maxRefs ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
                  border: referenceImages.length >= maxRefs ? "1.5px dashed rgba(255,255,255,0.1)" : "1.5px dashed rgba(60,100,255,0.35)",
                  color: referenceImages.length >= maxRefs ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.4)",
                  cursor: referenceImages.length >= maxRefs ? "not-allowed" : "pointer",
                  fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                }}
                onMouseEnter={e => { if (referenceImages.length < maxRefs) { (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.12)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(60,100,255,0.6)"; (e.currentTarget as HTMLElement).style.color = "#60A5FA"; } }}
                onMouseLeave={e => { if (referenceImages.length < maxRefs) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(60,100,255,0.35)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; } }}
              >+</button>
              {/* Inline tooltip — only visible while hovering, reliably dismissed on click */}
              {addBtnHovered && (
                <div style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  whiteSpace: "nowrap" as const,
                  background: "rgba(10,12,22,0.96)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 7,
                  padding: "5px 10px",
                  fontSize: 11, fontWeight: 500,
                  color: "rgba(255,255,255,0.85)",
                  pointerEvents: "none",
                  zIndex: 400,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}>
                  {referenceImages.length >= maxRefs
                    ? `Max ${maxRefs} reference image${maxRefs === 1 ? "" : "s"} reached`
                    : `Add reference image (${referenceImages.length}/${maxRefs})`}
                </div>
              )}
            </div>

            {/* Textarea wrapper — contains @ mention menu */}
            <div style={{ flex: 1, position: "relative" }}>
              {/* @ mention suggestion menu */}
              {atMenuOpen && referenceImages.length > 0 && (() => {
                const allTags = referenceImages.map((ref, i) => ({
                  tag:   `@img${i + 1}`,
                  label: `Image ${i + 1} · ${ROLE_CONFIG[ref.role].label}`,
                  color: ROLE_CONFIG[ref.role].color,
                }));
                const filtered = atMenuFilter ? allTags.filter(({ tag }) => tag.includes(atMenuFilter)) : allTags;
                if (filtered.length === 0) return null;
                return (
                  <div style={{
                    position: "absolute", bottom: "calc(100% + 6px)", left: 0,
                    background: "#141420", border: "1px solid rgba(96,165,250,0.25)",
                    borderRadius: 10, overflow: "hidden", zIndex: 300,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.7)",
                    minWidth: 180,
                  }}>
                    <div style={{ padding: "6px 10px 4px", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const }}>
                      Reference images
                    </div>
                    {filtered.map(({ tag, label, color }) => (
                      <button
                        key={tag}
                        onMouseDown={(e) => { e.preventDefault(); insertAtMention(tag); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", border: "none", background: "transparent", color: "#fff", cursor: "pointer", transition: "background 0.12s", textAlign: "left" as const }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        {/* Role-colored dot + @tag */}
                        <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 62 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: roleColor(color, 0.9), flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: roleColor(color, 0.95), fontWeight: 700 }}>{tag}</span>
                        </span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{label}</span>
                      </button>
                    ))}
                  </div>
                );
              })()}

              <textarea
                ref={promptRef}
                value={prompt}
                onChange={(e) => {
                  const val = e.target.value;
                  setPrompt(val);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
                  if (preEnhancePrompt !== null) setPreEnhancePrompt(null);
                  if (enhanceError !== null) setEnhanceError(null);
                  // @ mention detection
                  const cursorPos = e.target.selectionStart ?? val.length;
                  const textBeforeCursor = val.slice(0, cursorPos);
                  const atMatch = textBeforeCursor.match(/@(\w*)$/);
                  if (atMatch && referenceImages.length > 0) {
                    setAtMenuOpen(true);
                    setAtMenuFilter((atMatch[1] ?? "").toLowerCase());
                  } else {
                    setAtMenuOpen(false);
                    setAtMenuFilter("");
                  }
                }}
                onKeyDown={(e) => {
                  if (atMenuOpen && e.key === "Escape") { setAtMenuOpen(false); return; }
                  handleKeyDown(e);
                }}
                onBlur={() => { setTimeout(() => setAtMenuOpen(false), 150); }}
                placeholder="Describe the scene you imagine…"
                rows={1}
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  color: enhancing ? "rgba(255,255,255,0.45)" : "#fff",
                  fontSize: 15, lineHeight: 1.6, resize: "none",
                  padding: "6px 14px 6px 0", fontFamily: "var(--font-body, system-ui)",
                  minHeight: 44, maxHeight: 140, boxSizing: "border-box",
                  transition: "color 0.2s",
                }}
              />
            </div>
          </div>

          {/* ── Prompt Enhancer Panel ───────────────────────────────────────── */}
          {enhancerOpen && (
            <div style={{ padding: "0 14px" }}>
              <PromptEnhancerPanel
                open={enhancerOpen}
                originalPrompt={preEnhancePrompt ?? prompt}
                enhancedPrompt={enhancedResult}
                isLoading={enhancing}
                onEnhance={handleEnhance}
                onApply={handleApplyEnhanced}
                onClose={() => {
                  setEnhancerOpen(false);
                  setEnhancedResult(null);
                  setPreEnhancePrompt(null);
                }}
              />
            </div>
          )}

          {/* ── @Handle identity lock badges ─────────────────────────────────── */}
          {detectedHandles.length > 0 && (
            <>
              <style>{`
                @keyframes lockIn {
                  from { transform: scale(0.96); opacity: 0.55; }
                  to   { transform: scale(1);    opacity: 1;    }
                }
              `}</style>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 6,
                padding: "0 14px 10px",
              }}>
                {detectedHandles.map(handle => {
                  const avatarUrl = handleAvatarUrls[handle] ?? null;
                  return (
                    <div
                      key={handle}
                      title={`@${handle} · Identity Locked`}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: avatarUrl ? "3px 10px 3px 4px" : "4px 10px",
                        borderRadius: 20,
                        background: "rgba(245,158,11,0.08)",
                        border: "1px solid rgba(245,158,11,0.28)",
                        // Inset line: contained, not floating
                        boxShadow: "inset 0 0 0 1px rgba(245,158,11,0.10)",
                        fontSize: 11, letterSpacing: "0.01em",
                      }}
                    >
                      {/* Avatar — who (face) */}
                      {avatarUrl && (
                        <img
                          src={avatarUrl}
                          alt={`@${handle}`}
                          style={{
                            width: 20, height: 20,
                            borderRadius: 0,        // sharp corners — design system rule
                            objectFit: "cover",
                            border: "1px solid rgba(255,255,255,0.14)",
                            flexShrink: 0,
                            display: "block",
                          }}
                        />
                      )}
                      {/* Lock — state (trust signal). Smaller + dimmer when avatar present. */}
                      <span style={{
                        fontSize: avatarUrl ? 8 : 9,
                        color: avatarUrl ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.48)",
                        lineHeight: 1,
                        display: "inline-block",
                        animation: "lockIn 140ms ease-out forwards",
                        flexShrink: 0,
                      }}>🔒</span>
                      {/* handle — primary, full white, truncated at ~20 chars */}
                      <span style={{
                        fontWeight: 700, color: "#fff",
                        maxWidth: 160, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>@{handle}</span>
                      {/* status label — clearly secondary, never wraps */}
                      <span style={{
                        fontWeight: 500, color: "rgba(255,255,255,0.48)",
                        fontSize: 10, flexShrink: 0,
                      }}>· Identity Locked</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Controls row */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "10px 14px 14px", flexWrap: "wrap",
          }}>
            {/* Model selector */}
            <div data-dd style={{ position: "relative" }}>
              {/* ── Dock chip ── */}
              <button
                onClick={() => { closeDropdowns(); setShowModelPicker((v) => !v); setModelSearch(""); }}
                style={{ ...ctrlBtn(showModelPicker), gap: 7, padding: "5px 10px 5px 6px" }}
                title="Change model"
              >
                <ModelLogo type={currentModel.icon} size={22} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{currentModel.name}</span>
                {currentModel.badge && currentModel.available && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 4,
                    background: modelBadgeBg(currentModel.badge),
                    color: modelBadgeFg(currentModel.badge),
                    letterSpacing: "0.06em",
                  }}>{currentModel.badge}</span>
                )}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{
                  marginLeft: 1, opacity: 0.45,
                  transform: showModelPicker ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}>
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* ── Premium dropdown panel ── */}
              {showModelPicker && (() => {
                const liveModels   = filteredModels.filter(m =>  m.available);
                const soonModels   = filteredModels.filter(m => !m.available);
                const noResults    = liveModels.length === 0 && soonModels.length === 0;

                const renderRow = (m: StudioModel) => {
                  const isSelected = model === m.id;
                  const isDisabled = !m.available;
                  return (
                    <button
                      key={m.id}
                      disabled={isDisabled}
                      aria-disabled={isDisabled}
                      onClick={() => {
                        if (!isDisabled) {
                          setModel(m.id);
                          closeDropdowns();
                          // Write model selection to URL (use safe catalog key, never expose "dalle3")
                          const catalogId = STUDIO_TO_CATALOG[m.id];
                          const params = new URLSearchParams(searchParams.toString());
                          if (catalogId) params.set("model", catalogId);
                          else params.delete("model");
                          router.replace(`/studio/image?${params.toString()}`, { scroll: false });
                        }
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        width: "100%", padding: "10px 12px", borderRadius: 10,
                        border: "none", textAlign: "left", cursor: isDisabled ? "not-allowed" : "pointer",
                        background: isSelected ? "rgba(99,102,241,0.14)" : "transparent",
                        boxShadow: isSelected ? "inset 3px 0 0 rgba(99,102,241,0.7)" : "none",
                        opacity: isDisabled ? 0.52 : 1,
                        transition: "background 0.12s, box-shadow 0.12s",
                      }}
                      onMouseEnter={e => {
                        if (!isDisabled && !isSelected)
                          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                      }}
                      onMouseLeave={e => {
                        if (!isSelected)
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      <ModelLogo type={m.icon} size={38} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.01em" }}>
                            {m.name}
                          </span>
                          {m.badge && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                              background: modelBadgeBg(m.badge), color: modelBadgeFg(m.badge),
                              letterSpacing: "0.07em", textTransform: "uppercase",
                            }}>{m.badge}</span>
                          )}
                        </div>
                        <div style={{
                          fontSize: 13, color: "rgba(255,255,255,0.45)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{m.description}</div>
                      </div>
                      {isSelected && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                          <path d="M3 8L6.5 11.5L13 5" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  );
                };

                return (
                  <div style={{
                    position: "absolute", bottom: "calc(100% + 8px)", left: 0,
                    background: "rgba(9,11,20,0.97)",
                    backdropFilter: "blur(24px)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 14, zIndex: 200, width: 460,
                    display: "flex", flexDirection: "column",
                    boxShadow: [
                      "0 0 0 1px rgba(59,130,246,0.08)",
                      "0 32px 80px rgba(0,0,0,0.88)",
                      "0 8px 24px rgba(0,0,0,0.6)",
                      "inset 0 1px 0 rgba(255,255,255,0.06)",
                    ].join(", "),
                    overflow: "hidden",
                  }}>
                    {/* Search bar */}
                    <div style={{ padding: "12px 12px 8px", flexShrink: 0 }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 10,
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 10, padding: "9px 12px",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}>
                        <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                          <circle cx="8.5" cy="8.5" r="5.5" stroke="rgba(255,255,255,0.38)" strokeWidth="1.6"/>
                          <path d="m13 13 3.5 3.5" stroke="rgba(255,255,255,0.38)" strokeWidth="1.6" strokeLinecap="round"/>
                        </svg>
                        <input
                          autoFocus
                          value={modelSearch}
                          onChange={e => setModelSearch(e.target.value)}
                          placeholder="Search models…"
                          style={{
                            background: "transparent", border: "none", outline: "none",
                            color: "#fff", fontSize: 15, flex: 1, letterSpacing: "0.01em",
                            fontFamily: "var(--font-body, system-ui)",
                          }}
                        />
                        {modelSearch && (
                          <button
                            onClick={() => setModelSearch("")}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              color: "rgba(255,255,255,0.3)", fontSize: 14, padding: 0, lineHeight: 1,
                              transition: "color 0.12s",
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)"; }}
                          >✕</button>
                        )}
                      </div>
                    </div>

                    {/* Scrollable model list */}
                    <div className="model-dd-scroll" style={{ overflowY: "auto", maxHeight: 430, padding: "0 8px 10px" }}>
                      {noResults ? (
                        <div style={{ padding: "20px 16px", textAlign: "center", color: "rgba(255,255,255,0.28)", fontSize: 13 }}>
                          No models match &ldquo;{modelSearch}&rdquo;
                        </div>
                      ) : (
                        <>
                          {liveModels.length > 0 && (
                            <>
                              <p style={{
                                fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.38)",
                                letterSpacing: "0.14em", textTransform: "uppercase",
                                padding: "8px 10px 4px", margin: 0,
                              }}>Live Models</p>
                              {liveModels.map(renderRow)}
                            </>
                          )}
                          {soonModels.length > 0 && (
                            <>
                              <div style={{
                                margin: liveModels.length > 0 ? "10px 10px 4px" : "8px 10px 4px",
                                paddingTop: liveModels.length > 0 ? 10 : 0,
                                borderTop: liveModels.length > 0 ? "1px solid rgba(255,255,255,0.07)" : "none",
                              }}>
                                <p style={{
                                  fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.28)",
                                  letterSpacing: "0.14em", textTransform: "uppercase", margin: 0,
                                }}>Coming Soon</p>
                              </div>
                              {soonModels.map(renderRow)}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Aspect Ratio */}
            {(() => {
              // Hard-locked AR list per model — derived from shared image-model-config.ts.
              const activeArList: AspectRatio[] =
                (currentDockConfig?.aspectRatios as AspectRatio[] | undefined) ??
                ["1:1", "16:9", "9:16", "4:5"];

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

            {/* Quality selector — two display modes driven by qualityDisplayMode */}

            {/* "segmented" — GPT Image Fast / Standard / Ultra inline toggle */}
            {/* Hidden in transform/edit mode: /v1/images/edits ignores quality. */}
            {currentDockConfig?.qualityOptions && currentDockConfig.qualityDisplayMode !== "chips" && !isTransformMode && (
              <div style={{ display: "flex", alignItems: "center", gap: 2, background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 3 }}>
                {currentDockConfig.qualityOptions.map((opt) => {
                  const isActive = quality === opt.apiValue;
                  return (
                    <button
                      key={opt.apiValue}
                      onClick={() => setQuality(opt.apiValue as GPTQuality)}
                      title={opt.desc}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        padding: "5px 11px", borderRadius: 8, border: "none", cursor: "pointer",
                        background: isActive ? "rgba(37,99,235,0.55)" : "transparent",
                        boxShadow: isActive ? "0 0 10px rgba(37,99,235,0.35)" : "none",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isActive ? "rgba(37,99,235,0.55)" : "transparent"; }}
                    >
                      <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? "#fff" : "rgba(255,255,255,0.55)", letterSpacing: "0.01em" }}>
                        {opt.label}
                      </span>
                      {opt.desc && (
                        <span style={{ fontSize: 9, color: isActive ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.3)", marginTop: 1, letterSpacing: "0.02em" }}>
                          {opt.desc}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* "chips" — Seedream 4.5 native resolution chip selector (2K Standard / 4K Ultra) */}
            {/* Renders as a compact pill row. No quality = provider default (1K). */}
            {currentDockConfig?.qualityOptions && currentDockConfig.qualityDisplayMode === "chips" && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {/* "None / 1K" deselect chip — lets user reset to base cost */}
                <button
                  onClick={() => setQuality("" as StudioQuality)}
                  title="Default resolution (provider selects, ~1K cost)"
                  style={{
                    padding: "4px 9px", borderRadius: 8, border: "1px solid",
                    borderColor: !quality ? "rgba(139,92,246,0.7)" : "rgba(255,255,255,0.12)",
                    background: !quality ? "rgba(139,92,246,0.18)" : "transparent",
                    cursor: "pointer", fontSize: 11, fontWeight: !quality ? 700 : 400,
                    color: !quality ? "#a78bfa" : "rgba(255,255,255,0.4)",
                    transition: "all 0.15s",
                  }}
                >
                  Default
                </button>
                {currentDockConfig.qualityOptions.map((opt) => {
                  const isActive = quality === opt.apiValue;
                  return (
                    <button
                      key={opt.apiValue}
                      onClick={() => setQuality(opt.apiValue as StudioQuality)}
                      title={opt.desc}
                      style={{
                        padding: "4px 10px", borderRadius: 8, border: "1px solid",
                        borderColor: isActive ? "rgba(139,92,246,0.7)" : "rgba(255,255,255,0.12)",
                        background: isActive ? "rgba(139,92,246,0.22)" : "transparent",
                        cursor: "pointer", fontSize: 11, fontWeight: isActive ? 700 : 400,
                        color: isActive ? "#a78bfa" : "rgba(255,255,255,0.45)",
                        boxShadow: isActive ? "0 0 8px rgba(139,92,246,0.3)" : "none",
                        transition: "all 0.15s",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Resolution quality — 1K / 2K / 4K dropdown (NB Pro and resolution-tier models) */}
            {(currentDockConfig?.allowedQualities?.length ?? 0) > 1 && (
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
                      .filter(({ label }) => currentDockConfig?.allowedQualities?.includes(label))
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

            {/* Batch size — locked to 1 for NB and Flux models */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={() => !batchLocked && setBatchSize((v) => Math.max(1, v - 1))}
                disabled={batchLocked || batchSize <= 1}
                style={{
                  width: 26, height: 26, borderRadius: 7, border: "none",
                  background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)",
                  cursor: (batchLocked || batchSize <= 1) ? "not-allowed" : "pointer", fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600,
                  opacity: (batchLocked || batchSize <= 1) ? 0.4 : 1,
                }}
              >−</button>
              <span
                style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", minWidth: 28, textAlign: "center", fontWeight: 500 }}
                title={batchLocked ? "This model supports 1 image per generation" : undefined}
              >
                {batchLocked ? "1/1" : `${batchSize}/4`}
              </span>
              <button
                onClick={() => !batchLocked && setBatchSize((v) => Math.min(4, v + 1))}
                disabled={batchLocked || batchSize >= 4}
                style={{
                  width: 26, height: 26, borderRadius: 7, border: "none",
                  background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)",
                  cursor: (batchLocked || batchSize >= 4) ? "not-allowed" : "pointer", fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600,
                  opacity: (batchLocked || batchSize >= 4) ? 0.4 : 1,
                }}
              >+</button>
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* ✦ Enhance chip — icon only, directly left of Generate */}
            {(() => {
              const enhanceDisabled = !prompt.trim() || enhancing;
              return (
                <Tooltip content={enhancing ? "Enhancing…" : "Enhance prompt"}>
                  <button
                    onClick={handleEnhance}
                    disabled={enhanceDisabled}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      border: "1px solid rgba(139,92,246,0.35)",
                      background: "rgba(139,92,246,0.12)",
                      color: enhanceDisabled ? "rgba(167,139,250,0.35)" : "rgba(167,139,250,0.9)",
                      cursor: enhanceDisabled ? "not-allowed" : "pointer",
                      opacity: !prompt.trim() ? 0.45 : 1,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { if (!enhanceDisabled) { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.22)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.6)"; } }}
                    onMouseLeave={e => { if (!enhanceDisabled) { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.12)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.35)"; } }}
                  >
                    {enhancing
                      ? <div style={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px solid rgba(167,139,250,0.25)", borderTopColor: "rgba(167,139,250,0.7)", animation: "spin 0.7s linear infinite" }} />
                      : <span style={{ fontSize: 14, lineHeight: 1 }}>✦</span>
                    }
                  </button>
                </Tooltip>
              );
            })()}

            {/* Generate button — disabled while reference image is uploading or model is gated */}
            {(() => {
              // GPT Image 2 generate gate: model is visible and selectable but generation is
              // blocked until token pricing is finalised. No API request fires, no credits charged.
              const isGpt2 = model === "gpt-image-2";
              const isDisabled = isGpt2 || !prompt.trim() || !currentModel.available
                || (currentModel.requiresImg && !editImageUrl)
                || referenceUploading;
              const isUploadWait = referenceUploading && !isGpt2;
              return (
                <button
                  onClick={() => { if (!isGpt2) generate(); }}
                  disabled={isDisabled}
                  title={
                    isGpt2       ? "GPT Image 2 pricing is being calibrated" :
                    isUploadWait ? "Waiting for reference image to finish uploading…" :
                    undefined
                  }
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "11px 26px", borderRadius: 13, fontSize: 14, fontWeight: 700,
                    border: "none",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
                    color: "#fff",
                    opacity: isDisabled ? 0.52 : 1,
                    transition: "all 0.2s", letterSpacing: "0.02em",
                    boxShadow: isDisabled
                      ? "0 0 14px rgba(37,99,235,0.18), 0 2px 8px rgba(0,0,0,0.3)"
                      : "0 0 28px rgba(37,99,235,0.45), 0 4px 16px rgba(0,0,0,0.4)",
                    minWidth: 140,
                  }}
                  onMouseEnter={e => { if (!isDisabled) { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 45px rgba(37,99,235,0.65), 0 4px 20px rgba(0,0,0,0.5)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = !isDisabled ? "0 0 28px rgba(37,99,235,0.45), 0 4px 16px rgba(0,0,0,0.4)" : "0 0 14px rgba(37,99,235,0.18), 0 2px 8px rgba(0,0,0,0.3)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
                >
                  {isUploadWait ? (
                    <>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "rgba(255,255,255,0.6)", animation: "spin 0.7s linear infinite" }} />
                      Uploading…
                    </>
                  ) : (
                    <>
                      Generate
                      <Zap size={14} strokeWidth={2.5} style={{ color: "#fece01", flexShrink: 0 }} />
                      {currentModel.available && (
                        <span style={{
                          fontFamily: "var(--font-syne, sans-serif)",
                          fontSize: 18, fontWeight: 700,
                          color: "rgba(255,255,255,0.92)",
                          letterSpacing: "-0.01em",
                        }}>
                          {getGenerationCreditCost(MODEL_TO_KEY[model] ?? "gpt-image-1", isTransformMode ? {} : { quality, outputCount: effectiveBatchSize }) ?? "—"} cr
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
      </div>{/* end collapse animation wrapper */}
        </div>{/* end maxWidth container */}
      </div>{/* end fixed dock outer */}

      {/* ── MULTI-SELECT BULK ACTION BAR ─────────────────────────────────── */}
      {selectedImageIds.size > 0 && (
        <div style={{
          position: "fixed", top: 80, right: 24, left: "auto", transform: "none",
          zIndex: 200, /* above gallery (40), below FlowBar (50) — doc states FlowBar is now layout-relative */
          background: "rgba(6,10,24,0.97)", backdropFilter: "blur(16px)",
          border: "1px solid rgba(60,100,255,0.3)",
          borderRadius: 14, padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
          animation: "fadeIn 0.18s ease",
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", minWidth: 80 }}>
            {selectedImageIds.size} selected
          </span>

          {/* Delete */}
          <button
            onClick={() => {
              selectedImageIds.forEach(id => {
                const img = images.find(i => i.id === id);
                if (img) handleDeleteCard(img.id, img.assetId);
              });
              setSelectedImageIds(new Set());
            }}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)",
              color: "#FCA5A5", cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.18)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)"; }}
          >Delete</button>

          {/* Move to Project */}
          <button
            onClick={() => { fetchUserProjects().catch(() => {}); setMoveProjectModal(true); }}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.75)", cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.11)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
          >Move to Project</button>

          {/* Make Public */}
          <button
            onClick={() => setMakePublicModal(true)}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: "1px solid rgba(139,92,246,0.35)", background: "rgba(139,92,246,0.1)",
              color: "rgba(167,139,250,0.9)", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.1)"; }}
          >
            <span style={{ fontSize: 11 }}>🌐</span>Make Public
          </button>

          {/* Clear */}
          <button
            onClick={() => setSelectedImageIds(new Set())}
            style={{
              width: 26, height: 26, borderRadius: "50%", border: "none",
              background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)",
              cursor: "pointer", fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>
      )}

      {/* ── MAKE PUBLIC CONFIRMATION MODAL ────────────────────────────────── */}
      {makePublicModal && (
        <div
          onClick={() => !makePublicLoading && setMakePublicModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9100,
            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#0A1120", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 18, padding: "28px 30px",
              width: "min(400px, calc(100vw - 40px))",
              boxShadow: "0 32px 80px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)",
              animation: "fadeIn 0.18s ease",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F5F7FF", marginBottom: 10 }}>
              Make {selectedImageIds.size} image{selectedImageIds.size === 1 ? "" : "s"} public?
            </div>
            <p style={{ fontSize: 13, color: "rgba(167,176,197,0.8)", lineHeight: 1.55, marginBottom: 22 }}>
              These creations will be visible to others in the Zencra Gallery once it launches. You can change this later.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setMakePublicModal(false)}
                disabled={makePublicLoading}
                style={{
                  padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.55)", cursor: "pointer",
                }}
              >Cancel</button>
              <button
                onClick={() => { handleBulkMakePublic().catch(() => {}); }}
                disabled={makePublicLoading}
                style={{
                  padding: "9px 20px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                  border: "1px solid rgba(139,92,246,0.45)", background: makePublicLoading ? "rgba(139,92,246,0.1)" : "rgba(139,92,246,0.22)",
                  color: makePublicLoading ? "rgba(167,139,250,0.5)" : "rgba(167,139,250,0.95)",
                  cursor: makePublicLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {makePublicLoading ? (
                  <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>⟳</span> Publishing…</>
                ) : "🌐 Make Public"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOVE TO PROJECT MODAL ─────────────────────────────────────────── */}
      {moveProjectModal && (
        <div
          onClick={() => !moveProjectLoading && setMoveProjectModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9100,
            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#0A1120", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 18, padding: "24px 28px",
              width: "min(420px, calc(100vw - 40px))",
              boxShadow: "0 32px 80px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)",
              animation: "fadeIn 0.18s ease",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F5F7FF", marginBottom: 16 }}>
              Move {selectedImageIds.size} image{selectedImageIds.size === 1 ? "" : "s"} to a project
            </div>
            {projectsLoading ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
                Loading projects…
              </div>
            ) : userProjects.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <p style={{ fontSize: 13, color: "rgba(167,176,197,0.6)", marginBottom: 14 }}>
                  You don&apos;t have any projects yet.
                </p>
                <a href="/dashboard/projects" style={{ fontSize: 13, color: "#60A5FA", textDecoration: "none", fontWeight: 600 }}>
                  Create a project →
                </a>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                {userProjects.map(proj => (
                  <button
                    key={proj.id}
                    onClick={() => { handleBulkMoveToProject(proj.id, proj.name).catch(() => {}); }}
                    disabled={moveProjectLoading}
                    style={{
                      width: "100%", padding: "11px 14px", borderRadius: 10, textAlign: "left",
                      border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
                      color: "#E2E8F0", fontSize: 13, fontWeight: 500, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.1)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.3)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
                  >
                    <span style={{ fontSize: 15 }}>📁</span>
                    {proj.name}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                onClick={() => setMoveProjectModal(false)}
                style={{
                  padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.5)", cursor: "pointer",
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── FULLSCREEN IMAGE VIEWER — unified FullscreenPreview component ─── */}
      {viewingImage?.url && (
        <FullscreenPreview
          type="image"
          url={viewingImage.url}
          onClose={handleCloseFullscreen}
          zIndex={12000}
          rightPanelWidth={
            selectedImage && selectedImage.status === "done" && !panelCollapsed
              ? 360
              : 0
          }
        />
      )}

      {/* Auth modal */}
      {authModal && <AuthModal defaultTab="login" onClose={() => setAuthModal(false)} />}

      {/* ── Cancel generation confirmation modal ─────────────────────────── */}
      {cancelConfirmId && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)",
        }}>
          <div style={{
            background: "#0A0F1E",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 16,
            padding: "28px 32px",
            maxWidth: 400,
            width: "calc(100% - 48px)",
            textAlign: "center",
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          }}>
            <p style={{ color: "#F5F7FF", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Cancel generation?
            </p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.55, marginBottom: 24 }}>
              Credits may not be refunded if the job has already started on the provider.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => {
                  handleCancelGeneration(cancelConfirmId);
                  setCancelConfirmId(null);
                }}
                style={{
                  padding: "10px 24px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
                  background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)",
                  color: "rgba(252,165,165,0.9)", transition: "background 0.15s",
                }}
              >
                Yes, cancel
              </button>
              <button
                onClick={() => setCancelConfirmId(null)}
                style={{
                  padding: "10px 24px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.6)", transition: "background 0.15s",
                }}
              >
                No, continue
              </button>
            </div>
          </div>
        </div>
      )}

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
      {toastState && (() => {
        const VARIANT_STYLES = {
          success: { border: "rgba(16,185,129,0.45)", bg: "rgba(16,185,129,0.10)", dot: "#34D399" },
          error:   { border: "rgba(239,68,68,0.45)",  bg: "rgba(239,68,68,0.10)",  dot: "#FCA5A5" },
          info:    { border: "rgba(37,99,235,0.35)",  bg: "rgba(37,99,235,0.10)",  dot: "#60A5FA" },
        };
        const vs = VARIANT_STYLES[toastState.variant];
        return (
          <div style={{
            position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
            zIndex: 99999,
            background: vs.bg, backdropFilter: "blur(14px)",
            border: `1px solid ${vs.border}`,
            borderRadius: 12, padding: "10px 18px",
            fontSize: 13, fontWeight: 500, color: "#F1F5F9",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            animation: "fadeIn 0.18s ease",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: vs.dot, flexShrink: 0 }} />
            {toastState.msg}
          </div>
        );
      })()}

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
        .img-card-wrapper:hover .img-seq-num { opacity: 1 !important; }
        .img-card-wrapper:hover .img-checkbox { opacity: 1 !important; }
      `}</style>
      </>)} {/* end studioMode === "standard" generate bar + modals */}
    </div> {/* end MAIN FIXED CONTAINER */}

    {/* FlowBar now lives inside the TOP BAR WRAPPER above — layout-aware, not viewport-fixed */}
    {/* NextStepPanel removed — premium action panel (selectedImage) is the sole right panel */}

    {/* ── RIGHT ACTION PANEL ───────────────────────────────────────────── */}
    {/* position:fixed slide-in from right; rendered OUTSIDE gallery div   */}
    {/* to avoid being clipped by the gallery's stacking context (z:40).  */}
    {selectedImage && selectedImage.status === "done" && (
      <>
        {/* Backdrop — close on outside click (hidden when fullscreen is active so
            the fullscreen backdrop at z:9000 handles dismissal instead) */}
        {!viewingImage && (
          <div
            onClick={() => {
              setSelectedImage(null); setPanelDetails(null);
              setPanelAnimateOpen(false); setPanelMetaExpanded(false);
            }}
            style={{ position: "fixed", inset: 0, zIndex: 9005, background: "transparent" }}
          />
        )}

        {/* Panel — sits at z:9020, above the fullscreen backdrop (z:9000) but
            below the close button (z:9030), so it remains accessible in both modes.
            Slide-off to the right when panelCollapsed; content (overflowY) is on
            the inner body div so the collapse handle can overflow the left edge. */}
        <div
          style={{
            position: "fixed", top: 0, right: 0, bottom: 0,
            width: 360, zIndex: 9020,
            background: "linear-gradient(170deg, rgba(9,9,18,0.99) 0%, rgba(12,10,22,0.99) 50%, rgba(8,9,16,0.99) 100%)",
            backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
            borderLeft: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "-20px 0 60px rgba(0,0,0,0.5), -1px 0 0 rgba(255,255,255,0.04)",
            display: "flex", flexDirection: "column",
            fontFamily: "var(--font-body, system-ui, sans-serif)",
            color: "#fff",
            // Collapse: slide right off-screen; always transition after initial mount
            transform: panelCollapsed ? "translateX(100%)" : "translateX(0)",
            transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
            // overflow:visible on outer div so the absolute handle can bleed left
            overflow: "visible",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Collapse / expand handle — dark glass tab on the left edge ── */}
          <button
            onClick={() => setPanelCollapsed(v => !v)}
            title={panelCollapsed ? "Open panel" : "Collapse panel"}
            style={{
              position: "absolute",
              top: "50%", left: -22,
              transform: "translateY(-50%)",
              width: 22, height: 52,
              borderRadius: "8px 0 0 8px",
              background: "rgba(9,9,18,0.96)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRight: "none",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.35)",
              fontSize: 14, lineHeight: 1,
              zIndex: 1,
              transition: "background 0.15s, color 0.15s",
              padding: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.18)";
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(9,9,18,0.96)";
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)";
            }}
          >
            {/* Chevron: › when open (collapse), ‹ when collapsed (expand) */}
            {panelCollapsed ? "‹" : "›"}
          </button>
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(20px); opacity: 0; }
              to   { transform: translateX(0);    opacity: 1; }
            }
            @keyframes metaExpand {
              from { opacity: 0; transform: translateY(-6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes panelSpin {
              to { transform: rotate(360deg); }
            }
          `}</style>

          {/* ── Header ── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "linear-gradient(90deg, rgba(37,99,235,0.06) 0%, transparent 100%)",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
              Image
            </span>
            <button
              onClick={() => {
                setSelectedImage(null); setPanelDetails(null);
                setPanelAnimateOpen(false); setPanelMetaExpanded(false);
              }}
              style={{
                width: 26, height: 26, borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.09)",
                background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.18)"; (e.currentTarget as HTMLElement).style.color = "#F87171"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}
            >✕</button>
          </div>

          {/* ── Thumbnail — natural aspect ratio, full bleed ── */}
          {selectedImage.url && (
            <div
              onClick={() => setViewingImage(selectedImage)}
              style={{
                position: "relative", flexShrink: 0,
                cursor: "zoom-in", overflow: "hidden",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
              onMouseEnter={e => {
                const overlay = (e.currentTarget as HTMLElement).querySelector(".thumb-overlay") as HTMLElement | null;
                if (overlay) overlay.style.opacity = "1";
              }}
              onMouseLeave={e => {
                const overlay = (e.currentTarget as HTMLElement).querySelector(".thumb-overlay") as HTMLElement | null;
                if (overlay) overlay.style.opacity = "0";
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedImage.url}
                alt="Selected"
                style={{
                  width: "100%", height: "auto", display: "block",
                  maxHeight: 260,
                  objectFit: "contain",
                  background: "rgba(0,0,0,0.4)",
                  transition: "transform 0.3s ease",
                }}
              />
              {/* Zoom hint overlay */}
              <div
                className="thumb-overlay"
                style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(124,58,237,0.08))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: 0, transition: "opacity 0.2s ease",
                }}
              >
                <span style={{
                  fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)",
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  background: "rgba(0,0,0,0.55)", padding: "5px 12px", borderRadius: 20,
                  backdropFilter: "blur(8px)",
                }}>
                  ⛶ View full size
                </span>
              </div>
            </div>
          )}

          {/* ── Panel body ── */}
          <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>

            {/* ══ PRIMARY ACTIONS ══════════════════════════════════════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>

              {/* Create Variation */}
              <button
                onClick={() => {
                  // Restore the selected image's exact settings then generate
                  const srcPrompt = selectedImage.prompt;
                  const srcAr     = resolveVariationAR(selectedImage, imageRatios, aspectRatio);
                  // selectedImage.model may be a UI ID ("dalle3") or a model key ("gpt-image-1")
                  // KEY_TO_MODEL handles model keys → UI IDs; fall back to as-is for UI IDs
                  const srcModel  = KEY_TO_MODEL[selectedImage.model] ?? selectedImage.model;
                  setPrompt(srcPrompt);
                  if (srcModel && MODELS.find(m => m.id === srcModel)) setModel(srcModel);
                  setAspectRatio(srcAr);
                  setSelectedImage(null);
                  setPanelDetails(null);
                  setViewingImage(null);  // Issue 5: close fullscreen before generating
                  // generate() reads overrides — pass values directly so we don't
                  // depend on state having already updated before the call
                  setTimeout(() => generate({
                    prompt: srcPrompt,
                    model:  srcModel,
                    aspectRatio: srcAr,
                  }), 0);
                }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 5, padding: "14px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(124,58,237,0.12))",
                  color: "#fff", cursor: "pointer", transition: "all 0.15s",
                  letterSpacing: "0.01em", textAlign: "center" as const,
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "linear-gradient(135deg, rgba(37,99,235,0.32), rgba(124,58,237,0.26))";
                  el.style.borderColor = "rgba(96,165,250,0.4)";
                  el.style.boxShadow = "0 0 18px rgba(37,99,235,0.22), 0 0 6px rgba(124,58,237,0.14)";
                  el.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(124,58,237,0.12))";
                  el.style.borderColor = "rgba(255,255,255,0.12)";
                  el.style.boxShadow = "none";
                  el.style.transform = "translateY(0)";
                }}
              >
                <span style={{ fontSize: 18 }}>✦</span>
                Create Variation
              </button>

              {/* Animate — with inline Start/End Frame dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setPanelAnimateOpen(v => !v)}
                  style={{
                    width: "100%", display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    gap: 5, padding: "14px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                    border: "1px solid rgba(37,99,235,0.25)",
                    background: "rgba(37,99,235,0.1)",
                    color: "#93C5FD", cursor: "pointer", transition: "all 0.15s",
                    letterSpacing: "0.01em", textAlign: "center" as const,
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = "rgba(37,99,235,0.22)";
                    el.style.borderColor = "rgba(96,165,250,0.5)";
                    el.style.boxShadow = "0 0 18px rgba(37,99,235,0.2)";
                    el.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    if (!panelAnimateOpen) {
                      el.style.background = "rgba(37,99,235,0.1)";
                      el.style.borderColor = "rgba(37,99,235,0.25)";
                    }
                    el.style.boxShadow = "none";
                    el.style.transform = "translateY(0)";
                  }}
                >
                  <Play size={16} style={{ flexShrink: 0 }} />
                  Animate
                  {panelAnimateOpen ? <ChevronUp size={12} style={{ flexShrink: 0 }} /> : <ChevronDown size={12} style={{ flexShrink: 0 }} />}
                </button>

                {/* Inline dropdown */}
                {panelAnimateOpen && selectedImage.url && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                    background: "#141420", border: "1px solid rgba(96,165,250,0.2)",
                    borderRadius: 10, overflow: "hidden", zIndex: 10,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                  }}>
                    {[
                      { label: "Use as Start Frame", param: "startFrame", desc: "Image becomes the first frame" },
                      { label: "Use as End Frame",   param: "endFrame",   desc: "Image becomes the last frame" },
                    ].map(({ label, param, desc }) => (
                      <button
                        key={param}
                        onClick={() => {
                          setPanelAnimateOpen(false);
                          openVideoWorkflow(selectedImage, param === "startFrame" ? "start-frame" : "end-frame");
                        }}
                        style={{
                          width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start",
                          padding: "10px 12px", border: "none", background: "transparent",
                          color: "#fff", cursor: "pointer", transition: "background 0.12s",
                          borderBottom: param === "startFrame" ? "1px solid rgba(255,255,255,0.06)" : "none",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(96,165,250,0.1)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{desc}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ══ SECONDARY ACTIONS ════════════════════════════════════════════ */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>

              {/* Reuse Prompt */}
              {selectedImage.prompt && (
                <button
                  onClick={() => {
                    setPrompt(selectedImage.prompt);
                    promptRef.current?.focus();
                    setSelectedImage(null); setPanelDetails(null);
                  }}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    padding: "8px 10px", borderRadius: 9, fontSize: 11, fontWeight: 600,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.65)",
                    cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" as const,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)"; }}
                >
                  <RotateCcw size={11} style={{ flexShrink: 0 }} /> Reuse Prompt
                </button>
              )}

              {/* Download */}
              {selectedImage.url && (
                <button
                  onClick={() => downloadAsset(selectedImage.url!, `zencra-image-${selectedImage.id ?? "output"}.png`)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    padding: "8px 10px", borderRadius: 9, fontSize: 11, fontWeight: 600,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.65)",
                    cursor: "pointer", transition: "all 0.15s", width: "100%",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)"; }}
                >
                  <Download size={11} style={{ flexShrink: 0 }} /> Download
                </button>
              )}

              {/* Fullscreen button removed — panel already visible during fullscreen; redundant */}
            </div>

            {/* ══ METADATA — collapsed by default ══════════════════════════════ */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 10, marginTop: 2 }}>

              {/* Accordion toggle */}
              <button
                onClick={() => setPanelMetaExpanded(v => !v)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "none", border: "none", cursor: "pointer", padding: "2px 0 4px",
                  color: "rgba(255,255,255,0.55)", transition: "color 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.80)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"; }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>
                  Details
                </span>
                <span style={{ fontSize: 12, transition: "transform 0.2s", display: "inline-block", transform: panelMetaExpanded ? "rotate(180deg)" : "rotate(0deg)", color: "rgba(255,255,255,0.45)" }}>
                  ▾
                </span>
              </button>

              {/* Expanded content */}
              {panelMetaExpanded && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "metaExpand 0.18s ease" }}>

                  {/* Generation Details */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 6 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", margin: "4px 0 6px" }}>
                      Generation
                    </p>

                    {/* Prompt */}
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 7, padding: "8px 10px" }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 4, letterSpacing: "0.05em" }}>PROMPT</span>
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.88)", lineHeight: 1.6, margin: 0 }}>
                        {selectedImage.prompt || "—"}
                      </p>
                    </div>

                    {/* Model / AR / Quality / Resolution row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                      {[
                        { label: "MODEL",      val: getDisplayModelName(panelDetails?.asset.model_key || selectedImage.model) },
                        { label: "RATIO",      val: panelDetails?.generation_metadata?.aspect_ratio as string | undefined || selectedImage.aspectRatio },
                        { label: "QUALITY",    val: panelDetails?.generation_metadata?.quality as string | undefined },
                        { label: "RESOLUTION", val: (panelDetails?.generation_metadata?.width && panelDetails?.generation_metadata?.height ? `${panelDetails.generation_metadata.width} × ${panelDetails.generation_metadata.height}` : undefined) },
                      ].filter(({ val }) => !!val).map(({ label, val }) => (
                        <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 7, padding: "6px 10px" }}>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 3, letterSpacing: "0.05em" }}>{label}</span>
                          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.92)", fontWeight: 500 }}>{val}</span>
                        </div>
                      ))}
                    </div>

                    {/* Credits */}
                    {(panelDetails?.asset.credits_cost != null || panelDetails?.generation_metadata?.credits_used != null) && (
                      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 7, padding: "6px 10px" }}>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 3, letterSpacing: "0.05em" }}>CREDITS</span>
                        <span style={{ fontSize: 14, color: "rgba(120,180,255,0.95)", fontWeight: 600 }}>
                          {panelDetails?.generation_metadata?.credits_used ?? panelDetails?.asset.credits_cost} cr
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Cinematic Analysis */}
                  {panelLoading ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 6 }}>
                      <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", borderTopColor: "#60A5FA", animation: "panelSpin 0.8s linear infinite" }} />
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Analyzing…</span>
                    </div>
                  ) : panelDetails?.enriched_metadata && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", margin: "4px 0 2px" }}>
                        Cinematic
                      </p>

                      {/* Visual summary */}
                      {panelDetails.enriched_metadata.visual_summary && (
                        <div style={{ background: "rgba(37,99,235,0.07)", borderRadius: 7, padding: "8px 10px", border: "1px solid rgba(37,99,235,0.15)" }}>
                          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.88)", lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
                            {String(panelDetails.enriched_metadata.visual_summary)}
                          </p>
                        </div>
                      )}

                      {/* Single-value fields */}
                      {(["camera", "lens", "lighting"] as const).map((field) => {
                        const val = panelDetails.enriched_metadata![field];
                        if (!val) return null;
                        return (
                          <div key={field} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", minWidth: 52, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>{field}</span>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: 4 }}>
                              {String(val)}
                            </span>
                          </div>
                        );
                      })}

                      {/* Array tags */}
                      {(["mood", "style_tags", "composition", "color_tone"] as const).map((field) => {
                        const colors: Record<string, string> = { mood: "#A78BFA", style_tags: "#34D399", composition: "#60A5FA", color_tone: "#FB923C" };
                        const labels: Record<string, string> = { mood: "Mood", style_tags: "Style", composition: "Composition", color_tone: "Color" };
                        const val = panelDetails.enriched_metadata![field];
                        if (!Array.isArray(val) || val.length === 0) return null;
                        return (
                          <div key={field}>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{labels[field]}</span>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                              {(val as string[]).map((tag: string) => (
                                <span key={tag} style={{
                                  fontSize: 12, padding: "2px 7px", borderRadius: 20,
                                  background: `${colors[field]}15`,
                                  border: `1px solid ${colors[field]}28`,
                                  color: colors[field], fontWeight: 500,
                                }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {/* Confidence bar */}
                      {typeof panelDetails.enriched_metadata.confidence === "number" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 2 }}>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: "0.04em", whiteSpace: "nowrap" as const }}>CONFIDENCE</span>
                          <div style={{ flex: 1, height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${(panelDetails.enriched_metadata.confidence as number) * 100}%`, background: "linear-gradient(90deg, #2563EB, #7C3AED)", borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", minWidth: 24, textAlign: "right" as const }}>
                            {Math.round((panelDetails.enriched_metadata.confidence as number) * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    )}

    {/* ── Panel reopen tab — visible only when premium panel is collapsed ──── */}
    {selectedImage && selectedImage.status === "done" && panelCollapsed && !viewingImage && (
      <button
        onClick={() => setPanelCollapsed(false)}
        title="Open panel"
        style={{
          position:       "fixed",
          top:            "50%",
          right:          0,
          transform:      "translateY(-50%)",
          zIndex:         9021, /* above panel at 9020 */
          background:     "rgba(9,9,18,0.96)",
          border:         "1px solid rgba(255,255,255,0.09)",
          borderRight:    "none",
          borderRadius:   "8px 0 0 8px",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          width:          22, height: 52,
          cursor:         "pointer",
          color:          "rgba(255,255,255,0.35)",
          fontSize:       14, lineHeight: 1,
          display:        "flex", alignItems: "center", justifyContent: "center",
          padding:        0,
          transition:     "background 0.15s, color 0.15s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.18)";
          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(9,9,18,0.96)";
          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)";
        }}
      >
        ‹
      </button>
    )}

      {/* ── Workflow Transition Modal ─────────────────────────────────────────── */}
      <WorkflowTransitionModal
        open={workflowModal.open}
        onClose={() => setWorkflowModal(s => ({ ...s, open: false }))}
        origin="image-studio"
        asset={workflowModal.asset}
        defaultFlow={workflowModal.defaultFlow}
      />
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
