"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// AUTH CONTEXT — Supabase real auth
// Same interface as the mock — all components using useAuth() need zero changes
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  plan: "Free" | "Creator" | "Studio" | "Agency";
  credits: number;
  avatar?: string;
  joinedAt: string;
  // Supabase session — needed to call API routes with Bearer token
  accessToken?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  /** Re-fetch profile from Supabase (call after credit changes) */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Map a Supabase profile row + session into our AuthUser shape */
function buildAuthUser(profile: Record<string, unknown>, session: Session): AuthUser {
  const planMap: Record<string, AuthUser["plan"]> = {
    free: "Free",
    starter: "Creator",
    pro: "Studio",
    creator: "Agency",
  };
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: (profile.full_name as string) || (session.user.email?.split("@")[0] ?? "User"),
    plan: planMap[(profile.plan as string) ?? "free"] ?? "Free",
    credits: (profile.credits as number) ?? 0,
    joinedAt: (profile.created_at as string) ?? session.user.created_at,
    accessToken: session.access_token,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  /** Fetch profile from DB and update user state */
  async function loadProfile(sess: Session) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, plan, credits, created_at")
      .eq("id", sess.user.id)
      .single();

    if (profile) {
      setUser(buildAuthUser(profile as Record<string, unknown>, sess));
    } else {
      // Profile not ready yet (trigger still running) — use session data only
      setUser({
        id: sess.user.id,
        email: sess.user.email ?? "",
        name: sess.user.email?.split("@")[0] ?? "User",
        plan: "Free",
        credits: 0,
        joinedAt: sess.user.created_at,
        accessToken: sess.access_token,
      });
    }
  }

  // Bootstrap: restore session on mount + listen for auth changes
  useEffect(() => {
    // If Supabase isn't configured yet, fall back to localStorage mock auth
    if (!isSupabaseConfigured) {
      try {
        const stored = localStorage.getItem("zencra_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          setUser(parsed);
        }
      } catch {}
      setLoading(false);
      return;
    }

    // Get current session immediately
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      if (sess) {
        loadProfile(sess).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for sign-in / sign-out / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        setSession(sess);
        if (sess) {
          await loadProfile(sess);
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string): Promise<boolean> {
    // Mock auth fallback when Supabase not configured
    if (!isSupabaseConfigured) {
      if (!email) return false;
      const mockUser: AuthUser = {
        id: "usr_" + Math.random().toString(36).slice(2, 10),
        name: email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        email, plan: "Free", credits: 42,
        joinedAt: new Date().toISOString(),
      };
      setUser(mockUser);
      localStorage.setItem("zencra_user", JSON.stringify(mockUser));
      return true;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { console.error("Login error:", error.message); return false; }
    return true;
  }

  async function signup(name: string, email: string, password: string): Promise<boolean> {
    // Mock auth fallback when Supabase not configured
    if (!isSupabaseConfigured) {
      if (!email || !name) return false;
      const mockUser: AuthUser = {
        id: "usr_" + Math.random().toString(36).slice(2, 10),
        name, email, plan: "Free", credits: 50,
        joinedAt: new Date().toISOString(),
      };
      setUser(mockUser);
      localStorage.setItem("zencra_user", JSON.stringify(mockUser));
      return true;
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) { console.error("Signup error:", error.message); return false; }
    return true;
  }

  async function logout() {
    if (!isSupabaseConfigured) {
      localStorage.removeItem("zencra_user");
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }

  async function refreshUser() {
    if (session) await loadProfile(session);
  }

  return (
    <AuthContext.Provider value={{ user, session, login, signup, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
