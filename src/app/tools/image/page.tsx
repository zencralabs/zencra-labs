"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { Wand2, Download, Copy, Loader2, Zap, AlertCircle, Image as ImageIcon } from "lucide-react";

const SIZES = [
  { label: "Square", value: "1024x1024", desc: "1024 × 1024" },
  { label: "Landscape", value: "1792x1024", desc: "1792 × 1024" },
  { label: "Portrait", value: "1024x1792", desc: "1024 × 1792" },
];

const STYLES = [
  { label: "Vivid", value: "vivid", desc: "Hyper-real, dramatic" },
  { label: "Natural", value: "natural", desc: "Subtle, realistic" },
];

const QUALITIES = [
  { label: "Standard", value: "standard", credits: 2 },
  { label: "HD", value: "hd", credits: 4 },
];

const EXAMPLE_PROMPTS = [
  "A futuristic AI laboratory glowing with neon blue light, ultra-realistic",
  "Abstract digital art of a neural network as a cosmic galaxy",
  "Minimalist logo design for a tech startup, clean white background",
  "Cinematic portrait of a robot artist painting on a canvas",
];

export default function ImageGeneratePage() {
  const { user, session } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [style, setStyle] = useState("vivid");
  const [quality, setQuality] = useState("standard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  const creditCost = QUALITIES.find((q) => q.value === quality)?.credits ?? 2;

  async function handleGenerate() {
    if (!prompt.trim()) return;
    if (!user) { setError("Please sign in to generate images."); return; }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      if (!session?.access_token) {
        setError("Session expired. Please sign in again.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prompt, size, style, quality }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Generation failed. Please try again.");
        return;
      }

      setResults(data.images ?? []);
      setCreditsLeft(data.credits_remaining);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  const [copied, setCopied] = useState<number | null>(null);

  async function handleDownload(url: string) {
    // Open in new tab — DALL-E URLs block cross-origin fetch (CORS)
    window.open(url, "_blank");
  }

  async function handleCopyUrl(url: string, index: number) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(index);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback: select a temp input
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(index);
      setTimeout(() => setCopied(null), 2000);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--page-bg)",
        color: "var(--page-text)",
        paddingTop: "80px",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "12px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ImageIcon size={22} color="white" />
            </div>
            <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.5rem)", fontWeight: 800, margin: 0, fontFamily: "var(--font-display)" }}>
              Image Generator
            </h1>
          </div>
          <p style={{ color: "var(--page-text-2)", margin: 0, fontSize: "1.05rem" }}>
            Powered by DALL-E 3 — describe anything, generate instantly.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: "32px", alignItems: "start" }}>

          {/* LEFT — Controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* Prompt */}
            <div style={{
              backgroundColor: "var(--page-bg-2)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "16px",
              padding: "24px",
            }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "12px", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--page-text-2)" }}>
                Your Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to create..."
                rows={4}
                style={{
                  width: "100%", padding: "14px 16px",
                  backgroundColor: "var(--page-bg-3)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: "12px",
                  color: "var(--page-text)", fontSize: "1rem",
                  resize: "vertical", outline: "none",
                  fontFamily: "var(--font-body)",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ marginTop: "12px" }}>
                <p style={{ fontSize: "0.78rem", color: "var(--page-text-muted)", marginBottom: "8px" }}>Try an example:</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPrompt(p)}
                      style={{
                        padding: "4px 10px", borderRadius: "20px", fontSize: "0.75rem",
                        backgroundColor: "var(--page-bg)", border: "1px solid var(--border-medium)",
                        color: "var(--page-text-2)", cursor: "pointer",
                      }}
                    >
                      {p.length > 40 ? p.slice(0, 40) + "…" : p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Settings */}
            <div style={{
              backgroundColor: "var(--page-bg-2)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "16px",
              padding: "24px",
              display: "flex", flexDirection: "column", gap: "20px",
            }}>
              {/* Quality */}
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "10px", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--page-text-2)" }}>
                  Quality
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {QUALITIES.map((q) => (
                    <button
                      key={q.value}
                      onClick={() => setQuality(q.value)}
                      style={{
                        flex: 1, padding: "10px 16px", borderRadius: "10px", cursor: "pointer",
                        border: quality === q.value ? "2px solid #6366f1" : "1px solid var(--border-medium)",
                        backgroundColor: quality === q.value ? "rgba(99,102,241,0.1)" : "var(--page-bg-3)",
                        color: quality === q.value ? "#6366f1" : "var(--page-text)",
                        fontWeight: quality === q.value ? 600 : 400,
                        display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
                      }}
                    >
                      <span style={{ fontSize: "0.95rem" }}>{q.label}</span>
                      <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>{q.credits} credits</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "10px", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--page-text-2)" }}>
                  Size
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {SIZES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setSize(s.value)}
                      style={{
                        flex: 1, padding: "10px 8px", borderRadius: "10px", cursor: "pointer",
                        border: size === s.value ? "2px solid #6366f1" : "1px solid var(--border-medium)",
                        backgroundColor: size === s.value ? "rgba(99,102,241,0.1)" : "var(--page-bg-3)",
                        color: size === s.value ? "#6366f1" : "var(--page-text)",
                        fontWeight: size === s.value ? 600 : 400,
                        display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
                      }}
                    >
                      <span style={{ fontSize: "0.9rem" }}>{s.label}</span>
                      <span style={{ fontSize: "0.72rem", opacity: 0.6 }}>{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "10px", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--page-text-2)" }}>
                  Style
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {STYLES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setStyle(s.value)}
                      style={{
                        flex: 1, padding: "10px 16px", borderRadius: "10px", cursor: "pointer",
                        border: style === s.value ? "2px solid #6366f1" : "1px solid var(--border-medium)",
                        backgroundColor: style === s.value ? "rgba(99,102,241,0.1)" : "var(--page-bg-3)",
                        color: style === s.value ? "#6366f1" : "var(--page-text)",
                        fontWeight: style === s.value ? 600 : 400,
                        display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
                      }}
                    >
                      <span style={{ fontSize: "0.9rem" }}>{s.label}</span>
                      <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              style={{
                width: "100%", padding: "16px 24px",
                background: loading || !prompt.trim()
                  ? "var(--border-medium)"
                  : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none", borderRadius: "14px",
                color: "white", fontWeight: 700, fontSize: "1.05rem",
                cursor: loading || !prompt.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                transition: "opacity 0.2s",
                fontFamily: "var(--font-body)",
              }}
            >
              {loading
                ? <><Loader2 size={20} className="animate-spin-slow" /> Generating…</>
                : <><Wand2 size={20} /> Generate Image — <Zap size={16} />{creditCost} credits</>
              }
            </button>

            {/* Error */}
            {error && (
              <div style={{
                padding: "14px 16px", borderRadius: "12px",
                backgroundColor: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#ef4444", display: "flex", alignItems: "center", gap: "10px",
              }}>
                <AlertCircle size={18} />
                <span style={{ fontSize: "0.9rem" }}>{error}</span>
              </div>
            )}
          </div>

          {/* RIGHT — Output */}
          <div style={{ position: "sticky", top: "88px" }}>
            <div style={{
              backgroundColor: "var(--page-bg-2)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "16px",
              overflow: "hidden",
              minHeight: "420px",
            }}>
              {/* Output header */}
              <div style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Output</span>
                {creditsLeft !== null && (
                  <span style={{ fontSize: "0.8rem", color: "var(--page-text-2)" }}>
                    <Zap size={12} style={{ display: "inline", marginRight: "4px" }} />
                    {creditsLeft} credits left
                  </span>
                )}
              </div>

              {/* Image output */}
              <div style={{ padding: "20px" }}>
                {loading && (
                  <div style={{
                    height: "320px", display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: "16px",
                    color: "var(--page-text-2)",
                  }}>
                    <Loader2 size={40} className="animate-spin-slow" />
                    <p style={{ margin: 0, fontSize: "0.9rem" }}>Creating your image…</p>
                    <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.6 }}>Usually takes 10–20 seconds</p>
                  </div>
                )}

                {!loading && results.length === 0 && !error && (
                  <div style={{
                    height: "320px", display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: "12px",
                    color: "var(--page-text-muted)",
                  }}>
                    <ImageIcon size={48} strokeWidth={1} />
                    <p style={{ margin: 0, fontSize: "0.9rem" }}>Your image will appear here</p>
                  </div>
                )}

                {results.map((url, i) => (
                  <div key={i} style={{ marginBottom: i < results.length - 1 ? "16px" : 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Generated image ${i + 1}`}
                      style={{
                        width: "100%", borderRadius: "10px",
                        display: "block",
                      }}
                    />
                    <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                      <button
                        onClick={() => handleDownload(url)}
                        style={{
                          flex: 1, padding: "8px", borderRadius: "8px", cursor: "pointer",
                          backgroundColor: "var(--page-bg-3)",
                          border: "1px solid var(--border-medium)",
                          color: "var(--page-text)", fontSize: "0.85rem",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                        }}
                      >
                        <Download size={14} /> Open / Save
                      </button>
                      <button
                        onClick={() => handleCopyUrl(url, i)}
                        style={{
                          flex: 1, padding: "8px", borderRadius: "8px", cursor: "pointer",
                          backgroundColor: copied === i ? "rgba(99,102,241,0.15)" : "var(--page-bg-3)",
                          border: copied === i ? "1px solid #6366f1" : "1px solid var(--border-medium)",
                          color: copied === i ? "#6366f1" : "var(--page-text)", fontSize: "0.85rem",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                          transition: "all 0.2s",
                        }}
                      >
                        <Copy size={14} /> {copied === i ? "Copied!" : "Copy URL"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
