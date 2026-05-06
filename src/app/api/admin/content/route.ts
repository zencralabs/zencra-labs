import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin }  from "@/lib/auth/admin-gate";

// Default content fallbacks
const DEFAULTS: Record<string, string> = {
  hero_headline:     "Create Cinematic AI Videos",
  hero_subheadline:  "From Idea to Film in Minutes",
  hero_description:  "Generate images, animate them into videos, and add voice with perfect lip-sync — all in one unified AI workflow.",
  announcement_text: "",
  announcement_link: "",
  announcement_active: "false",
  maintenance_mode:  "false",
};

export async function GET(req: Request) {
  const { adminError } = await requireAdmin(req);
  if (adminError) return adminError;

  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("key, value");

  if (error) {
    // Table might not exist yet — return defaults
    return NextResponse.json({ success: true, data: DEFAULTS });
  }

  const merged = { ...DEFAULTS };
  (data ?? []).forEach((row: { key: string; value: string }) => {
    merged[row.key] = row.value;
  });

  return NextResponse.json({ success: true, data: merged });
}

export async function POST(req: Request) {
  const { adminError } = await requireAdmin(req);
  if (adminError) return adminError;

  const body = await req.json() as Record<string, string>;
  const allowed = Object.keys(DEFAULTS);
  const updates = Object.entries(body).filter(([k]) => allowed.includes(k));

  for (const [key, value] of updates) {
    await supabaseAdmin
      .from("site_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  return NextResponse.json({ success: true });
}
