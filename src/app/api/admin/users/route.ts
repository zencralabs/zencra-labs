import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/server";

/** Allowlists prevent arbitrary string injection into plan/role columns */
const VALID_PLANS = new Set(["free", "starter", "pro", "creator"]);
const VALID_ROLES = new Set(["user", "admin", "moderator"]);

async function isAdmin(req: Request): Promise<boolean> {
  const user = await getAuthUser(req);
  if (!user) return false;
  const { data } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
  return data?.role === "admin";
}

// GET /api/admin/users?page=1&limit=20&search=&plan=&role=
export async function GET(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const page   = parseInt(url.searchParams.get("page")  ?? "1");
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 100);
  const search = url.searchParams.get("search") ?? "";
  const plan   = url.searchParams.get("plan")   ?? "";
  const role   = url.searchParams.get("role")   ?? "";

  const from = (page - 1) * limit;
  const to   = from + limit - 1;

  let query = supabaseAdmin
    .from("profiles")
    .select("id, full_name, username, avatar_url, avatar_color, plan, role, credits, created_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,username.ilike.%${search}%`);
  }
  if (plan)   query = query.eq("plan", plan);
  if (role)   query = query.eq("role", role);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch emails from auth.users via service role
  const ids = (data ?? []).map((u: { id: string }) => u.id);
  const emailMap: Record<string, string> = {};
  if (ids.length > 0) {
    // Supabase admin doesn't expose auth.users directly in client, use list users
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    (authData?.users ?? []).forEach((u) => { emailMap[u.id] = u.email ?? ""; });
  }

  const enriched = (data ?? []).map((u: Record<string, unknown>) => ({
    ...u,
    email: emailMap[u.id as string] ?? "",
  }));

  return NextResponse.json({
    success: true,
    data: enriched,
    meta: { total: count ?? 0, page, limit, pages: Math.ceil((count ?? 0) / limit) },
  });
}

// PATCH /api/admin/users — update a user's plan, credits, or role
export async function PATCH(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { userId, plan, credits, role, creditDelta } = body;

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // ── Allowlist validation ─────────────────────────────────────────────────────
  if (plan !== undefined && !VALID_PLANS.has(plan)) {
    return NextResponse.json({ error: `Invalid plan. Allowed: ${[...VALID_PLANS].join(", ")}` }, { status: 400 });
  }
  if (role !== undefined && !VALID_ROLES.has(role)) {
    return NextResponse.json({ error: `Invalid role. Allowed: ${[...VALID_ROLES].join(", ")}` }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (plan !== undefined) updates.plan = plan;
  if (role !== undefined) updates.role = role;

  // ── Atomic credit adjustment via RPCs ────────────────────────────────────────
  // creditDelta: positive = grant credits, negative = deduct credits
  // Both paths use the DB RPCs so the balance update + audit row are atomic.
  if (creditDelta !== undefined && creditDelta !== 0) {
    const description = `Admin adjustment: ${creditDelta > 0 ? "+" : ""}${creditDelta} credits`;
    if (creditDelta > 0) {
      // Grant: use refund_credits RPC (adds credits atomically)
      const { data: rpcData, error: rpcErr } = await supabaseAdmin
        .rpc("refund_credits", { p_user_id: userId, p_amount: creditDelta, p_description: description });
      if (rpcErr || !rpcData?.[0]?.success) {
        const msg = rpcData?.[0]?.error_message ?? rpcErr?.message ?? "Credit grant failed";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    } else {
      // Deduct: use spend_credits RPC (subtracts credits atomically, floors at 0)
      const { data: rpcData, error: rpcErr } = await supabaseAdmin
        .rpc("spend_credits", { p_user_id: userId, p_amount: Math.abs(creditDelta), p_description: description });
      if (rpcErr || !rpcData?.[0]?.success) {
        const msg = rpcData?.[0]?.error_message ?? rpcErr?.message ?? "Credit deduction failed";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }
  } else if (credits !== undefined) {
    // Absolute set (no RPC) — admin override of exact balance
    updates.credits = credits;
  }

  const { error } = await supabaseAdmin.from("profiles").update(updates).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
