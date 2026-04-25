import { resolveFlags } from '@/lib/providers/core/feature-flags';
import { SafetyGate } from './safety-gate';
import { SoulService } from './soul-service';
import { VersionService, VersionType } from './version-service';
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface CharacterGenerationOptions {
  userId: string;
  character_id: string;
  soul_id?: string;
  mode?: VersionType;
  prompt: string;
  provider: string;
  jobId: string;
}

export class CharacterOrchestrator {
  static async prepareGeneration(options: CharacterGenerationOptions): Promise<{
    enrichedPrompt: string;
    soulRecord: Record<string, unknown> | null;
  }> {
    const flags = resolveFlags();
    if (!flags.characterStudioEnabled) {
      throw new Error('Character Studio is not yet available');
    }

    // Safety check — extends existing sanitization, does not replace it
    const safetyResult = await SafetyGate.check(options.prompt, options.userId, {
      character_id: options.character_id,
      soul_id: options.soul_id,
    });

    if (!safetyResult.safe) {
      throw new Error(`Prompt failed safety check: ${safetyResult.violations.join(', ')}`);
    }

    // Load soul record if provided and enrich prompt
    let soulRecord: Record<string, unknown> | null = null;
    let enrichedPrompt = safetyResult.sanitized;

    if (options.soul_id) {
      try {
        soulRecord = await SoulService.getSoul(options.soul_id) as Record<string, unknown>;
        const soul = soulRecord as { identity_prompt?: string; style_dna?: Record<string, unknown> };
        if (soul.identity_prompt) {
          enrichedPrompt = `${soul.identity_prompt}. ${enrichedPrompt}`;
        }
      } catch {
        // Soul not found — proceed without enrichment
        console.warn('[CharacterOrchestrator] Soul not found, proceeding without enrichment');
      }
    }

    return { enrichedPrompt, soulRecord };
  }

  static async recordVersion(payload: {
    character_id: string;
    soul_id?: string;
    asset_id?: string;
    version_type: VersionType;
    job_id: string;
    metadata?: Record<string, unknown>;
  }) {
    return VersionService.createVersion({
      character_id: payload.character_id,
      soul_id: payload.soul_id,
      asset_id: payload.asset_id,
      version_type: payload.version_type,
      metadata: { job_id: payload.job_id, ...payload.metadata },
    });
  }

  static async linkJobToCharacter(jobId: string, characterId: string, soulId?: string, jobContext?: string) {
    try {
      const supabase = supabaseAdmin;
      await supabase
        .from('generation_jobs')
        .update({
          character_id: characterId,
          soul_id: soulId ?? null,
          job_context: jobContext ?? null,
        })
        .eq('id', jobId);
    } catch {
      // Non-fatal — job linking should not block the response
      console.error('[CharacterOrchestrator] Failed to link job to character');
    }
  }
}
