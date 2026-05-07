import { NextResponse }                      from "next/server";
import { supabaseAdmin }                     from "@/lib/supabase/admin";
import { requireAdmin, logAdminAction }      from "@/lib/auth/admin-gate";

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

export async function GET(req: Request) {
  const { user, adminError } = await requireAdmin(req);
  if (adminError) return adminError;
  await logAdminAction(user.id, "/api/admin/analytics", "GET");

  try {
    const [usersRaw, generationsRaw, toolsRaw] = await Promise.all([
      // Last 30 days of user signups
      supabaseAdmin
        .from("profiles")
        .select("created_at")
        .eq("is_system", false)
        .gte("created_at", daysAgo(30))
        .order("created_at", { ascending: true }),

      // Last 30 days of generations
      supabaseAdmin
        .from("generations")
        .select("created_at, tool_category, status")
        .gte("created_at", daysAgo(30))
        .order("created_at", { ascending: true }),

      // Tool usage breakdown
      supabaseAdmin
        .from("generations")
        .select("tool")
        .gte("created_at", daysAgo(30)),
    ]);

    // Build 30-day buckets
    const signupsByDay: Record<string, number>      = {};
    const generationsByDay: Record<string, number>  = {};
    const categoryBreakdown: Record<string, number> = {};
    const toolBreakdown: Record<string, number>     = {};

    // Pre-fill 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      signupsByDay[key]      = 0;
      generationsByDay[key]  = 0;
    }

    (usersRaw.data ?? []).forEach((u: { created_at: string }) => {
      const key = u.created_at.slice(0, 10);
      if (key in signupsByDay) signupsByDay[key]++;
    });

    (generationsRaw.data ?? []).forEach((g: { created_at: string; tool_category: string; status: string }) => {
      const key = g.created_at.slice(0, 10);
      if (key in generationsByDay) generationsByDay[key]++;
      const cat = g.tool_category ?? "other";
      categoryBreakdown[cat] = (categoryBreakdown[cat] ?? 0) + 1;
    });

    (toolsRaw.data ?? []).forEach((g: { tool: string }) => {
      const t = g.tool ?? "unknown";
      toolBreakdown[t] = (toolBreakdown[t] ?? 0) + 1;
    });

    // Convert to arrays for recharts
    const dailySignups = Object.entries(signupsByDay).map(([date, count]) => ({ date, count }));
    const dailyGenerations = Object.entries(generationsByDay).map(([date, count]) => ({ date, count }));
    const categoryPie = Object.entries(categoryBreakdown).map(([name, value]) => ({ name, value }));
    const topTools = Object.entries(toolBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));

    return NextResponse.json({
      success: true,
      data: { dailySignups, dailyGenerations, categoryPie, topTools },
    });
  } catch (err) {
    console.error("[admin/analytics]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
