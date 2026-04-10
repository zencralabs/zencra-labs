/**
 * Auth helpers — server-side only
 * Use these in API routes and server components.
 *
 * Credit operations use Postgres RPCs (spend_credits / refund_credits)
 * to guarantee atomicity via row-level locking — preventing the race
 * condition where two concurrent requests both pass the balance check.
 */
import { supabaseAdmin } from "./supabase/admin";

export async function getUserById(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data;
}

/**
 * Atomically deducts credits from a user's balance.
 * Uses the spend_credits Postgres RPC — a single locked transaction.
 *
 * @param generationId  Optional: links the transaction to a generation row
 */
export async function deductCredits(
  userId: string,
  amount: number,
  description: string,
  metadata: Record<string, unknown> = {}
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const generationId = metadata.generation_id as string | undefined;

  const { data, error } = await supabaseAdmin.rpc("spend_credits", {
    p_user_id:       userId,
    p_amount:        amount,
    p_description:   description,
    p_generation_id: generationId ?? null,
  });

  if (error) return { success: false, error: error.message };

  const row = data?.[0];
  if (!row?.success) {
    return { success: false, error: row?.error_message ?? "Credit deduction failed" };
  }

  return { success: true, newBalance: row.new_balance };
}

/**
 * Atomically refunds credits to a user's balance.
 * Uses the refund_credits Postgres RPC — a single locked transaction.
 *
 * @param generationId  Optional: links the refund to the original generation
 */
export async function refundCredits(
  userId: string,
  amount: number,
  description: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const generationId = metadata.generation_id as string | undefined;

  const { error } = await supabaseAdmin.rpc("refund_credits", {
    p_user_id:       userId,
    p_amount:        amount,
    p_description:   description,
    p_generation_id: generationId ?? null,
  });

  if (error) {
    console.error("[refundCredits] RPC failed:", error.message, { userId, amount });
  }
}
