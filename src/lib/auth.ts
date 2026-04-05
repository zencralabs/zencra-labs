/**
 * Auth helpers — server-side only
 * Use these in API routes and server components
 */
import { createAdminClient } from "./supabase";

export async function getUserById(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data;
}

export async function deductCredits(
  userId: string,
  amount: number,
  description: string,
  metadata: Record<string, unknown> = {}
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const admin = createAdminClient();

  // Get current balance
  const { data: profile, error: fetchError } = await admin
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();

  if (fetchError || !profile) return { success: false, error: "User not found" };
  if (profile.credits < amount) return { success: false, error: "Insufficient credits" };

  const newBalance = profile.credits - amount;

  // Deduct credits
  const { error: updateError } = await admin
    .from("profiles")
    .update({ credits: newBalance })
    .eq("id", userId);

  if (updateError) return { success: false, error: "Failed to deduct credits" };

  // Log transaction
  await admin.from("credit_transactions").insert({
    user_id: userId,
    type: "spend",
    amount: -amount,
    balance_after: newBalance,
    description,
    metadata,
  });

  return { success: true, newBalance };
}

export async function refundCredits(
  userId: string,
  amount: number,
  description: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();

  if (!profile) return;
  const newBalance = profile.credits + amount;

  await admin.from("profiles").update({ credits: newBalance }).eq("id", userId);
  await admin.from("credit_transactions").insert({
    user_id: userId,
    type: "refund",
    amount,
    balance_after: newBalance,
    description,
    metadata,
  });
}
