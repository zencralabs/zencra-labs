"use client";

import Link from "next/link";
import { ArrowRight, Clock, Tag } from "lucide-react";

const posts = [
  {
    slug: "ai-video-generation-guide",
    title: "The Complete Guide to AI Video Generation in 2025",
    excerpt: "Everything you need to know about generating cinematic AI videos — from prompt writing to model selection. We break down Kling 3.0, Runway ML, Google Veo, and Seedance so you can choose the right tool for every project.",
    category: "Tutorial",
    categoryColor: "#0EA5A0",
    readTime: "8 min read",
    date: "March 28, 2025",
    gradient: "linear-gradient(160deg, #0F1A32 0%, #0d2626 50%, #0ea5a0 100%)",
    accentColor: "#0EA5A0",
    featured: true,
  },
  {
    slug: "future-of-ai-creative-platforms",
    title: "The Future of AI Creative Platforms: Where We're Headed in 2026",
    excerpt: "AI creativity is evolving faster than any other technology sector. Here's our take on what's coming next — from real-time video generation to AI-powered creative direction and autonomous content pipelines.",
    category: "Insights",
    categoryColor: "#A855F7",
    readTime: "6 min read",
    date: "April 2, 2025",
    gradient: "linear-gradient(160deg, #0f0a1a 0%, #2d1b69 50%, #7c3aed 100%)",
    accentColor: "#A855F7",
    featured: false,
  },
];

export default function BlogPage() {
  return (
    <div style={{ backgroundColor: "#080E1C", color: "#F8FAFC", minHeight: "100vh" }}>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-36 pb-16 text-center">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.14) 0%, transparent 60%)" }} />
        <div className="relative z-10 mx-auto max-w-2xl px-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", color: "#C084FC" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#A855F7", boxShadow: "0 0 6px #A855F7" }} />
            Blog
          </div>
          <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">
            Insights &{" "}
            <span style={{ background: "linear-gradient(135deg, #A855F7, #0EA5A0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Tutorials
            </span>
          </h1>
          <p style={{ color: "#94A3B8" }}>
            Guides, deep-dives, and creative insights from the Zencra Labs team.
          </p>
        </div>
      </section>

      {/* ── BLOG POSTS ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {posts.map(post => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-300"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${post.accentColor}40`;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 40px ${post.accentColor}15`;
                (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
                (e.currentTarget as HTMLElement).style.transform = "none";
              }}
            >
              {/* Card visual header */}
              <div className="relative h-48 overflow-hidden" style={{ background: post.gradient }}>
                {post.featured && (
                  <div className="absolute top-4 left-4 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white"
                    style={{ background: "rgba(37,99,235,0.8)", border: "1px solid rgba(37,99,235,0.5)" }}>
                    Featured
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-16"
                  style={{ background: "linear-gradient(to top, rgba(8,14,28,0.9), transparent)" }} />
              </div>

              {/* Card content */}
              <div className="flex flex-1 flex-col p-6">
                {/* Meta */}
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: `${post.categoryColor}15`, color: post.categoryColor, border: `1px solid ${post.categoryColor}30` }}>
                    <Tag size={9} />
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: "#475569" }}>
                    <Clock size={10} />
                    {post.readTime}
                  </span>
                  <span className="text-xs" style={{ color: "#334155" }}>{post.date}</span>
                </div>

                <h2 className="mb-3 text-lg font-bold leading-snug text-white group-hover:text-white/90 transition-colors">
                  {post.title}
                </h2>
                <p className="mb-5 flex-1 text-sm leading-relaxed" style={{ color: "#64748B" }}>
                  {post.excerpt}
                </p>

                <div className="flex items-center gap-1 text-sm font-medium transition-colors"
                  style={{ color: post.accentColor }}>
                  Read article
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
