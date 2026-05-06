import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin }  from "@/lib/auth/admin-gate";

/**
 * GET /api/admin/generations
 * Query params: page, limit, search (user id/name), status, type
 */
export async function GET(req: Request) {
  const { adminError } = await requireAdmin(req);
  if (adminError) return adminError;

  const url    = new URL(req.url);
  const page   = parseInt(url.searchParams.get("page")   ?? "1");
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 100);
  const search = url.searchParams.get("search") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const type   = url.searchParams.get("type")   ?? "";

  const from = (page - 1) * limit;
  const to   = from + limit - 1;

  let query = supabaseAdmin
    .from("generations")
    .select(
      `id, user_id, type, status, prompt, result_url, cost_credits, created_at, updated_at,
       profiles!inner(full_name, avatar_url, plan)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status) query = query.eq("status", status);
  if (type)   query = query.eq("type", type);
  if (search) query = query.ilike("profiles.full_name", `%${search}%`);

  const { data, count, error } = await query;
  if (error) {
    console.error("[admin/generations] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: data ?? [],
    meta: { total: count ?? 0, page, limit, pages: Math.ceil((count ?? 0) / limit) },
  });
}
