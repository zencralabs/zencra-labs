"use client";

// ─────────────────────────────────────────────────────────────────────────────
// StylePicker — modal panel for style selection
// Category filter tabs, 3-col grid, weight slider, My Styles tab
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import type { Style, StyleCategory } from "@/lib/styles";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface StylePickerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  selectedStyleIds: string[];
  onApply: (styles: { id: string; weight: number }[]) => void;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  amber:       "#f59e0b",
  amberDim:    "rgba(245,158,11,0.12)",
  amberBorder: "rgba(245,158,11,0.3)",
  surface:     "#0b0e17",
  surfacePanel: "#0c1020",
  border:      "#1a2035",
  textPrimary: "#e8eaf0",
  textSec:     "#8b92a8",
  textMuted:   "#4a5168",
  textGhost:   "#3d4560",
} as const;

// ── Category tabs ─────────────────────────────────────────────────────────────

const CATEGORIES: Array<"all" | "my-styles" | StyleCategory> = [
  "all", "my-styles", "cinematic", "editorial", "street",
  "fashion", "anime", "realistic", "fantasy", "commercial", "ugc", "custom",
];

const CAT_LABELS: Record<string, string> = {
  "all": "All",
  "my-styles": "My Styles",
  "cinematic": "Cinematic",
  "editorial": "Editorial",
  "street": "Street",
  "fashion": "Fashion",
  "anime": "Anime",
  "realistic": "Realistic",
  "fantasy": "Fantasy",
  "commercial": "Commercial",
  "ugc": "UGC",
  "custom": "Custom",
};

// ── Mock system styles for UI (no backend call required in Phase 3B) ──────────

const MOCK_STYLES: Style[] = [
  { id: "cin-1", user_id: null, name: "Cinema Noir", category: "cinematic", description: "Dark, moody cinematic feel", prompt_template: "cinematic noir lighting", negative_prompt: null, preview_asset_id: null, is_system: true, is_active: true, created_at: "", updated_at: "" },
  { id: "cin-2", user_id: null, name: "Golden Hour", category: "cinematic", description: "Warm sunset tones", prompt_template: "golden hour lighting, warm tones", negative_prompt: null, preview_asset_id: null, is_system: true, is_active: true, created_at: "", updated_at: "" },
  { id: "edi-1", user_id: null, name: "Editorial Sharp", category: "editorial", description: "Clean editorial look", prompt_template: "editorial photography, sharp", negative_prompt: null, preview_asset_id: null, is_system: true, is_active: true, created_at: "", updated_at: "" },
  { id: "str-1", user_id: null, name: "Urban Street", category: "street", description: "Urban lifestyle aesthetic", prompt_template: "street photography, urban", negative_prompt: null, preview_asset_id: null, is_system: true, is_active: true, created_at: "", updated_at: "" },
  { id: "fas-1", user_id: null, name: "High Fashion", category: "fashion", description: "Luxury editorial fashion", prompt_template: "high fashion, luxury editorial", negative_prompt: null, preview_asset_id: null, is_system: true, is_active: true, created_at: "", updated_at: "" },
  { id: "ani-1", user_id: null, name: "Anime Style", category: "anime", description: "Japanese animation aesthetic", prompt_template: "anime style illustration", negative_prompt: null, preview_asset_id: null, is_system: true, is_active: true, created_at: "", updated_at: "" },
  { id: "rea-1", user_id: null, name: "Photorealistic", category: "realistic", description: "Ultra-realistic photography", prompt_template: "photorealistic, 8K", negative_prompt: null, preview_asset_id: null, is_system: true, is_active: true, created_at: "", updated_at: "" },
  { id: "fan-1", user_id: null, name: "Dark Fantasy", category: "fantasy", description: "Fantasy world aesthetic", prompt_template: "dark fantasy, dramatic", negative_prompt: null, preview_asset_id: null, is_system: true, is_active: true, created_at: "", updated_at: "" },
  { id: "com-1", user_id: null, name: "Commercial Clean", category: "commercial", description: "Bright commercial look", prompt_template: "commercial photography, clean", negative_prompt: null, preview_asset_id: null, is_system: true, is_active: true, created_at: "", updated_at: "" },
];

// ── Style card ────────────────────────────────────────────────────────────────

function StyleCard({
  style, selected, onToggle,
}: {
  style: Style; selected: boolean; onToggle: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onToggle(style.id)}
      style={{
        display: "flex", flexDirection: "column",
        border: selected ? `1px solid ${T.amber}` : `1px solid ${T.border}`,
        borderRadius: 10, overflow: "hidden", background: T.surface,
        cursor: "pointer", transition: "all 0.15s", textAlign: "left",
        position: "relative",
      }}
    >
      {/* Preview area */}
      <div style={{
        aspectRatio: "1", background: "linear-gradient(135deg, #0c1020, #090c13)",
        display: "flex", alignItems: "center", justifyContent: "center",
        borderBottom: `1px solid ${T.border}`,
      }}>
        {selected && (
          <div style={{
            position: "absolute", top: 6, right: 6,
            width: 18, height: 18, borderRadius: "50%",
            background: T.amber, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="#090c13" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
        <div style={{ opacity: 0.15 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="3" stroke="#f59e0b" strokeWidth="1.5" />
            <circle cx="8.5" cy="8.5" r="1.5" stroke="#f59e0b" strokeWidth="1.5" />
            <polyline points="21 15 16 10 5 21" stroke="#f59e0b" strokeWidth="1.5" />
          </svg>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "8px 8px 8px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: selected ? T.amber : T.textPrimary, marginBottom: 3 }}>
          {style.name}
        </div>
        <div style={{
          display: "inline-block", padding: "1px 6px", borderRadius: 4,
          background: selected ? T.amberDim : "rgba(255,255,255,0.04)",
          fontSize: 9, fontWeight: 700, color: selected ? T.amber : T.textGhost,
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          {style.category}
        </div>
      </div>
    </button>
  );
}

// ── Weight slider ─────────────────────────────────────────────────────────────

function WeightSlider({
  styleId, styleName, weight, onChange, onRemove,
}: {
  styleId: string; styleName: string; weight: number;
  onChange: (id: string, w: number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "6px 10px", borderRadius: 8,
      background: T.amberDim, border: `1px solid ${T.amberBorder}`,
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary, minWidth: 80 }}>
        {styleName}
      </span>
      <input
        type="range" min={0} max={100} value={Math.round(weight * 100)}
        onChange={e => onChange(styleId, parseInt(e.target.value) / 100)}
        style={{ flex: 1, accentColor: T.amber, cursor: "pointer" }}
      />
      <span style={{ fontSize: 10, color: T.amber, minWidth: 30, textAlign: "right" }}>
        {Math.round(weight * 100)}%
      </span>
      <button onClick={() => onRemove(styleId)}
        style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, lineHeight: 0, padding: 2 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function StylePicker({ isOpen, onClose, userId, selectedStyleIds, onApply }: StylePickerProps) {
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]>("all");
  const [styles, setStyles]                 = useState<Style[]>([]);
  const [selected, setSelected]             = useState<string[]>(selectedStyleIds);
  const [weights, setWeights]               = useState<Record<string, number>>({});
  const [loading, setLoading]               = useState(false);

  // Load styles on open
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    // Try fetching from API; fall back to mocks silently
    fetch("/api/styles")
      .then(r => r.ok ? r.json() as Promise<{ styles?: Style[] }> : Promise.reject())
      .then(d => setStyles(d.styles ?? MOCK_STYLES))
      .catch(() => setStyles(MOCK_STYLES))
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Init weights for pre-selected
  useEffect(() => {
    setSelected(selectedStyleIds);
    const initial: Record<string, number> = {};
    selectedStyleIds.forEach(id => { initial[id] = weights[id] ?? 0.5; });
    setWeights(initial);
  }, [selectedStyleIds]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const void_userId = userId; // used by API call
  void void_userId;

  function toggleStyle(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      setWeights(w => ({ ...w, [id]: w[id] ?? 0.5 }));
      return [...prev, id];
    });
  }

  function updateWeight(id: string, w: number) {
    setWeights(prev => ({ ...prev, [id]: w }));
  }

  function removeStyle(id: string) {
    setSelected(prev => prev.filter(x => x !== id));
  }

  const userStyles = styles.filter(s => !s.is_system);

  const filteredStyles = activeCategory === "all"
    ? styles.filter(s => s.is_system)
    : activeCategory === "my-styles"
    ? userStyles
    : styles.filter(s => s.category === activeCategory && s.is_system);

  const selectedStyles = styles.filter(s => selected.includes(s.id));

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "min(680px, 96vw)",
        maxHeight: "88vh",
        background: T.surfacePanel,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
        overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.textPrimary }}>Style Picker</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
              Select styles and adjust weights
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, lineHeight: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Category tabs */}
        <div style={{
          display: "flex", gap: 0, overflowX: "auto", padding: "0 20px",
          borderBottom: `1px solid ${T.border}`,
          scrollbarWidth: "none",
        }}>
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat;
            return (
              <button key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: "10px 12px",
                  background: "transparent", border: "none",
                  borderBottom: active ? `2px solid ${T.amber}` : "2px solid transparent",
                  color: active ? T.amber : T.textMuted,
                  fontSize: 11, fontWeight: active ? 700 : 500,
                  cursor: "pointer", whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
              >
                {CAT_LABELS[cat]}
                {cat === "my-styles" && userStyles.length > 0 && (
                  <span style={{
                    marginLeft: 4, padding: "1px 5px", borderRadius: 10,
                    background: T.amberDim, color: T.amber,
                    fontSize: 9, fontWeight: 800,
                  }}>
                    {userStyles.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: T.textMuted, fontSize: 12 }}>
              Loading styles…
            </div>
          ) : filteredStyles.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: T.textMuted, fontSize: 12 }}>
              {activeCategory === "my-styles" ? "No custom styles yet" : "No styles in this category"}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {filteredStyles.map(style => (
                <StyleCard
                  key={style.id}
                  style={style}
                  selected={selected.includes(style.id)}
                  onToggle={toggleStyle}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer — selected styles with weight sliders */}
        {selectedStyles.length > 0 && (
          <div style={{
            padding: "14px 20px",
            borderTop: `1px solid ${T.border}`,
            background: "rgba(9,12,19,0.5)",
          }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: T.textMuted,
              letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10,
            }}>
              Selected styles ({selectedStyles.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {selectedStyles.map(style => (
                <WeightSlider
                  key={style.id}
                  styleId={style.id}
                  styleName={style.name}
                  weight={weights[style.id] ?? 0.5}
                  onChange={updateWeight}
                  onRemove={removeStyle}
                />
              ))}
            </div>
            <button
              onClick={() => {
                onApply(selectedStyles.map(s => ({ id: s.id, weight: weights[s.id] ?? 0.5 })));
                onClose();
              }}
              style={{
                padding: "10px 16px", borderRadius: 10, width: "100%",
                background: "linear-gradient(135deg, #b45309, #f59e0b)",
                border: "none", color: "#090c13",
                fontSize: 13, fontWeight: 800, cursor: "pointer",
                letterSpacing: "0.03em",
              }}
            >
              Apply Styles
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
