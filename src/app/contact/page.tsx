"use client";

import { useState } from "react";
import { Send, Instagram, Youtube, Mail, MapPin } from "lucide-react";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div style={{ backgroundColor: "#080E1C", color: "#F8FAFC", minHeight: "100vh" }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden pt-32 pb-16 text-center">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.12) 0%, transparent 70%)" }} />
        <div className="relative z-10 mx-auto max-w-2xl px-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", color: "#C084FC" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#A855F7", boxShadow: "0 0 6px #A855F7" }} />
            Let&apos;s Connect
          </div>
          <h1 className="mb-4 font-bold text-white" style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)" }}>
            Get in <span style={{ background: "linear-gradient(135deg, #A855F7, #2563EB)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Touch</span>
          </h1>
          <p className="text-lg" style={{ color: "#94A3B8" }}>
            Have a project in mind? Let&apos;s create something extraordinary together.
          </p>
        </div>
      </section>

      {/* ── CONTENT ────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-5">

          {/* Left — Info */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            <div>
              <h2 className="mb-6 text-2xl font-bold text-white">Contact Info</h2>
              <div className="flex flex-col gap-4">
                {[
                  { icon: Mail, label: "Email", value: "jkn.devcraft@gmail.com", color: "#2563EB" },
                  { icon: MapPin, label: "Based in", value: "India", color: "#0EA5A0" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                      <Icon size={18} style={{ color }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>{label}</p>
                      <p className="text-sm text-white">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Social */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>Follow the Work</h3>
              <div className="flex flex-col gap-3">
                {[
                  { icon: Instagram, label: "Instagram", handle: "@zencralabs", color: "#E1306C", href: "#" },
                  { icon: Youtube, label: "YouTube", handle: "Zencra Labs", color: "#FF0000", href: "#" },
                ].map(({ icon: Icon, label, handle, color, href }) => (
                  <a key={label} href={href}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${color}40`; (e.currentTarget as HTMLElement).style.background = `${color}08`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}>
                    <Icon size={18} style={{ color }} />
                    <div>
                      <p className="text-xs font-semibold text-white">{label}</p>
                      <p className="text-xs" style={{ color: "#64748B" }}>{handle}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Response time */}
            <div className="rounded-2xl p-5" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
              <p className="text-sm font-semibold text-white mb-1">⚡ Fast Response</p>
              <p className="text-sm" style={{ color: "#94A3B8" }}>Typically reply within 24 hours. For urgent projects, mention it in your message.</p>
            </div>
          </div>

          {/* Right — Form */}
          <div className="lg:col-span-3">
            {sent ? (
              <div className="flex flex-col items-center justify-center rounded-2xl p-12 text-center h-full"
                style={{ background: "rgba(14,165,160,0.08)", border: "1px solid rgba(14,165,160,0.25)" }}>
                <div className="mb-4 text-5xl">🎉</div>
                <h3 className="mb-2 text-2xl font-bold text-white">Message Sent!</h3>
                <p style={{ color: "#94A3B8" }}>Thanks for reaching out. I&apos;ll get back to you within 24 hours.</p>
                <button onClick={() => setSent(false)} className="mt-6 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-all"
                  style={{ background: "linear-gradient(135deg, #2563EB, #0EA5A0)" }}>
                  Send Another
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="rounded-2xl p-8 flex flex-col gap-5"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {[
                    { key: "name", label: "Your Name", placeholder: "Jai Kumar", type: "text" },
                    { key: "email", label: "Email Address", placeholder: "you@example.com", type: "email" },
                  ].map(({ key, label, placeholder, type }) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>{label}</label>
                      <input type={type} placeholder={placeholder} required
                        value={form[key as keyof typeof form]}
                        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                        className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                        onFocus={e => { e.target.style.borderColor = "rgba(37,99,235,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)"; }}
                        onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }} />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>Subject</label>
                  <input type="text" placeholder="AI Video Project / Web Design / Logo..." required
                    value={form.subject}
                    onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                    className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onFocus={e => { e.target.style.borderColor = "rgba(37,99,235,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)"; }}
                    onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>Message</label>
                  <textarea placeholder="Tell me about your project..." required rows={5}
                    value={form.message}
                    onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                    className="w-full resize-none rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onFocus={e => { e.target.style.borderColor = "rgba(37,99,235,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)"; }}
                    onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }} />
                </div>
                <button type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition-all duration-300"
                  style={{ background: "linear-gradient(135deg, #2563EB 0%, #0EA5A0 100%)", boxShadow: "0 0 30px rgba(37,99,235,0.35)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 50px rgba(37,99,235,0.6)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 30px rgba(37,99,235,0.35)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
                  <Send size={15} /> Send Message
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
