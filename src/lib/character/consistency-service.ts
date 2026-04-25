export interface ConsistencyResult {
  consistencyScore: number | null;
  identityStrength: number | null;
  styleMatchScore: number | null;
  notes: string[];
}

/**
 * Phase 3A stub — consistency evaluation hook.
 * Phase 3B will implement real cosine similarity against soul embeddings.
 */
export async function evaluateCharacterConsistency(args: {
  characterId: string;
  soulId: string;
  assetId?: string;
}): Promise<ConsistencyResult> {
  console.info(`[ConsistencyEngine] Stub evaluation — character=${args.characterId} soul=${args.soulId} asset=${args.assetId ?? 'none'}`);
  return {
    consistencyScore: null,
    identityStrength: null,
    styleMatchScore: null,
    notes: ['Consistency engine not yet active. Phase 3B will implement embedding comparison.'],
  };
}
