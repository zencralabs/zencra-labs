"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Zap, ImageIcon, Video, TrendingUp, ArrowRight, Clock,
  Star, FolderOpen, Layers, Music, RefreshCw, User2,
  ChevronRight, RotateCcw,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import Shimmer from "@/components/dashboard/Shimmer";
import { getDisplayModelName } from "@/lib/studio/model-display-names";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CreditTransaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface QuickCreateMedia {
  image:    { url: string | null };
  cd:       { url: string | null };
  video:    { url: string | null };
  fcs:      { url: string | null };
  lipsync:  { url: string | null };
  audio:    null;
  projects: { cover_url: string | null };
  library:  { url: string | null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Free users are governed by free_usage counters (images_max=10, videos_max=3), not credits.
 *  Pending billing consolidation (#1307). */
const PLAN_CREDIT_LIMIT: Record<string, number> = {
  starter: 600, creator: 1600, pro: 3500, business: 8000,
};

/** Locked Dashboard v2 plan badge colors */
const PLAN_BADGE_COLORS: Record<string, string> = {
  free:     "#64748B",
  starter:  "#64748B",
  creator:  "#6366F1",
  pro:      "#14B8A6",
  business: "#D4AF37",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Parses "[studio/model-key] ..." bracket pattern from description strings.
 *  Used as fallback when metadata is null (e.g. spend-type rows from spend_credits RPC). */
function parseBracket(desc: string | null): { studio: string | null; modelKey: string | null } {
  if (!desc) return { studio: null, modelKey: null };
  const m = desc.match(/\[(\w[\w-]*)\/([^\]]+)\]/);
  if (!m) return { studio: null, modelKey: null };
  return { studio: m[1], modelKey: m[2] };
}

const STUDIO_ICON_MAP: Record<string, { color: string; bg: string; Icon: React.ElementType }> = {
  image:     { Icon: ImageIcon, color: "#2563EB", bg: "rgba(37,99,235,0.14)" },
  video:     { Icon: Video,     color: "#7C3AED", bg: "rgba(124,58,237,0.14)" },
  audio:     { Icon: Music,     color: "#D97706", bg: "rgba(217,119,6,0.14)" },
  character: { Icon: User2,     color: "#F59E0B", bg: "rgba(245,158,11,0.14)" },
  cd:        { Icon: Layers,    color: "#0EA5A0", bg: "rgba(14,165,160,0.14)" },
};

const STUDIO_ACTION_LABEL: Record<string, string> = {
  image:     "Image Generated",
  video:     "Video Generated",
  audio:     "Audio Generated",
  character: "Character Generated",
  cd:        "Concept Generated",
};

function txIcon(
  type: string,
  metadata: Record<string, unknown> | null,
  description: string | null,
): { Icon: React.ElementType; color: string; bg: string } {
  // Resolve studio from metadata (audit rows) or description bracket (spend rows)
  const studioMeta = typeof metadata?.studio === "string" ? metadata.studio : null;
  const studio = studioMeta ?? parseBracket(description).studio;

  if (type === "spend" || type === "finalize") {
    return STUDIO_ICON_MAP[studio ?? ""] ?? { Icon: Zap, color: "#A855F7", bg: "rgba(168,85,247,0.14)" };
  }
  if (type === "refund" || type === "rollback") {
    return { Icon: RotateCcw, color: "#10B981", bg: "rgba(16,185,129,0.14)" };
  }
  if (type === "topup" || type === "purchase" || type === "grant" || type === "bonus") {
    return { Icon: Zap, color: "#10B981", bg: "rgba(16,185,129,0.14)" };
  }
  if (type === "trial") {
    return { Icon: Star, color: "#F59E0B", bg: "rgba(245,158,11,0.14)" };
  }
  return { Icon: Zap, color: "#64748B", bg: "rgba(255,255,255,0.06)" };
}

function txLabel(tx: CreditTransaction): { action: string; tool: string } {
  const meta    = tx.metadata;
  // metadata uses snake_case keys (model_key, studio) as written by hooks.ts
  const studioMeta   = typeof meta?.studio    === "string" ? meta.studio    : null;
  const modelKeyMeta = typeof meta?.model_key === "string" ? meta.model_key : null;
  // Bracket fallback for spend rows where metadata is null
  const parsed   = parseBracket(tx.description);
  const studio   = studioMeta   ?? parsed.studio;
  const modelKey = modelKeyMeta ?? parsed.modelKey;
  const modelName = getDisplayModelName(modelKey);

  if (tx.type === "spend") {
    const action = STUDIO_ACTION_LABEL[studio ?? ""] ?? "Output Generated";
    return { action, tool: modelName };
  }
  if (tx.type === "refund")   return { action: "Credits Refunded",  tool: modelName || tx.description || "Refund" };
  if (tx.type === "rollback") return { action: "Job Rolled Back",   tool: modelName || "" };
  if (tx.type === "topup"  || tx.type === "purchase") return { action: "Credits Purchased", tool: tx.description || "Top-up" };
  if (tx.type === "grant"  || tx.type === "bonus")    return { action: "Credits Added",     tool: tx.description || "Bonus"  };
  if (tx.type === "trial")                            return { action: "Trial Credits",     tool: tx.description || "Welcome bonus" };
  return { action: tx.description || "Transaction", tool: tx.type };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, session } = useAuth();
  const router            = useRouter();

  const [activity,        setActivity]        = useState<CreditTransaction[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError,   setActivityError]   = useState(false);
  const [qcMedia,         setQcMedia]         = useState<QuickCreateMedia | null>(null);

  // ── Load recent credit transactions ─────────────────────────────────────────
  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(false);
    try {
      const { data: { session: live } } = await supabase.auth.getSession();
      const token = live?.access_token ?? session?.access_token;
      if (!token) { setActivityLoading(false); return; }
      const res  = await fetch("/api/credits/history?limit=6", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json() as { success: boolean; data: CreditTransaction[] };
      if (json.success) setActivity(json.data ?? []);
      else setActivityError(true);
    } catch {
      setActivityError(true);
    } finally {
      setActivityLoading(false);
    }
  }, [session]);

  useEffect(() => { void loadActivity(); }, [loadActivity]);

  // ── Load Quick Create media covers ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: { session: live } } = await supabase.auth.getSession();
      const token = live?.access_token;
      if (!token) return;
      try {
        const res = await fetch("/api/dashboard/quick-create-media", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled && res.ok) {
          const body = await res.json() as { success?: boolean; data?: QuickCreateMedia };
          if (body?.data) setQcMedia(body.data);
        }
      } catch {
        // Non-fatal — cards fall back to gradient placeholders
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!user) return null;

  const joinDate  = new Date(user.joinedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const planKey   = (user.plan ?? "free").toLowerCase();
  const isFree    = planKey === "free";
  const credLimit = PLAN_CREDIT_LIMIT[planKey] ?? 600;
  const credPct   = Math.min((user.credits / credLimit) * 100, 100);
  const planColor = PLAN_BADGE_COLORS[planKey] ?? "#64748B";
  const firstName = user.name?.split(" ")[0] ?? "Creator";

  // Filter out zero-amount audit/bookkeeping rows (reserve, finalize entries)
  const visibleActivity = activity.filter(tx => tx.amount !== 0);

  // ── Shared card style ────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    backgroundColor: "var(--page-bg-2)",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.06)",
  };

  return (
    <div
      className="dashboard-content"
      style={{ maxWidth: "none", minHeight: "calc(100vh - 64px)", paddingBottom: 56 }}
    >

      {/* ── 1. Welcome Command Strip ────────────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(37,99,235,0.07) 0%, rgba(14,165,160,0.05) 100%)",
          border: "1px solid rgba(37,99,235,0.14)",
          borderRadius: 18,
          padding: "24px 28px",
          marginBottom: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        {/* Left: greeting */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "linear-gradient(135deg, #2563EB, #0EA5A0)", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-sans)" }}>
              Member since {joinDate}
            </span>
          </div>
          <h1 style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)", fontSize: 32, fontWeight: 800, color: "var(--page-text)", margin: 0, lineHeight: 1.1 }}>
            Welcome back, {firstName}
          </h1>
          <p style={{ fontSize: 14, color: "#475569", marginTop: 6, fontFamily: "var(--font-sans)" }}>
            Your Zencra creator workspace
          </p>
        </div>

        {/* Right: credits + plan badge + CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          {/* Credits count */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 800, color: "#DBEAFE", letterSpacing: "-0.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {user.credits.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: "#475569", fontWeight: 500, marginTop: 3, fontFamily: "var(--font-sans)" }}>{isFree ? "bonus credits" : "credits remaining"}</div>
          </div>

          {/* Separator */}
          <div style={{ width: 1, height: 44, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

          {/* Plan badge */}
          <div style={{
            background: `${planColor}1A`,
            border: `1px solid ${planColor}44`,
            borderRadius: 10,
            padding: "8px 14px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, fontFamily: "var(--font-sans)" }}>Plan</div>
            <div style={{ fontSize: 15, fontWeight: 700, textTransform: "capitalize", color: planColor, fontFamily: "var(--font-display)", letterSpacing: "-0.01em", marginTop: 2 }}>
              {user.plan}
            </div>
          </div>

          {/* Buy Credits CTA */}
          <button
            onClick={() => router.push("/dashboard/credits")}
            style={{
              background: "linear-gradient(135deg, #2563EB 0%, #0EA5A0 100%)",
              border: "none",
              borderRadius: 11,
              padding: "12px 20px",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          >
            Buy Credits
          </button>
        </div>
      </div>

      {/* ── 2. Stat Cards — 4 columns ──────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 22 }}>

        {/* Credits */}
        <div style={{ ...card, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-sans)" }}>Credits</span>
            <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: "rgba(168,85,247,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Zap size={15} style={{ color: "#A855F7" }} />
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800, color: "#DBEAFE", lineHeight: 1, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
            {user.credits.toLocaleString()}
          </div>
          {isFree ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: "var(--font-sans)", marginBottom: 4 }}>Free Trial · 10 Nano Banana images · 3 Kling videos</div>
              <button
                onClick={() => router.push("/dashboard/subscription")}
                style={{ fontSize: 11, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 3, padding: 0, fontFamily: "var(--font-sans)" }}
              >
                Upgrade plan <ArrowRight size={10} />
              </button>
            </div>
          ) : (
            <>
              <div style={{ height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden", marginTop: 12 }}>
                <div style={{ height: "100%", width: `${credPct}%`, background: "linear-gradient(90deg, #2563EB, #A855F7)", borderRadius: 2 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 11, color: "#475569", fontFamily: "var(--font-sans)" }}>{Math.round(credPct)}% of {credLimit.toLocaleString()} limit</span>
                <button
                  onClick={() => router.push("/dashboard/credits")}
                  style={{ fontSize: 11, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 3, padding: 0 }}
                >
                  Top up <ArrowRight size={10} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Plan */}
        <div style={{ borderRadius: 16, padding: "20px 22px", border: "1px solid rgba(37,99,235,0.18)", background: "linear-gradient(135deg, #0A1122 0%, #0d1533 100%)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-sans)" }}>Plan</span>
            <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: "rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <TrendingUp size={15} style={{ color: "#2563EB" }} />
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "#60A5FA", lineHeight: 1, textTransform: "capitalize", letterSpacing: "-0.02em" }}>
            {user.plan}
          </div>
          <button
            onClick={() => router.push("/dashboard/subscription")}
            style={{ marginTop: 12, fontSize: 11, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: 3, fontFamily: "var(--font-sans)" }}
          >
            Manage plan <ArrowRight size={10} />
          </button>
        </div>

        {/* Recent Activity */}
        <div style={{ ...card, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-sans)" }}>Activity</span>
            <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: "rgba(16,185,129,0.13)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Clock size={15} style={{ color: "#10B981" }} />
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800, color: "#DBEAFE", lineHeight: 1, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
            {activityLoading ? "—" : visibleActivity.length}
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 12, fontFamily: "var(--font-sans)" }}>
            recent transactions
          </div>
        </div>

        {/* Projects — deferred */}
        <div style={{ ...card, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-sans)" }}>Projects</span>
            <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: "rgba(14,165,160,0.13)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FolderOpen size={15} style={{ color: "#0EA5A0" }} />
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800, color: "#DBEAFE", lineHeight: 1, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
            —
          </div>
          <button
            onClick={() => router.push("/dashboard/projects")}
            style={{ marginTop: 12, fontSize: 11, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: 3, fontFamily: "var(--font-sans)" }}
          >
            View projects <ArrowRight size={10} />
          </button>
        </div>
      </div>

      {/* ── 3. Quick Create — premium 8-card media grid ────────────────────── */}
      <style>{`
        .qc-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        @media (max-width: 900px) {
          .qc-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 560px) {
          .qc-grid { grid-template-columns: 1fr; }
        }
        .qc-card {
          position: relative;
          border-radius: 14px;
          overflow: hidden;
          cursor: pointer;
          min-height: 190px;
          border: 1px solid rgba(255,255,255,0.07);
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          background: var(--page-bg-2);
        }
        .qc-card:hover {
          transform: translateY(-3px);
        }
        .qc-card video { object-fit: cover; width: 100%; height: 100%; position: absolute; inset: 0; }
        .qc-card img   { object-fit: cover; width: 100%; height: 100%; position: absolute; inset: 0; }
        /* Animated audio equalizer */
        @keyframes qc-eq {
          0%, 100% { height: 4px;  }
          50%       { height: 22px; }
        }
        .qc-eq-bar {
          width: 3px;
          border-radius: 2px;
          background: currentColor;
          animation: qc-eq 0.9s ease-in-out infinite;
          flex-shrink: 0;
        }
        .qc-eq-bar:nth-child(1) { animation-delay: 0s;     height: 10px; }
        .qc-eq-bar:nth-child(2) { animation-delay: 0.15s;  height: 18px; }
        .qc-eq-bar:nth-child(3) { animation-delay: 0.3s;   height: 8px;  }
        .qc-eq-bar:nth-child(4) { animation-delay: 0.45s;  height: 22px; }
        .qc-eq-bar:nth-child(5) { animation-delay: 0.6s;   height: 12px; }
        .qc-eq-bar:nth-child(6) { animation-delay: 0.75s;  height: 6px;  }
      `}</style>
      <div style={{ marginBottom: 22 }}>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--page-text)", margin: 0, letterSpacing: "-0.01em" }}>
            Quick Create
          </h2>
          <p style={{ fontSize: 12, color: "#475569", margin: "3px 0 0", fontFamily: "var(--font-sans)" }}>Jump into any studio</p>
        </div>

        <div className="qc-grid">
          <QCCard
            label="Image Studio"
            desc="Generate images"
            cta="Open studio →"
            href="/studio/image"
            accentColor="#2563EB"
            placeholder="linear-gradient(135deg, #0a1a4a 0%, #0d2060 50%, #1a3a8a 100%)"
            mediaUrl={qcMedia?.image?.url ?? null}
            mediaType="image"
            icon={<ImageIcon size={14} />}
            onNavigate={(href) => router.push(href)}
          />
          <QCCard
            label="Creative Director"
            desc="AI-guided concept flow"
            cta="Direct a concept →"
            href="/studio/image?mode=creative-director"
            accentColor="#0EA5A0"
            placeholder="linear-gradient(135deg, #041a1a 0%, #063030 50%, #0a5050 100%)"
            mediaUrl={qcMedia?.cd?.url ?? null}
            mediaType="image"
            icon={<Layers size={14} />}
            onNavigate={(href) => router.push(href)}
          />
          <QCCard
            label="Video Studio"
            desc="Generate AI videos"
            cta="Create a video →"
            href="/studio/video"
            accentColor="#7C3AED"
            placeholder="linear-gradient(135deg, #120a2a 0%, #250d50 50%, #3d1580 100%)"
            mediaUrl={qcMedia?.video?.url ?? null}
            mediaType="video"
            icon={<Video size={14} />}
            onNavigate={(href) => router.push(href)}
          />
          <QCCard
            label="Future Cinema Studio"
            desc="Cinematic AI filmmaking"
            cta="Enter studio →"
            href="/studio/cinema"
            accentColor="#D4AF37"
            placeholder="linear-gradient(135deg, #1a1200 0%, #2e1f00 50%, #4a3200 100%)"
            mediaUrl={qcMedia?.fcs?.url ?? null}
            mediaType="video"
            icon={<Star size={14} />}
            onNavigate={(href) => router.push(href)}
          />
          <QCCard
            label="LipSyncZ"
            desc="Sync any audio to video"
            cta="Sync now →"
            href="/studio/lipsync"
            accentColor="#C6FF00"
            placeholder="linear-gradient(135deg, #0d1a00 0%, #1a3000 50%, #263d00 100%)"
            mediaUrl={qcMedia?.lipsync?.url ?? null}
            mediaType="video"
            icon={<Music size={14} />}
            onNavigate={(href) => router.push(href)}
          />
          <QCCard
            label="Audio Studio"
            desc="Generate AI voiceover"
            cta="Generate audio →"
            href="/studio/audio"
            accentColor="#D97706"
            placeholder="linear-gradient(135deg, #1a0e00 0%, #2e1800 50%, #4a2800 100%)"
            mediaUrl={null}
            mediaType="audio"
            icon={<Music size={14} />}
            onNavigate={(href) => router.push(href)}
          />
          <QCCard
            label="My Projects"
            desc="Organise your work"
            cta="View projects →"
            href="/dashboard/projects"
            accentColor="#10B981"
            placeholder="linear-gradient(135deg, #001a10 0%, #003020 50%, #004a30 100%)"
            mediaUrl={qcMedia?.projects?.cover_url ?? null}
            mediaType="image"
            icon={<FolderOpen size={14} />}
            onNavigate={(href) => router.push(href)}
          />
          <QCCard
            label="Library"
            desc="All your creative assets"
            cta="Browse library →"
            href="/dashboard/library"
            accentColor="#F59E0B"
            placeholder="linear-gradient(135deg, #1a1000 0%, #2e1c00 50%, #4a2e00 100%)"
            mediaUrl={qcMedia?.library?.url ?? null}
            mediaType="image"
            icon={<Star size={14} />}
            onNavigate={(href) => router.push(href)}
          />
        </div>
      </div>

      {/* ── 4. Main 2-column — Recent Activity + Plan Panel ──────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>

        {/* Recent Activity */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--page-text)", margin: 0, letterSpacing: "-0.01em" }}>
                Recent Activity
              </h2>
              <p style={{ fontSize: 12, color: "#475569", margin: "3px 0 0", fontFamily: "var(--font-sans)" }}>Your latest credit transactions</p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {activityError && (
                <button
                  onClick={() => void loadActivity()}
                  style={{ fontSize: 12, color: "#64748B", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-sans)" }}
                >
                  <RefreshCw size={11} /> Retry
                </button>
              )}
              <button
                onClick={() => router.push("/dashboard/credits")}
                style={{ fontSize: 12, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-sans)" }}
              >
                View all <ArrowRight size={12} />
              </button>
            </div>
          </div>

          <div style={{ ...card, overflow: "hidden" }}>

            {/* Loading skeleton */}
            {activityLoading && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <Shimmer className="w-9 h-9 flex-shrink-0" rounded="rounded-[10px]" />
                <div style={{ flex: 1 }}>
                  <Shimmer className="h-3 w-2/5 mb-2" />
                  <Shimmer className="h-2.5 w-1/4" />
                </div>
                <Shimmer className="h-3 w-10" />
              </div>
            ))}

            {/* Error */}
            {!activityLoading && activityError && (
              <div style={{ padding: "28px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "#475569", fontFamily: "var(--font-sans)" }}>Couldn&apos;t load recent activity.</div>
                <button
                  onClick={() => void loadActivity()}
                  style={{ marginTop: 10, fontSize: 12, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "var(--font-sans)" }}
                >
                  Try again
                </button>
              </div>
            )}

            {/* Empty */}
            {!activityLoading && !activityError && visibleActivity.length === 0 && (
              <div style={{ padding: "36px 20px", textAlign: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(37,99,235,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  <ImageIcon size={20} style={{ color: "#2563EB" }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--page-text)", marginBottom: 6, fontFamily: "var(--font-sans)" }}>No activity yet</div>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 14, fontFamily: "var(--font-sans)" }}>No recent credit activity yet. Generate something or buy credits to see activity here.</div>
                <button
                  onClick={() => router.push("/studio/image")}
                  style={{ fontSize: 12, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "var(--font-sans)", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  Open Image Studio <ChevronRight size={12} />
                </button>
              </div>
            )}

            {/* Transactions — zero-amount audit rows are pre-filtered from visibleActivity */}
            {!activityLoading && !activityError && visibleActivity.map((tx, i) => {
              const { Icon, color, bg } = txIcon(tx.type, tx.metadata, tx.description);
              const { action, tool }    = txLabel(tx);
              const positive            = tx.amount > 0;

              return (
                <div
                  key={tx.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "15px 20px",
                    borderBottom: i < visibleActivity.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.015)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {/* Icon box */}
                  <div style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${color}22` }}>
                    <Icon size={15} style={{ color }} />
                  </div>

                  {/* Action + tool label */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--page-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-sans)" }}>
                      {action}
                    </div>
                    {tool && (
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-sans)" }}>
                        {tool}
                      </div>
                    )}
                  </div>

                  {/* Amount + time */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{
                      fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700,
                      color: positive ? "#10B981" : "#94A3B8",
                      letterSpacing: "-0.01em",
                    }}>
                      {positive ? "+" : "−"}{Math.abs(tx.amount).toLocaleString()} cr
                    </div>
                    <div style={{ fontSize: 10, color: "#334155", display: "flex", alignItems: "center", gap: 3, marginTop: 3, justifyContent: "flex-end", fontFamily: "var(--font-sans)" }}>
                      <Clock size={9} /> {timeAgo(tx.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Plan & Credits Side Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Plan + Credits card */}
          <div style={{ ...card, padding: "22px 22px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--page-text)", margin: "0 0 16px", letterSpacing: "-0.01em" }}>
              Plan &amp; Credits
            </h3>

            {/* Plan name */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: "#475569", fontFamily: "var(--font-sans)" }}>Current plan</span>
              <span style={{
                fontSize: 12, fontWeight: 700, textTransform: "capitalize",
                color: planColor, fontFamily: "var(--font-display)",
                background: `${planColor}18`,
                border: `1px solid ${planColor}33`,
                borderRadius: 6, padding: "3px 9px",
              }}>
                {user.plan}
              </span>
            </div>

            {/* Credits bar / Free Trial info */}
            {isFree ? (
              <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", marginBottom: 6, fontFamily: "var(--font-sans)" }}>Free Trial</div>
                <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.6, fontFamily: "var(--font-sans)" }}>
                  10 Nano Banana image generations<br />
                  3 Kling video generations
                </div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 4, fontFamily: "var(--font-sans)" }}>
                  50 bonus credits
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 11, color: "#475569", fontFamily: "var(--font-sans)" }}>Credits</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 800, color: "#DBEAFE", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{user.credits.toLocaleString()}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#475569", marginLeft: 3, fontVariantNumeric: "tabular-nums" }}> / {credLimit.toLocaleString()}</span>
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${credPct}%`, background: "linear-gradient(90deg, #2563EB, #A855F7)", borderRadius: 3, transition: "width 0.4s ease" }} />
                </div>
                <div style={{ fontSize: 11, color: "#334155", marginTop: 5, fontFamily: "var(--font-sans)" }}>
                  {Math.round(100 - credPct)}% available
                </div>
              </div>
            )}

            {/* CTAs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => router.push("/dashboard/credits")}
                style={{
                  width: "100%", background: "linear-gradient(135deg, #2563EB 0%, #0EA5A0 100%)",
                  border: "none", borderRadius: 10, padding: "11px 16px",
                  color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  fontFamily: "var(--font-display)", letterSpacing: "-0.01em", transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              >
                Buy Credits
              </button>
              {planKey !== "business" && (
                <button
                  onClick={() => router.push("/dashboard/subscription")}
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 16px",
                    color: "#94A3B8", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "var(--font-sans)", transition: "border-color 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.15)"; el.style.color = "#E2E8F0"; }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.08)"; el.style.color = "#94A3B8"; }}
                >
                  Upgrade Plan
                </button>
              )}
            </div>
          </div>

          {/* Support card */}
          <div style={{ ...card, padding: "18px 20px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--page-text)", margin: "0 0 10px", letterSpacing: "-0.01em" }}>
              Need help?
            </h3>
            <p style={{ fontSize: 11, color: "#475569", margin: "0 0 14px", fontFamily: "var(--font-sans)", lineHeight: 1.6 }}>
              Questions about your plan or credits? Our team is here.
            </p>
            <a
              href="mailto:support@zencralabs.com"
              style={{ fontSize: 12, color: "#60A5FA", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-sans)" }}
            >
              Contact support <ChevronRight size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QCCard — Premium cinematic Quick Create card
// ─────────────────────────────────────────────────────────────────────────────

interface QCCardProps {
  label:       string;
  desc:        string;
  cta:         string;
  href:        string;
  accentColor: string;
  placeholder: string;          // CSS gradient string used when no media is available
  mediaUrl:    string | null;
  mediaType:   "image" | "video" | "audio";
  icon:        React.ReactNode;
  onNavigate:  (href: string) => void;
}

function QCCard({
  label, desc, cta, href, accentColor, placeholder, mediaUrl, mediaType, icon, onNavigate,
}: QCCardProps) {
  const hasMedia = !!mediaUrl;

  function handleMouseEnter(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget as HTMLElement;
    el.style.transform   = "translateY(-3px)";
    el.style.boxShadow   = `0 8px 32px ${accentColor}28`;
    el.style.borderColor = `${accentColor}40`;
    // Hover-autoplay for video cards
    const vid = el.querySelector("video") as HTMLVideoElement | null;
    if (vid) void vid.play();
  }

  function handleMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget as HTMLElement;
    el.style.transform   = "translateY(0)";
    el.style.boxShadow   = "none";
    el.style.borderColor = "rgba(255,255,255,0.07)";
    const vid = el.querySelector("video") as HTMLVideoElement | null;
    if (vid) { vid.pause(); vid.currentTime = 0; }
  }

  return (
    <div
      className="qc-card"
      onClick={() => onNavigate(href)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Background media ──────────────────────────────────────────── */}
      {mediaType === "image" && hasMedia && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl!} alt="" draggable={false} />
      )}
      {mediaType === "video" && hasMedia && (
        <video
          src={mediaUrl!}
          muted
          loop
          playsInline
          preload="metadata"
          autoPlay={false}
        />
      )}

      {/* ── Audio animated equalizer (no visual asset) ────────────────── */}
      {mediaType === "audio" && (
        <div style={{
          position: "absolute", inset: 0,
          background: placeholder,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            display: "flex", alignItems: "flex-end", gap: 4,
            color: accentColor, height: 32,
          }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="qc-eq-bar" />
            ))}
          </div>
        </div>
      )}

      {/* ── Gradient placeholder (no media loaded yet) ────────────────── */}
      {(mediaType !== "audio") && !hasMedia && (
        <div style={{ position: "absolute", inset: 0, background: placeholder }} />
      )}

      {/* ── Dark cinematic overlay ────────────────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.12) 100%)",
        pointerEvents: "none",
      }} />

      {/* ── Accent top-left glow dot ─────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 14, left: 14,
        width: 30, height: 30, borderRadius: 8,
        backgroundColor: `${accentColor}22`,
        border: `1px solid ${accentColor}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: accentColor,
      }}>
        {icon}
      </div>

      {/* ── Card content — pinned to bottom ───────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "16px 16px 15px",
      }}>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: 14, fontWeight: 700,
          color: "#F8FAFC",
          letterSpacing: "-0.01em",
          lineHeight: 1.2,
          marginBottom: 3,
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 11, color: "rgba(248,250,252,0.55)",
          fontFamily: "var(--font-sans)", lineHeight: 1.4, marginBottom: 8,
        }}>
          {desc}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700,
          color: accentColor,
          fontFamily: "var(--font-sans)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}>
          {cta}
        </div>
      </div>
    </div>
  );
}
