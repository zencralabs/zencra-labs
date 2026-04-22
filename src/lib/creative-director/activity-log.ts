/**
 * Activity Log — Creative Director
 *
 * Fire-and-forget event logging for the creative_activity_log table.
 * All writes use supabaseAdmin (service role). Never throws.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { CreativeEventType } from "./types";

/**
 * logActivity — Insert an event into creative_activity_log.
 *
 * Fire-and-forget: catches and console.errors, never throws.
 * Safe to call without awaiting in route handlers.
 */
export async function logActivity(
  projectId: string,
  userId: string,
  eventType: CreativeEventType,
  payload?: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from("creative_activity_log")
      .insert({
        project_id: projectId,
        user_id: userId,
        event_type: eventType,
        event_payload: payload ?? {},
      });

    if (error) {
      console.error(
        `[activity-log] Failed to log event "${eventType}" for project ${projectId}:`,
        error.message
      );
    }
  } catch (err) {
    // Never throw — activity logging is non-critical
    console.error(
      `[activity-log] Unexpected error logging event "${eventType}":`,
      err
    );
  }
}
