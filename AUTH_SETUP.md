# Zencra Labs — Auth Setup Guide

Complete setup guide for all authentication providers. Follow each section in order.

---

## 1. Supabase Project (Required)

1. Go to [supabase.com](https://supabase.com) → create a new project.
2. Copy the following into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` — Settings → API → Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Settings → API → anon public
   - `SUPABASE_SERVICE_ROLE_KEY` — Settings → API → service_role (keep secret!)

3. Run the migration in **Supabase SQL Editor**:
   ```
   supabase/migrations/20260412_auth_upgrade.sql
   ```
   Paste the full contents and click **Run**.

4. In Supabase Dashboard → **Auth → URL Configuration**:
   - Site URL: `https://www.zencralabs.com`
   - Redirect URLs: `https://www.zencralabs.com/auth/callback`

---

## 2. Resend — Transactional Email

1. Sign in at [resend.com](https://resend.com) (you already have an account).
2. **Add domain**: Domains → Add → `zencralabs.com` → follow DNS instructions.
3. Once verified, create an API key: API Keys → Create API Key.
4. Add to `.env.local`: `RESEND_API_KEY=re_...`

The "From" address is `Zencra Labs <support@zencralabs.com>`. Make sure `support@zencralabs.com` is a verified sender on Resend (just having the domain verified is sufficient).

---

## 3. Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named **Zencra Labs** (or use existing).
3. APIs & Services → **OAuth consent screen**:
   - User type: External
   - App name: Zencra Labs
   - User support email: `zencralabs@gmail.com`
   - Developer contact: `support@zencralabs.com`
   - Authorized domains: `zencralabs.com`
4. APIs & Services → **Credentials** → Create Credentials → OAuth client ID:
   - Application type: Web application
   - Name: Zencra Labs Web
   - Authorized JavaScript origins: `https://www.zencralabs.com`
   - Authorized redirect URIs: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
5. Copy **Client ID** and **Client Secret**.
6. In **Supabase Dashboard** → Auth → Providers → Google:
   - Enable: ✓
   - Client ID: paste
   - Client Secret: paste
   - Save

---

## 4. Apple Sign In

1. Sign in at [developer.apple.com](https://developer.apple.com) with `support@zencralabs.com`.
2. Pay the $99/year Apple Developer Program fee.
3. **Certificates, IDs & Profiles** → Identifiers → + (Register new):
   - Select **App IDs** → App → Continue
   - Bundle ID: `com.zencralabs.app`
   - Enable: Sign In with Apple → Continue → Register
4. Identifiers → + → **Services IDs**:
   - Description: Zencra Labs Sign In
   - Identifier: `com.zencralabs.app.signin`
   - Enable: Sign In with Apple → Configure
   - Primary App ID: `com.zencralabs.app`
   - Domains: `zencralabs.com`
   - Return URLs: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
   - Save → Continue → Register
5. **Keys** → + → Register a new key:
   - Key Name: Zencra Labs Sign In
   - Enable: Sign In with Apple → Configure → Primary App ID: `com.zencralabs.app`
   - Register → Download `AuthKey_XXXXXX.p8`
   - Copy the **Key ID**
   - From your team page, copy **Team ID**
6. In **Supabase Dashboard** → Auth → Providers → Apple:
   - Enable: ✓
   - Service ID (client_id): `com.zencralabs.app.signin`
   - Team ID: your team ID
   - Key ID: your key ID
   - Private Key: paste full contents of `AuthKey_XXXXXX.p8`
   - Save
7. Update `public/.well-known/apple-app-site-association`:
   - Replace `TEAMID` with your actual Apple Team ID.

---

## 5. Facebook Login

1. Go to [developers.facebook.com](https://developers.facebook.com) → My Apps → Create App.
2. App type: **Consumer** → Continue.
3. App name: **Zencra Labs** | Contact email: `zencralabs@gmail.com`.
4. Add Product → **Facebook Login** → Set Up → Web.
5. Settings → Basic:
   - App Domains: `zencralabs.com`
   - Privacy Policy URL: `https://www.zencralabs.com/privacy`
   - Terms of Service URL: `https://www.zencralabs.com/terms`
   - Copy **App ID** and **App Secret**
6. Facebook Login → Settings:
   - Valid OAuth Redirect URIs: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
   - Save Changes
7. In **Supabase Dashboard** → Auth → Providers → Facebook:
   - Enable: ✓
   - App ID: paste
   - App Secret: paste
   - Save
8. To go live: App Review → Permissions → `email`, `public_profile` (default, no review needed) → Switch to Live mode.

---

## 6. Phone Auth (Twilio Verify)

Supabase uses your Twilio account for SMS OTP.

1. In **Supabase Dashboard** → Auth → Providers → Phone:
   - Enable: ✓
   - SMS provider: **Twilio**
   - Account SID: from twilio.com → Console → Account Info
   - Auth Token: from twilio.com → Console → Account Info
   - Message Service SID: create a Messaging Service at twilio.com → Messaging → Services
   - Save

---

## 7. Passkeys (WebAuthn)

Passkeys work automatically once the domain association files are in place.

**For web**: No extra setup — `supabase.auth.signInWithPasskey()` handles it.

**For the `.well-known` files to work on Vercel**, ensure:
1. `public/.well-known/apple-app-site-association` — update `TEAMID` with your Apple Team ID.
2. `public/.well-known/assetlinks.json` — update `PLACEHOLDER_SHA256_FINGERPRINT` with your Android app's SHA-256 certificate fingerprint (only needed if you later build an Android app).

---

## 8. Environment Variables Summary

Copy `.env.example` → `.env.local` and fill in these variables:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `RESEND_API_KEY` | resend.com → API Keys |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud Console |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google Cloud Console |
| `APPLE_SERVICE_ID` | Apple Developer → Service IDs |
| `APPLE_TEAM_ID` | Apple Developer → Membership |
| `APPLE_KEY_ID` | Apple Developer → Keys |
| `APPLE_PRIVATE_KEY` | Contents of `AuthKey_*.p8` |
| `FACEBOOK_APP_ID` | Facebook Developer Console |
| `FACEBOOK_APP_SECRET` | Facebook Developer Console |

> OAuth credentials (Google, Apple, Facebook) are configured **in Supabase Dashboard**, not directly in your app. The env vars above are for reference only — you don't need to add them to `.env.local` unless you're using them server-side.

---

## 9. Vercel Deployment

Add all required variables from `.env.local` to **Vercel → Project → Settings → Environment Variables**.

After deploying, verify:
- `https://www.zencralabs.com/auth/callback` returns a spinner (not 404)
- `https://www.zencralabs.com/.well-known/apple-app-site-association` returns JSON
- OAuth login works end-to-end in production
