"use client";

import { useState } from "react";
import { Eye, EyeOff, ArrowRight, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function SignUpPage() {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
  };

  const perks = [
    "5 free AI image generations",
    "3 free AI video generations",
    "Access to all creative tools",
    "No credit card required",
  ];

  return (
    <div style={{ backgroundColor: "#080E1C", color: "#F8FAFC", minHeight: "100vh" }}
      className="flex items-center justify-center px-6 py-24">

      {/* Glow */}
      <div className="pointer-events-none fixed inset-0" aria-hidden="true"
        style={{ background: "radial-gradient(ellipse at 60% 30%, rgba(14,165,160,0.12) 0%, transparent 70%)" }} />

      <div className="relative z-10 w-full max-w-4xl">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 items-center">

          {/* Left — value prop */}
          <div className="hidden lg:block">
            <Link href="/" className="mb-8 inline-flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: "linear-gradient(135deg, #2563EB, #0EA5A0)" }}>
                <span className="text-sm font-black text-white">Z</span>
              </div>
              <span className="text-lg font-bold text-white">Zencra <span style={{ color: "#64748B" }}>Labs</span></span>
            </Link>
            <h2 className="mb-4 text-3xl font-bold text-white leading-tight">
              Start creating with AI — <span style={{ background: "linear-gradient(135deg, #0EA5A0, #2563EB)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>for free</span>
            </h2>
            <p className="mb-8 text-sm leading-relaxed" style={{ color: "#94A3B8" }}>
              Join Zencra Labs and generate cinematic videos, stunning images, and professional audio using the world&apos;s most powerful AI tools.
            </p>
            <div className="flex flex-col gap-3">
              {perks.map(p => (
                <div key={p} className="flex items-center gap-2.5">
                  <CheckCircle size={16} style={{ color: "#0EA5A0" }} />
                  <span className="text-sm" style={{ color: "#CBD5E1" }}>{p}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div>
            {/* Mobile logo */}
            <div className="mb-8 text-center lg:hidden">
              <Link href="/" className="inline-flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: "linear-gradient(135deg, #2563EB, #0EA5A0)" }}>
                  <span className="text-sm font-black text-white">Z</span>
                </div>
                <span className="text-lg font-bold text-white">Zencra <span style={{ color: "#64748B" }}>Labs</span></span>
              </Link>
            </div>

            <div className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h1 className="mb-1 text-2xl font-bold text-white">Create your account</h1>
              <p className="mb-7 text-sm" style={{ color: "#64748B" }}>Free forever. Upgrade when you&apos;re ready.</p>

              {/* Google */}
              <button className="mb-5 flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all duration-200"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}>
                <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
                Continue with Google
              </button>

              <div className="mb-5 flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
                <span className="text-xs" style={{ color: "#475569" }}>or sign up with email</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
              </div>

              <form onSubmit={e => e.preventDefault()} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>Full Name</label>
                  <input type="text" placeholder="Jai Kumar" required value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = "rgba(14,165,160,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(14,165,160,0.1)"; }}
                    onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>Email</label>
                  <input type="email" placeholder="you@example.com" required value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = "rgba(14,165,160,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(14,165,160,0.1)"; }}
                    onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>Password</label>
                  <div className="relative">
                    <input type={show ? "text" : "password"} placeholder="Min. 8 characters" required value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-slate-600 outline-none transition-all"
                      style={inputStyle}
                      onFocus={e => { e.target.style.borderColor = "rgba(14,165,160,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(14,165,160,0.1)"; }}
                      onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }} />
                    <button type="button" onClick={() => setShow(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#475569" }}>
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <p className="text-xs" style={{ color: "#475569" }}>
                  By signing up, you agree to our{" "}
                  <a href="#" className="underline" style={{ color: "#64748B" }}>Terms of Service</a>{" "}and{" "}
                  <a href="#" className="underline" style={{ color: "#64748B" }}>Privacy Policy</a>.
                </p>

                <button type="submit"
                  className="flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300"
                  style={{ background: "linear-gradient(135deg, #0EA5A0 0%, #2563EB 100%)", boxShadow: "0 0 25px rgba(14,165,160,0.35)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(14,165,160,0.6)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 25px rgba(14,165,160,0.35)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
                  Create Free Account <ArrowRight size={15} />
                </button>
              </form>
            </div>

            <p className="mt-6 text-center text-sm" style={{ color: "#475569" }}>
              Already have an account?{" "}
              <a href="/login" className="font-semibold transition-colors" style={{ color: "#0EA5A0" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#2DD4BF"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#0EA5A0"; }}>
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
