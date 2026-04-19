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
  const { userId, amount, description } = body;

  if (!userId || amount === undefined) {
    return NextResponse.json({ error: "userId and amount required" }, { status: 400 });
  }

  if (amount === 0) {
    return NextResponse.json({ success: true, note: "zero amount — no-op" });
  }

  // Use atomic RPCs — balance update + ledger entry in a single DB transaction
  const desc = description ?? `Admin credit adjustment: ${amount > 0 ? "+" : ""}${amount}`;
  const { error: rpcError } = amount > 0
    ? await supabaseAdmin.rpc("refund_credits", { p_user_id: userId, p_amount: amount,            p_description: desc })
    : await supabaseAdmin.rpc("spend_credits",  { p_user_id: userId, p_amount: Math.abs(amount), p_description: desc });

  if (rpcError) {
    console.error("[admin/transactions] rpc error:", rpcError.message);
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
