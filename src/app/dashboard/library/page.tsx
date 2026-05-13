"use client";

import Link from "next/link";
import { ImageIcon, FolderOpen, User2, ArrowRight, Lock } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Library Landing — /dashboard/library
//
// Hub page for the Library section of the user dashboard.
// Surfaces three sub-sections: Assets, Projects, Characters (placeholder).
//
// Route strategy (v2-B):
//   /dashboard/library          ← this page (new)
//   /dashboard/generated        ← Assets full view (kept working, no redirect)
//   /dashboard/projects         ← Projects full view (unchanged)
//
// No backend changes. No API calls. Static landing only.
// ─────────────────────────────────────────────────────────────────────────────

interface LibrarySection {
  id: string;
  label: string;
  eyebrow: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  href: string;
  ctaLabel: string;
  badge?: string;
  comingSoon?: boolean;
  futureItems?: string[];
}

const SECTIONS: LibrarySection[] = [
  {
    id: "assets",
    label: "Assets",
    eyebrow: "GENERATED CONTENT",
    description:
      "Browse and manage every image, video, and audio file you've created across all studios. Filter by studio, project, or media type.",
    icon: ImageIcon,
    color: "#2563EB",
    bg: "rgba(37,99,235,0.08)",
    border: "rgba(37,99,235,0.2)",
    href: "/dashboard/generated",
    ctaLabel: "View all assets",
  },
  {
    id: "projects",
    label: "Projects",
    eyebrow: "CREATIVE CAMPAIGNS",
    description:
      "Organise your creative work into projects. Each project keeps your concepts, outputs, and assets together for easy access.",
    icon: FolderOpen,
    color: "#0EA5A0",
    bg: "rgba(14,165,160,0.08)",
    border: "rgba(14,165,160,0.2)",
    href: "/dashboard/projects",
    ctaLabel: "View all projects",
  },
  {
    id: "characters",
    label: "Characters",
    eyebrow: "AI IDENTITIES",
    description:
      "Saved identities coming soon. Build and lock AI characters with consistent faces, styles, and voice — then use them across every studio.",
    icon: User2,
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.06)",
    border: "rgba(245,158,11,0.15)",
    href: "/studio/character",
    ctaLabel: "Open Character Studio",
    badge: "Coming soon",
    comingSoon: true,
    futureItems: [
      "AI Influencers",
      "Locked identities",
      "Look packs",
      "Identity sheets",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Section card
// ─────────────────────────────────────────────────────────────────────────────

function LibrarySectionCard({ section }: { section: LibrarySection }) {
  const Icon = section.icon;

  return (
    <div
      style={{
        background: "var(--page-bg-2)",
        border: `1px solid rgba(255,255,255,0.06)`,
        borderRadius: "16px",
        padding: "28px 32px",
        display: "flex",
        alignItems: "flex-start",
        gap: "24px",
        position: "relative",
        overflow: "hidden",
        opacity: section.comingSoon ? 0.8 : 1,
      }}
    >
      {/* Subtle color accent strip */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: `linear-gradient(90deg, ${section.color}, transparent)`,
          opacity: 0.6,
        }}
      />

      {/* Icon box */}
      <div
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "14px",
          background: section.bg,
          border: `1px solid ${section.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={22} style={{ color: section.color }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <p
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#475569",
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            {section.eyebrow}
          </p>
          {section.badge && (
            <span
              style={{
                fontSize: "9px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "2px 8px",
                borderRadius: "6px",
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.25)",
                color: "#F59E0B",
              }}
            >
              {section.badge}
            </span>
          )}
        </div>

        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "22px",
            fontWeight: 700,
            color: "#F8FAFC",
            letterSpacing: "-0.01em",
            margin: "0 0 8px",
          }}
        >
          {section.label}
        </h2>

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "14px",
            color: "#64748B",
            lineHeight: 1.6,
            margin: "0 0 16px",
            maxWidth: "540px",
          }}
        >
          {section.description}
        </p>

        {/* Future items (Characters only) */}
        {section.futureItems && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
            {section.futureItems.map((item) => (
              <span
                key={item}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "#475569",
                  padding: "3px 10px",
                  borderRadius: "20px",
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <Lock size={9} style={{ opacity: 0.5 }} />
                {item}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <Link href={section.href} style={{ textDecoration: "none" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              fontWeight: 600,
              color: section.comingSoon ? "#F59E0B" : section.color,
              padding: "8px 16px",
              borderRadius: "10px",
              border: `1px solid ${section.comingSoon ? "rgba(245,158,11,0.2)" : section.border}`,
              background: section.comingSoon ? "rgba(245,158,11,0.06)" : section.bg,
              cursor: "pointer",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.75"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          >
            {section.ctaLabel}
            <ArrowRight size={13} />
          </div>
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  return (
    <div style={{ padding: "40px 40px 80px", maxWidth: "900px" }}>
      {/* Page header */}
      <div style={{ marginBottom: "36px" }}>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#475569",
            margin: "0 0 10px",
          }}
        >
          YOUR LIBRARY
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "36px",
            fontWeight: 700,
            color: "#F8FAFC",
            letterSpacing: "-0.02em",
            margin: "0 0 8px",
          }}
        >
          Library
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "15px",
            color: "#64748B",
            margin: 0,
          }}
        >
          Your creative assets, projects, and identities — all in one place.
        </p>
      </div>

      {/* Section cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {SECTIONS.map((section) => (
          <LibrarySectionCard key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}
