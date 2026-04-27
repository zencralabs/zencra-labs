"use client";

/**
 * DeleteConfirmModal — Premium inline confirmation modal
 * Reusable for Video canvas preview, Video gallery, Image gallery, etc.
 *
 * Usage:
 *   <DeleteConfirmModal
 *     open={showDelete}
 *     title="Delete video?"
 *     description="This cannot be undone."
 *     onConfirm={handleDelete}
 *     onCancel={() => setShowDelete(false)}
 *     loading={deleting}
 *   />
 */

import { useEffect, useRef } from "react";
import { Trash2, X } from "lucide-react";

interface DeleteConfirmModalProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function DeleteConfirmModal({
  open,
  title = "Delete this item?",
  description = "This action is permanent and cannot be undone.",
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  loading = false,
}: DeleteConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus confirm button when modal opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => confirmRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    // Backdrop
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        animation: "fadeIn 0.15s ease",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      {/* Panel */}
      <div
        style={{
          background: "#111",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 4,
          padding: "28px 28px 24px",
          width: 360,
          maxWidth: "90vw",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
          animation: "slideUp 0.18s ease",
          position: "relative",
        }}
      >
        {/* Close X */}
        <button
          onClick={onCancel}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.4)",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 2,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Trash2 size={18} color="#EF4444" />
        </div>

        {/* Title */}
        <p
          style={{
            fontFamily: "var(--font-syne, Syne, sans-serif)",
            fontSize: 17,
            fontWeight: 600,
            color: "#fff",
            margin: "0 0 8px",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </p>

        {/* Description */}
        <p
          style={{
            fontFamily: "var(--font-familjen, 'Familjen Grotesk', sans-serif)",
            fontSize: 13,
            color: "rgba(255,255,255,0.5)",
            margin: "0 0 24px",
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 3,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.7)",
              fontFamily: "var(--font-familjen, 'Familjen Grotesk', sans-serif)",
              fontSize: 13,
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; } }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
          >
            Cancel
          </button>

          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 3,
              border: "1px solid rgba(239,68,68,0.4)",
              background: loading ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.18)",
              color: loading ? "rgba(239,68,68,0.5)" : "#EF4444",
              fontFamily: "var(--font-familjen, 'Familjen Grotesk', sans-serif)",
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.15s, color 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = "rgba(239,68,68,0.28)"; } }}
            onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = "rgba(239,68,68,0.18)"; } }}
          >
            {loading ? (
              <span style={{ opacity: 0.6 }}>Deleting…</span>
            ) : (
              <>
                <Trash2 size={13} />
                {confirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
