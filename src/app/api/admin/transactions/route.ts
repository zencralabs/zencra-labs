import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/server";

async function isAdmin(req: Request): Promise<boolean> {
  const user = await getAuthUser(req);
  if (!user) return false;
  const { data } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
  return data?.role === "admin";
}

/**
 * GET /api/admin/transactions
 * Returns credit_transactions with user info.
 * Query params: page, limit, userId, type (purchase|use|admin|refund)
 */
export async function GET(req: Request) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url    = new URL(req.url);
  const page   = parseInt(url.searchParams.get("page")   ?? "1");
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 100);
  const userId = url.searchParams.get("userId") ?? "";
  const type   = url.searchParams.get("type")   ?? "";

  const from = (page - 1) * limit;
  const to   = from + limit - 1;

  let query = supabaseAdmin
    .from("credit_transactions")
    .select(
      `id, user_id, type, amount, balance_after, description, created_at,
       profiles!inner(full_name, plan, avatar_url)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (userId) query = query.eq("user_id", userId);
  if (type)   query = query.eq("type", type);

  const { data, count, error } = await query;
  if (error) {
    console.error("[admin/transactions] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: data ?? [],
    meta: { total: count ?? 0, page, limit, pages: Math.ceil((count ?? 0) / limit) },
  });
}

/**
 * POST /api/admin/transactions
 * Manually insert a credit transaction (admin credit grant/deduction).
 * Body: { userId, amount, description, type? }
 */
export async function POST(req: Request) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, amount, description, type = "admin" } = body;

  if (!userId || amount === undefined) {
    return NextResponse.json({ error: "userId and amount required" }, { status: 400 });
  }

  // Get current balance
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();

  const currentCredits = (profile?.credits as number) ?? 0;
  const newBalance = Math.max(0, currentCredits + amount);

  // Update profile credits
  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ credits: newBalance, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log transaction
  const { error: txError } = await supabaseAdmin
    .from("credit_transactions")
    .insert({
      user_id: userId,
      type,
      amount,
      balance_after: newBalance,
      description: description ?? `Admin credit adjustment: ${amount > 0 ? "+" : ""}${amount}`,
    });

  if (txError) {
    console.error("[admin/transactions] log error:", txError.message);
  }

  return NextResponse.json({ success: true, newBalance });
}
