/**
 * GET /api/creative-director/projects/[projectId]/history
 *
 * Returns the full creative chain with lineage tree.
 * Generations are grouped: base → variations → adaptations → forks.
 * Each base generation includes its children grouped by type.
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { getProjectChain } from "@/lib/creative-director/save-history";
import type { CreativeGenerationRow } from "@/lib/creative-director/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

interface GenerationNode {
  generation: CreativeGenerationRow;
  variations: CreativeGenerationRow[];
  adaptations: CreativeGenerationRow[];
  forks: CreativeGenerationRow[];
}

export async function GET(req: Request, { params }: RouteContext): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  try {
    const chain = await getProjectChain(projectId, user.id);

    if (!chain) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { project, brief, concepts, generations } = chain;

    // Build lineage tree: group children under their parent
    const childrenByParent = new Map<string, CreativeGenerationRow[]>();

    for (const gen of generations) {
      if (gen.parent_generation_id) {
        const siblings = childrenByParent.get(gen.parent_generation_id) ?? [];
        siblings.push(gen);
        childrenByParent.set(gen.parent_generation_id, siblings);
      }
    }

    // Build tree nodes for base generations only
    const baseGenerations = generations.filter(
      (g) => g.generation_type === "base" && !g.parent_generation_id
    );

    const lineageTree: GenerationNode[] = baseGenerations.map((base) => {
      const children = childrenByParent.get(base.id) ?? [];
      return {
        generation: base,
        variations: children.filter((c) => c.generation_type === "variation"),
        adaptations: children.filter((c) => c.generation_type === "adaptation"),
        forks: children.filter((c) => c.generation_type === "fork"),
      };
    });

    return NextResponse.json({
      project,
      brief,
      concepts,
      lineageTree,
      totalGenerations: generations.length,
      stats: {
        base: generations.filter((g) => g.generation_type === "base").length,
        variations: generations.filter((g) => g.generation_type === "variation").length,
        adaptations: generations.filter((g) => g.generation_type === "adaptation").length,
        forks: generations.filter((g) => g.generation_type === "fork").length,
      },
    });
  } catch (err) {
    console.error(`[history/route] Failed for project ${projectId}:`, err);
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}
