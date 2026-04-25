import { supabaseAdmin } from '@/lib/supabase/admin';

const BLOCKED_PATTERNS = [
  /\b(nude|naked|explicit|nsfw|pornographic)\b/i,
  /\b(minor|child|underage|teen|juvenile)\b/i,
  /\b(deepfake|non[\s-]?consensual|without consent)\b/i,
  /\bmake me look (exactly )?like\b/i,
  /\bclone\b.{0,30}\b(person|celebrity|influencer|actor|politician)\b/i,
  /\bexactly like [a-z ]{3,40}\b/i,
];

export interface SafetyCheckResult {
  safe: boolean;
  violations: string[];
  sanitizedPrompt: string;
}

export function validateCharacterPrompt(prompt: string): SafetyCheckResult {
  const violations: string[] = [];
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(prompt)) {
      violations.push(`Blocked pattern detected: ${pattern.source.substring(0, 40)}`);
    }
  }
  return {
    safe: violations.length === 0,
    violations,
    sanitizedPrompt: prompt.trim(),
  };
}

export function validateReferenceConsent(payload: {
  source_type: string;
  consent_confirmed: boolean;
}): { valid: boolean; error?: string } {
  const requiresConsent = ['self', 'owned_reference'].includes(payload.source_type);
  if (requiresConsent && !payload.consent_confirmed) {
    return { valid: false, error: `Consent must be confirmed for source_type="${payload.source_type}"` };
  }
  const validSourceTypes = ['self', 'owned_reference', 'fictional', 'brand_character', 'unknown'];
  if (!validSourceTypes.includes(payload.source_type)) {
    return { valid: false, error: `Invalid source_type. Must be one of: ${validSourceTypes.join(', ')}` };
  }
  return { valid: true };
}

export async function logReferenceConsent(payload: {
  user_id: string;
  character_id?: string;
  asset_id?: string;
  source_type: string;
  consent_confirmed: boolean;
  consent_text?: string;
}): Promise<void> {
  try {
    const supabase = supabaseAdmin;
    await supabase.from('reference_consent').insert({
      user_id: payload.user_id,
      character_id: payload.character_id ?? null,
      asset_id: payload.asset_id ?? null,
      source_type: payload.source_type,
      consent_confirmed: payload.consent_confirmed,
      consent_text: payload.consent_text ?? null,
    });
  } catch {
    console.error('[CharacterSafety] Failed to log reference consent');
  }
}
