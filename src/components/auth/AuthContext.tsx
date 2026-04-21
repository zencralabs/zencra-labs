"use client";

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// AUTH CONTEXT — Full production auth
// Supports: Email/Password, Google/Apple/Facebook OAuth, Phone OTP,
//           Email Verification gating, Passkeys, 2FA (TOTP via Supabase MFA)
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "user" | "admin" | string;
  plan: "free" | "starter" | "pro" | "creator" | string;
  credits: number;
  avatar?: string;
  avatarColor?: number;
  joinedAt: string;
  accessToken?: string;
  // Verification states
  emailVerified: boolean;
  phoneVerified: boolean;
  // Account completion flags
  needsEmailVerification: boolean;   // signed up but email not confirmed yet
  needsPhone: boolean;               // email-only user, should add phone
  needsEmail: boolean;               // phone-only user, must add email
  // Subscription / email lock
  subscriptionPurchasedAt?: string;
  emailLockExpiresAt?: string;
  emailLocked: boolean;              // true if past the lock window
  // Security
  totpEnabled: boolean;
  passkeyRegistered: boolean;
  // Feature access flags
  fcsEnabled: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  /** captchaToken is optional — omitting it works in mock/dev mode */
  login: (email: string, password: string, captchaToken?: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string, captchaToken?: string) => Promise<boolean>;
  loginWithOAuth: (provider: "google" | "apple" | "facebook") => Promise<void>;
  sendPhoneOtp: (phone: string, captchaToken?: string) => Promise<{ success: boolean; error?: string }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<boolean>;
  loginWithPasskey: () => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Re-fetch just the credit balance */
  refreshCredits: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Plan values stored in DB are already lowercase — pass through as-is
const PLAN_MAP: Record<string, AuthUser["plan"]> = {
  free:    "free",
  starter: "starter",
  pro:     "pro",
  creator: "creator",
};

const EMAIL_LOCK_HOURS = parseInt(process.env.NEXT_PUBLIC_EMAIL_LOCK_WINDOW_HOURS ?? "2", 10);

function buildAuthUser(
  profile: Record<string, unknown> | null,
  sess: Session
): AuthUser {
  const now      = Date.now();
  const subAt    = profile?.subscription_purchased_at as string | undefined;
  const lockExp  = profile?.email_lock_expires_at as string | undefined;
  const emailLocked = subAt
    ? (lockExp ? now > new Date(lockExp).getTime() : true)
    : false;

  // Determine if user is phone-only (no email) or email-only (no phone)
  const hasEmail  = Boolean(sess.user.email);
  const hasPhone  = Boolean(sess.user.phone ?? profile?.phone);
  const emailConf = Boolean(sess.user.email_confirmed_at ?? profile?.email_verified);

  return {
    id:           sess.user.id,
    email:        sess.user.email ?? "",
    phone:        (sess.user.phone ?? profile?.phone as string) || undefined,
    name:         (profile?.full_name as string) || (sess.user.user_metadata?.full_name as string) || (sess.user.email?.split("@")[0] ?? "User"),
    role:         (profile?.role as string) ?? "user",
    plan:         PLAN_MAP[(profile?.plan as string) ?? "free"] ?? "free",
    credits:      (profile?.credits as number) ?? 0,
    joinedAt:     (profile?.created_at as string) ?? sess.user.created_at,
    avatar:       (profile?.avatar_url as string) || undefined,
    // avatar_color is stored as text in DB (e.g. "gradient-1") — keep as-is
    avatarColor:  (profile?.avatar_color as unknown as number) ?? 0,
    accessToken:  sess.access_token,
    // Verification
    emailVerified:          emailConf,
    phoneVerified:          (profile?.phone_verified as boolean) ?? false,
    needsEmailVerification: hasEmail && !emailConf,
    needsEmail:             !hasEmail,
    needsPhone:             hasEmail && !hasPhone,
    // Subscription lock
    subscriptionPurchasedAt: subAt,
    emailLockExpiresAt:      lockExp,
    emailLocked,
    // Security
    totpEnabled:       (profile?.totp_enabled as boolean) ?? false,
    passkeyRegistered: (profile?.passkey_registered as boolean) ?? false,
    // Feature access
    fcsEnabled:        (profile?.fcs_access as boolean) ?? false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Incremented on every logout so any in-flight loadProfile call can detect
  // that the session changed and discard its stale result instead of
  // re-hydrating the user after sign-out.
  const loadGenRef = useRef(0);

  async function loadProfile(sess: Session) {
    // Capture generation at call time. If logout fires before the query resolves,
    // loadGenRef.current will have been incremented and we discard the result.
    const gen = loadGenRef.current;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("full_name, role, plan, credits, created_at, phone, phone_verified, email_verified, subscription_purchased_at, email_lock_expires_at, totp_enabled, passkey_registered, avatar_color, avatar_url, fcs_access")
      .eq("id", sess.user.id)
      .single();

    // Discard stale result if logout (or a newer auth event) happened while we awaited.
    if (loadGenRef.current !== gen) return;

    if (error) {
      console.error("[loadProfile] error:", error.message);
      // Still set user from session so auth flow completes (profile enrichment is non-fatal).
      // Without this, user stays null after login if the profiles query fails,
      // leaving the auth modal stuck showing "Please wait…" indefinitely.
      setUser(buildAuthUser(null, sess));
      return;
    }

    setUser(buildAuthUser(profile as Record<string, unknown> | null, sess));
  }

  // Bootstrap
  useEffect(() => {
    if (!isSupabaseConfigured) {
      try {
        const stored = localStorage.getItem("zencra_user");
        if (stored) setUser(JSON.parse(stored) as AuthUser);
      } catch { /* ignore */ }
      setLoading(false);
      return;
    }

    // Bootstrap via onAuthStateChange only — do NOT call getSession() separately.
    //
    // Why: getSession() acquires a Supabase auth lock. If another tab is
    // mid-refresh when a new tab opens, getSession() blocks indefinitely,
    // leaving the new tab stuck in a logged-out state and causing any
    // subsequent signInWithPassword call to hang on the same lock.
    //
    // onAuthStateChange fires INITIAL_SESSION immediately from the in-memory
    // cache (populated from localStorage when createClient ran) — no lock,
    // no async wait, works correctly across all tabs.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        setSession(sess);
        if (sess) await loadProfile(sess);
        else      setUser(null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Email / Password login ─────────────────────────────────────────────────
  async function login(email: string, password: string, captchaToken?: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
      if (!email) return false;
      const mock: AuthUser = {
        id: "usr_" + Math.random().toString(36).slice(2, 10),
        name: email.split("@")[0], email, phone: undefined,
        role: "user", plan: "free", credits: 42, joinedAt: new Date().toISOString(),
        emailVerified: true, phoneVerified: false,
        needsEmailVerification: false, needsPhone: true, needsEmail: false,
        emailLocked: false, totpEnabled: false, passkeyRegistered: false, fcsEnabled: false,
      };
      setUser(mock);
      localStorage.setItem("zencra_user", JSON.stringify(mock));
      return true;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (error) { console.warn("[login]", error.message); return false; }
    return true;
  }

  // ── Email / Password signup ────────────────────────────────────────────────
  async function signup(name: string, email: string, password: string, captchaToken?: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
      if (!email || !name) return false;
      const mock: AuthUser = {
        id: "usr_" + Math.random().toString(36).slice(2, 10),
        name, email, phone: undefined,
        role: "user", plan: "free", credits: 50, joinedAt: new Date().toISOString(),
        emailVerified: false, phoneVerified: false,
        needsEmailVerification: true, needsPhone: true, needsEmail: false,
        emailLocked: false, totpEnabled: false, passkeyRegistered: false, fcsEnabled: false,
      };
      setUser(mock);
      localStorage.setItem("zencra_user", JSON.stringify(mock));
      return true;
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    if (error) { console.error("[signup]", error.message); return false; }
    return true;
  }

  // ── OAuth (Google / Apple / Facebook) ─────────────────────────────────────
  async function loginWithOAuth(provider: "google" | "apple" | "facebook"): Promise<void> {
    if (!isSupabaseConfigured) {
      console.warn("[OAuth] Supabase not configured — skipping OAuth");
      return;
    }
    const redirectTo = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, queryParams: { access_type: "offline", prompt: "consent" } },
    });
    if (error) console.error(`[OAuth ${provider}]`, error.message);
    // Browser will navigate to provider — no further action needed here
  }

  // ── Phone OTP — Step 1: send ───────────────────────────────────────────────
  async function sendPhoneOtp(phone: string, captchaToken?: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: true }; // mock: always succeeds
    }
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  // ── Phone OTP — Step 2: verify ─────────────────────────────────────────────
  async function verifyPhoneOtp(phone: string, token: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
      // Mock: any 6-digit code works
      const mock: AuthUser = {
        id: "usr_" + Math.random().toString(36).slice(2, 10),
        name: "Phone User", email: "", phone,
        role: "user", plan: "free", credits: 50, joinedAt: new Date().toISOString(),
        emailVerified: false, phoneVerified: true,
        needsEmailVerification: false, needsPhone: false, needsEmail: true,
        emailLocked: false, totpEnabled: false, passkeyRegistered: false, fcsEnabled: false,
      };
      setUser(mock);
      localStorage.setItem("zencra_user", JSON.stringify(mock));
      return true;
    }
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
    if (error) { console.error("[verifyOtp]", error.message); return false; }
    return true;
  }

  // ── Passkey login ──────────────────────────────────────────────────────────
  async function loginWithPasskey(): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      // Supabase passkey signIn (requires Supabase Auth with passkeys enabled)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.auth as any).signInWithPasskey();
      if (error) { console.error("[passkey]", error.message); return false; }
      return true;
    } catch (e) {
      console.error("[passkey]", e);
      return false;
    }
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  async function logout() {
    // Increment generation counter so any in-flight loadProfile call discards
    // its result and doesn't re-hydrate the user after we clear state.
    loadGenRef.current++;

    // Clear auth state immediately — UI should reflect logged-out before
    // the network call completes.
    setUser(null);
    setSession(null);

    if (!isSupabaseConfigured) {
      localStorage.removeItem("zencra_user");
      router.push("/");
      return;
    }

    try {
      await supabase.auth.signOut();
    } catch {
      // Non-fatal — local state is already cleared so the user is effectively
      // logged out. The signOut may fail if the token was already expired.
    }

    router.push("/");
  }

  // ── Refresh full profile ───────────────────────────────────────────────────
  async function refreshUser() {
    if (session) await loadProfile(session);
  }

  // ── Refresh credits only ───────────────────────────────────────────────────
  async function refreshCredits() {
    if (!session || !user) return;
    const { data } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", session.user.id)
      .single();
    if (data) setUser(prev => prev ? { ...prev, credits: data.credits as number } : prev);
  }

  return (
    <AuthContext.Provider value={{
      user, session, loading,
      login, signup,
      loginWithOAuth, sendPhoneOtp, verifyPhoneOtp, loginWithPasskey,
      logout, refreshUser, refreshCredits,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
