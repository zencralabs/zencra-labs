/**
 * Kits AI Voice Conversion Provider
 * audio-in → audio-out (voice conversion, NOT TTS).
 * Requires `input.audioUrl` — a public URL to the source audio.
 * Env: KITS_AI_API_KEY
 */
import { createClient } from "@supabase/supabase-js";
import type { AiProvider, ProviderGenerateInput, ProviderGenerateResult } from "../types";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export const kitsProvider: AiProvider = {
  name:           "kits",
  supportedModes: ["audio"],

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const apiKey = process.env.KITS_AI_API_KEY;
    if (!apiKey) throw new Error("KITS_AI_API_KEY is not configured.");

    const audioUrl = input.audioUrl ?? (input.metadata?.audioUrl as string | undefined);
    if (!audioUrl) {
      throw new Error(
        "Kits AI voice conversion requires a source audio file. " +
        "Please upload an audio clip first."
      );
    }

    // Fetch source audio then post as multipart
    const srcRes  = await fetch(audioUrl, { signal: AbortSignal.timeout(30_000) });
    if (!srcRes.ok) throw new Error("Could not fetch source audio. Please try a different file.");
    const srcBuf  = await srcRes.arrayBuffer();
    const srcBlob = new Blob([srcBuf], { type: "audio/mpeg" });

    const voiceModelId = input.voiceId ?? "voice_male_1";
    const form = new FormData();
    form.append("audio",          srcBlob, "source.mp3");
    form.append("voice_model_id", voiceModelId);

    const res = await fetch("https://api.kits.ai/api/convert", {
      method:  "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body:    form,
      signal:  AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error("Authentication error. Please contact support.");
      if (res.status === 429) throw new Error("Too many requests — please wait a moment.");
      throw new Error("Voice conversion failed. Please try again.");
    }

    const audioBuffer = await res.arrayBuffer();
    const supabase    = getSupabaseAdmin();

    const path = `${Date.now()}-kits-${voiceModelId}-${Math.random().toString(36).slice(2)}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from("audio")
      .upload(path, audioBuffer, { contentType: "audio/mpeg", upsert: false });

    if (uploadError) throw new Error("Failed to store converted audio. Please try again.");

    const { data } = supabase.storage.from("audio").getPublicUrl(path);

    return {
      provider: "kits",
      mode:     "audio",
      status:   "success",
      url:      data.publicUrl,
      mimeType: "audio/mpeg",
      metadata: { voiceModelId },
    };
  },
};
