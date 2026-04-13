/**
 * seed-admins.ts
 * ──────────────
 * Creates (or updates) the two admin accounts for Zencra Labs.
 *
 * Run once from your terminal after deploying:
 *   npx tsx scripts/seed-admins.ts
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMINS = [
  { email: "zencralabs@gmail.com",  password: "12345678", full_name: "Zencra Labs"  },
  { email: "iamjuzjai@gmail.com",   password: "12345678", full_name: "Jai (Admin)"  },
];

async function upsertAdmin({ email, password, full_name }: { email: string; password: string; full_name: string }) {
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

  // 2. Upsert profile with role = 'admin'
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id:         userId,
        full_name,
        role:       "admin",
        plan:       "Agency",
        credits:    99999,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (profileError) {
    console.error(`❌  Failed to upsert profile for ${email}:`, profileError.message);
  } else {
    console.log(`✅  Profile set to admin for ${email}`);
  }
}

async function main() {
  console.log("\n🚀  Seeding admin accounts…\n");
  for (const admin of ADMINS) {
    await upsertAdmin(admin);
  }
  console.log("\n✅  Done! Both admin accounts are ready.\n");
  console.log("   Login at:  https://zencralabs.com/?auth=login");
  console.log("   Dashboard: https://zencralabs.com/hub\n");
}

main().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
