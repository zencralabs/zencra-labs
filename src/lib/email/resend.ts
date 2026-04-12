/**
 * Resend email client — zero-dependency, fetch-based
 * No npm package required; uses the Resend REST API directly.
 *
 * Required env var: RESEND_API_KEY
 * From address: "Zencra Labs <support@zencralabs.com>"
 */

const RESEND_API = "https://api.resend.com/emails";
const FROM       = "Zencra Labs <support@zencralabs.com>";

interface SendResult {
  success: boolean;
  id?: string;
  error?: string;
}

async function send(payload: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[resend] RESEND_API_KEY not set — email not sent");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        ...(payload.text  ? { text: payload.text }        : {}),
        ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
      }),
    });

    const data = await res.json() as { id?: string; message?: string; name?: string };

    if (!res.ok) {
      const msg = data.message ?? data.name ?? `HTTP ${res.status}`;
      console.error("[resend] API error:", msg);
      return { success: false, error: msg };
    }

    return { success: true, id: data.id };
  } catch (err) {
    console.error("[resend] fetch error:", err);
    return { success: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

/** Shared header / footer for all Zencra emails */
function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Zencra Labs</title>
</head>
<body style="margin:0;padding:0;background:#060D1F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#060D1F;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#0D1829;border-radius:12px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Zencra</span>
                <span style="font-size:22px;font-weight:300;color:rgba(255,255,255,0.4);">Labs</span>
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.5;">
                You received this email because an account was created or actions were taken at
                <a href="https://www.zencralabs.com" style="color:rgba(255,255,255,0.4);text-decoration:none;">zencralabs.com</a>.
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:14px 28px;background:#2563EB;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.01em;">${label}</a>`;
}

// ── 1. Email Verification ─────────────────────────────────────────────────────

export async function sendVerificationEmail(opts: {
  to: string;
  name: string;
  verificationLink: string;
}): Promise<SendResult> {
  const html = layout(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;">Verify your email</h2>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
      Hi ${opts.name}, thanks for joining Zencra Labs! Click the button below to verify your
      email address and activate your account.
    </p>
    ${btn(opts.verificationLink, "Verify email address")}
    <p style="margin:24px 0 0;font-size:13px;color:rgba(255,255,255,0.35);line-height:1.5;">
      This link expires in 24 hours. If you didn't create an account, no action is needed.
    </p>
  `);

  return send({
    to: opts.to,
    subject: "Verify your Zencra Labs email",
    html,
    text: `Hi ${opts.name},\n\nVerify your Zencra Labs email:\n${opts.verificationLink}\n\nThis link expires in 24 hours.`,
  });
}

// ── 2. Welcome email (after email confirmed) ──────────────────────────────────

export async function sendWelcomeEmail(opts: {
  to: string;
  name: string;
}): Promise<SendResult> {
  const html = layout(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;">Welcome to Zencra Labs 🎉</h2>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
      Hi ${opts.name}, your account is all set. Start creating AI-powered images, videos,
      and audio right from your dashboard.
    </p>
    ${btn("https://www.zencralabs.com/dashboard", "Go to Dashboard")}
  `);

  return send({
    to: opts.to,
    subject: "Welcome to Zencra Labs!",
    html,
    text: `Hi ${opts.name},\n\nYour Zencra Labs account is ready.\nGo to your dashboard: https://www.zencralabs.com/dashboard`,
  });
}

// ── 3. Password reset ─────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(opts: {
  to: string;
  name: string;
  resetLink: string;
}): Promise<SendResult> {
  const html = layout(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;">Reset your password</h2>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
      Hi ${opts.name}, we received a request to reset the password for your account.
      Click below to choose a new password.
    </p>
    ${btn(opts.resetLink, "Reset password")}
    <p style="margin:24px 0 0;font-size:13px;color:rgba(255,255,255,0.35);line-height:1.5;">
      This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
    </p>
  `);

  return send({
    to: opts.to,
    subject: "Reset your Zencra Labs password",
    html,
    text: `Hi ${opts.name},\n\nReset your Zencra Labs password:\n${opts.resetLink}\n\nThis link expires in 1 hour.`,
  });
}

// ── 4. 2FA OTP (fallback email OTP) ──────────────────────────────────────────

export async function send2FACodeEmail(opts: {
  to: string;
  name: string;
  code: string;
}): Promise<SendResult> {
  const html = layout(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;">Your sign-in code</h2>
    <p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
      Hi ${opts.name}, use this code to complete your sign-in:
    </p>
    <div style="display:inline-block;padding:16px 32px;background:rgba(37,99,235,0.15);border:1px solid rgba(37,99,235,0.4);border-radius:10px;">
      <span style="font-size:32px;font-weight:700;color:#fff;letter-spacing:8px;">${opts.code}</span>
    </div>
    <p style="margin:20px 0 0;font-size:13px;color:rgba(255,255,255,0.35);line-height:1.5;">
      This code expires in 10 minutes. Never share it with anyone.
    </p>
  `);

  return send({
    to: opts.to,
    subject: `${opts.code} is your Zencra Labs code`,
    html,
    text: `Hi ${opts.name},\n\nYour Zencra Labs sign-in code: ${opts.code}\n\nExpires in 10 minutes.`,
  });
}

// ── 5. Security alert (new device / suspicious login) ─────────────────────────

export async function sendSecurityAlertEmail(opts: {
  to: string;
  name: string;
  device: string;
  location: string;
  time: string;
}): Promise<SendResult> {
  const html = layout(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;">New sign-in detected</h2>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
      Hi ${opts.name}, a new sign-in to your account was detected.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:8px 0;font-size:13px;color:rgba(255,255,255,0.4);width:100px;">Device</td><td style="font-size:14px;color:#fff;">${opts.device}</td></tr>
      <tr><td style="padding:8px 0;font-size:13px;color:rgba(255,255,255,0.4);">Location</td><td style="font-size:14px;color:#fff;">${opts.location}</td></tr>
      <tr><td style="padding:8px 0;font-size:13px;color:rgba(255,255,255,0.4);">Time</td><td style="font-size:14px;color:#fff;">${opts.time}</td></tr>
    </table>
    <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.65);">
      If this was you, no action is needed. If you don't recognise this sign-in, please
      <a href="https://www.zencralabs.com/dashboard/settings" style="color:#2563EB;text-decoration:none;">secure your account</a> immediately.
    </p>
  `);

  return send({
    to: opts.to,
    subject: "New sign-in to your Zencra Labs account",
    html,
    text: `Hi ${opts.name},\n\nNew sign-in detected.\nDevice: ${opts.device}\nLocation: ${opts.location}\nTime: ${opts.time}\n\nIf this wasn't you, visit https://www.zencralabs.com/dashboard/settings`,
  });
}
