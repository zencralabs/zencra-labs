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

// ── Auth snapshot — visual placeholder only, never used for security ──────────
//
// Stores the minimum display fields from the last successful profile load so
// the Navbar can show the user's name/credits on the very first render, before
// onAuthStateChange and loadProfile() have completed.  Never used for
// permissions, entitlements, or any security decision.

interface AuthSnapshot {
  email: string;
  name: string;
  role: string;
  plan: string;
  credits: number;
  avatar?: string;
}

function readAuthSnapshot(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("zencra_auth_snapshot");
    if (!raw) return null;
    const s = JSON.parse(raw) as AuthSnapshot;
    // Return a minimal display-only AuthUser.  All security-sensitive flags are
    // defaulted to the most restrictive value — they will be overwritten with
    // real values once loadProfile() completes.
    return {
      id:                       "",   // unknown until session resolves
      email:                    s.email   ?? "",
      name:                     s.name    ?? "",
      role:                     s.role    ?? "user",
      plan:                     (PLAN_MAP[s.plan] ?? "free"),
      credits:                  s.credits ?? 0,
      avatar:                   s.avatar,
      avatarColor:              0,
      joinedAt:                 "",
      accessToken:              undefined,
      emailVerified:            false,
      phoneVerified:            false,
      needsEmailVerification:   false,
      needsPhone:               false,
      needsEmail:               false,
      emailLocked:              false,
      totpEnabled:              false,
      passkeyRegistered:        false,
      fcsEnabled:               false,
    };
  } catch {
    return null;
  }
}

function saveAuthSnapshot(u: AuthUser): void {
  try {
    const snap: AuthSnapshot = {
      email:   u.email,
      name:    u.name,
      role:    u.role,
      plan:    u.plan,
      credits: u.credits,
      avatar:  u.avatar,
    };
    localStorage.setItem("zencra_auth_snapshot", JSON.stringify(snap));
  } catch { /* non-fatal */ }
}

function clearAuthSnapshot(): void {
  try { localStorage.removeItem("zencra_auth_snapshot"); } catch { /* non-fatal */ }
}

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
// MODULE-LEVEL PROFILE DEDUP
//
// React Strict Mode double-invokes effects (mount → unmount → remount) in dev.
// React refs are recreated on remount, so a ref-based in-flight guard can be
// defeated when the second INITIAL_SESSION fires after the ref resets.
// Module-level vars survive remounts and reliably prevent:
//   • Duplicate loadProfile DB calls (→ duplicate auth-lock acquisitions)
//   • "lock:zencra-auth-token was released because another request stole it" spam
//   • Rapid TOKEN_REFRESHED re-fetches stacking up concurrent queries
// ─────────────────────────────────────────────────────────────────────────────

let _profileInFlight     = false;
/** userId whose profile was last successfully loaded */
let _profileLoadedForUser: string | null = null;
let _profileLoadedAt     = 0;
/** Skip re-fetch if the same user's profile was loaded within this window */
const PROFILE_COOLDOWN_MS = 5_000;

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  // Seed from snapshot so the very first render already has display data.
  // The snapshot is a visual placeholder only — it is replaced with real data
  // as soon as onAuthStateChange + loadProfile() complete.
  const [user, setUser]       = useState<AuthUser | null>(() => readAuthSnapshot());
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Incremented on every logout so any in-flight loadProfile call can detect
  // that the session changed and discard its stale result instead of
  // re-hydrating the user after sign-out.
  const loadGenRef     = useRef(0);
  // Guards against concurrent loadProfile calls (e.g. INITIAL_SESSION firing
  // immediately before TOKEN_REFRESHED). Without this, both calls race to
  // acquire the Supabase auth token lock, producing "lock:zencra-auth-token
  // was released before acquiring" console spam and potential double-writes.
  const loadInFlightRef = useRef(false);

  async function loadProfile(sess: Session) {
    const now = Date.now();

    // ── Module-level dedup ────────────────────────────────────────────────────
    // 1. Drop if another invocation is already running (Strict Mode re-fire,
    //    simultaneous TOKEN_REFRESHED + INITIAL_SESSION, etc.).
    // 2. Skip if we loaded this user's profile very recently — prevents rapid
    //    re-fetches from TOKEN_REFRESHED events stacking DB queries.
    if (_profileInFlight) return;
    if (
      _profileLoadedForUser === sess.user.id &&
      now - _profileLoadedAt < PROFILE_COOLDOWN_MS
    ) return;

    _profileInFlight = true;
    loadInFlightRef.current = true;

    // Capture generation at call time. If logout fires before the query resolves,
    // loadGenRef.current will have been incremented and we discard the result.
    const gen = loadGenRef.current;

    try {
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
        const fallbackUser = buildAuthUser(null, sess);
        setUser(fallbackUser);
        saveAuthSnapshot(fallbackUser);
        return;
      }

      const fullUser = buildAuthUser(profile as Record<string, unknown> | null, sess);
      setUser(fullUser);
      saveAuthSnapshot(fullUser);
      // Mark as successfully loaded so rapid re-fires are suppressed.
      _profileLoadedForUser = sess.user.id;
      _profileLoadedAt      = Date.now();
    } finally {
      _profileInFlight        = false;
      loadInFlightRef.current = false;
    }
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
      (_event, sess) => {
        setSession(sess);
        if (sess) {
          // ── Immediately set a provisional user from the session object. ──
          //
          // This closes the null window that causes the Navbar to flash
          // "Login" while loadProfile() is awaiting the DB query (1–2 s).
          //
          // Priority: keep the snapshot/existing user if it belongs to THIS
          // session (avoids a visible credits-reset during the provisional →
          // full-profile transition).  Otherwise build from session metadata.
          setUser(prev =>
            prev && prev.id === sess.user.id
              ? prev
              : buildAuthUser(null, sess)
          );
          // ── Fire-and-forget profile enrichment ───────────────────────────
          // loadProfile() fetches real credits/role/plan from the DB and
          // updates user state when done.  We do NOT await it here — the
          // callback must return quickly so the Supabase auth internals can
          // release their lock.  Awaiting loadProfile() here caused
          // "lock:zencra-auth-token was released because another request stole
          // it" spam when multiple events (INITIAL_SESSION + TOKEN_REFRESHED +
          // Strict Mode re-subscribe) fired while the DB query was in flight.
          void loadProfile(sess);
        } else {
          // Session ended — clear everything immediately.
          setUser(null);
          clearAuthSnapshot();
        }
        // ── Unlock loading immediately ───────────────────────────────────────
        // The provisional user is already set above, so the UI can render
        // right away.  The real profile data will arrive shortly via the
        // fire-and-forget loadProfile() call and trigger a second render with
        // the correct credits/plan values.
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
    // Reset all in-flight + cooldown guards so the next login triggers a fresh
    // profile fetch unconditionally.
    _profileInFlight      = false;
    _profileLoadedForUser = null;
    _profileLoadedAt      = 0;
    loadInFlightRef.current = false;

    // Clear auth state immediately — UI should reflect logged-out before
    // the network call completes.
    setUser(null);
    setSession(null);
    // Wipe the snapshot so a future cold load doesn't show the old user.
    clearAuthSnapshot();

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
    if (data) {
      setUser(prev => {
        if (!prev) return prev;
        const updated = { ...prev, credits: data.credits as number };
        saveAuthSnapshot(updated);
        return updated;
      });
    }
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
