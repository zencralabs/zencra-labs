import { supabaseAdmin } from '@/lib/supabase/admin';

// Passthrough — no external sanitizer wired yet.
// Safety is handled by the blocked-pattern check below.
const sanitizePrompt = (p: string) => p;

export interface SafetyCheckResult {
  safe: boolean;
  sanitized: string;
  violations: string[];
}

export class SafetyGate {
  static async check(prompt: string, userId: string, context?: {
    character_id?: string;
    soul_id?: string;
  }): Promise<SafetyCheckResult> {
    const sanitized = sanitizePrompt(prompt);
    const violations: string[] = [];

    // Extended violation detection — adds to existing sanitization
    const blockedPatterns = [
      /\b(nude|naked|explicit|nsfw)\b/i,
      /\b(minor|child|underage|teen)\b/i,
      /\b(deepfake|non.?consensual)\b/i,
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(prompt)) {
        violations.push(pattern.source);
      }
    }

    // Log violations if any (non-fatal)
    if (violations.length > 0) {
      await SafetyGate.logViolation(userId, prompt, violations, context);
    }

    return {
      safe: violations.length === 0,
      sanitized,
      violations,
    };
  }

  static async logViolation(userId: string, prompt: string, violations: string[], context?: {
    character_id?: string;
    soul_id?: string;
  }) {
    try {
      const supabase = supabaseAdmin;
      await supabase.from('prompt_violations').insert({
        user_id: userId,
        prompt_excerpt: prompt.substring(0, 500),
        violations,
        character_id: context?.character_id ?? null,
        soul_id: context?.soul_id ?? null,
        occurred_at: new Date().toISOString(),
      });
    } catch {
      // Non-fatal — violation logging must not block the request
      console.error('[SafetyGate] Failed to log violation');
    }
  }

  static async logConsentDeclaration(userId: string, payload: {
    asset_id?: string;
    character_id?: string;
    source_type: 'self' | 'owned_reference' | 'fictional' | 'brand_character';
    consent_confirmed: boolean;
  }) {
    const supabase = supabaseAdmin;
    const { error } = await supabase.from('reference_consent').insert({
      user_id: userId,
      ...payload,
      declared_at: new Date().toISOString(),
    });
    if (error) throw error;
  }
}
