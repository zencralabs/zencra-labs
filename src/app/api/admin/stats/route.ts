import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin }  from "@/lib/auth/admin-gate";

export async function GET(req: Request) {
  const { adminError } = await requireAdmin(req);
  if (adminError) return adminError;

  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    // Run all queries in parallel
    const [
      usersTotal,
      usersToday,
      usersThisWeek,
      generationsTotal,
      generationsToday,
      generationsFailed,
      planBreakdown,
      revenueTotal,
      revenueThisMonth,
      creditsInCirculation,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("is_system", false),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("is_system", false).gte("created_at", today),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("is_system", false).gte("created_at", sevenDaysAgo),
      supabaseAdmin.from("generations").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("generations").select("id", { count: "exact", head: true }).gte("created_at", today),
      supabaseAdmin.from("generations").select("id", { count: "exact", head: true }).eq("status", "failed"),
      supabaseAdmin.from("profiles").select("plan").eq("is_system", false),
      supabaseAdmin.from("payments").select("amount_usd").eq("status", "paid"),
      supabaseAdmin.from("payments").select("amount_usd").eq("status", "paid").gte("created_at", new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
      supabaseAdmin.from("profiles").select("credits").eq("is_system", false),
    ]);

    // Plan distribution
    const plans: Record<string, number> = { free: 0, starter: 0, pro: 0, creator: 0 };
    (planBreakdown.data ?? []).forEach((p: { plan: string }) => {
      const key = (p.plan ?? "free").toLowerCase();
      plans[key] = (plans[key] ?? 0) + 1;
    });

    // Revenue
    const mrr = (revenueThisMonth.data ?? []).reduce((s: number, p: { amount_usd: number }) => s + (p.amount_usd ?? 0), 0);
    const arr = (revenueTotal.data ?? []).reduce((s: number, p: { amount_usd: number }) => s + (p.amount_usd ?? 0), 0);

    // Credits
    const totalCredits = (creditsInCirculation.data ?? []).reduce((s: number, p: { credits: number }) => s + (p.credits ?? 0), 0);

    // Success rate
    const totalGen = generationsTotal.count ?? 0;
    const failedGen = generationsFailed.count ?? 0;
    const successRate = totalGen > 0 ? Math.round(((totalGen - failedGen) / totalGen) * 100) : 100;

    const paidUsers = (planBreakdown.data ?? []).filter((p: { plan: string }) =>
      !["free", ""].includes((p.plan ?? "free").toLowerCase())
    ).length;

    return NextResponse.json({
      success: true,
      data: {
        users: {
          total: usersTotal.count ?? 0,
          today: usersToday.count ?? 0,
          thisWeek: usersThisWeek.count ?? 0,
          paid: paidUsers,
        },
        generations: {
          total: generationsTotal.count ?? 0,
          today: generationsToday.count ?? 0,
          successRate,
        },
        revenue: {
          mrr: Math.round(mrr * 100) / 100,
          arr: Math.round(arr * 100) / 100,
        },
        credits: { total: totalCredits },
        planBreakdown: plans,
        thirtyDaysAgo,
      },
    });
  } catch (err) {
    console.error("[admin/stats]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
