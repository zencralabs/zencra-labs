/**
 * seed-accounts.ts
 * ─────────────────
 * Sets up Zencra Labs accounts with correct roles:
 *   zencralabs@gmail.com  → admin  (hub dashboard)
 *   iamjuzjai@gmail.com   → user   (member/test account)
 *
 * Run once from your terminal:
 *   npx tsx scripts/seed-admins.ts
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local manually (no dotenv dependency needed)
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local not found — rely on actual env vars
}

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ACCOUNTS = [
  { email: "zencralabs@gmail.com", password: "12345678", full_name: "Zencra Labs", role: "admin",  plan: "pro",  credits: 99999 },
  { email: "iamjuzjai@gmail.com",  password: "12345678", full_name: "Jai",          role: "user",   plan: "pro",  credits: 500   },
];

async function upsertAdmin({ email, password, full_name, role, plan, credits }: typeof ACCOUNTS[0]) {
  // 1. Check if user already exists in auth
  const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const found = existing?.users?.find(u => u.email === email);

  let userId: string;

  if (found) {
    userId = found.id;
    // Update password in case it drifted
    await supabase.auth.admin.updateUserById(userId, { password });
    console.log(`✅  Found existing auth user: ${email} (${userId})`);
  } else {
    // Create new auth user
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      console.error(`❌  Failed to create auth user ${email}:`, error?.message);
      return;
    }
    userId = data.user.id;
    console.log(`🆕  Created auth user: ${email} (${userId})`);
  }

  // 2. Upsert profile with correct role
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id:         userId,
        full_name,
        role,
        plan,
        credits,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (profileError) {
    console.error(`❌  Failed to upsert profile for ${email}:`, profileError.message);
  } else {
    console.log(`✅  Profile set → role: ${role}, plan: ${plan} for ${email}`);
  }
}

async function main() {
  console.log("\n🚀  Seeding Zencra Labs accounts…\n");
  for (const account of ACCOUNTS) {
    await upsertAdmin(account);
  }
  console.log("\n✅  Done!\n");
  console.log("   Admin login:   https://zencralabs.com/?auth=login → goes to /hub");
  console.log("   Member login:  https://zencralabs.com/?auth=login → goes to /dashboard");
  console.log("   Dashboard: https://zencralabs.com/hub\n");
}

main().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
