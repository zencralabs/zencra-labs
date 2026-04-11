/**
 * ElevenLabs TTS Provider
 * Converts text to speech and stores the MP3 in Supabase Storage.
 * Env: ELEVENLABS_API_KEY
 */
import { createClient } from "@supabase/supabase-js";
import type { AiProvider, ProviderGenerateInput, ProviderGenerateResult } from "../types";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

async function ensureBucketExists(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { error } = await supabase.storage.createBucket("audio", { public: true, fileSizeLimit: 50_000_000 });
  if (error && !error.message.includes("already exists")) {
    console.warn("[elevenlabs] bucket create warning:", error.message);
  }
}

export const elevenLabsProvider: AiProvider = {
  name:           "elevenlabs",
  supportedModes: ["audio"],

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured.");

    const voiceId = input.voiceId ?? "EXAVITQu4vr4xnSDxMaL"; // Sarah (default)
    const model   = input.quality === "studio" ? "eleven_multilingual_v2" : "eleven_turbo_v2";

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method:  "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body:    JSON.stringify({
        text:           input.normalizedPrompt.transformed,
        model_id:       model,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: false },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 401) throw new Error("Authentication error. Please contact support.");
      if (res.status === 429) throw new Error("Too many requests — please wait a moment.");
      throw new Error("Audio generation failed. Please try again.");
    }

    const audioBuffer = await res.arrayBuffer();
    const supabase    = getSupabaseAdmin();
    await ensureBucketExists(supabase);

    const path = `${Date.now()}-${voiceId}-${Math.random().toString(36).slice(2)}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from("audio")
      .upload(path, audioBuffer, { contentType: "audio/mpeg", upsert: false });

    if (uploadError) throw new Error("Failed to store audio. Please try again.");

    const { data } = supabase.storage.from("audio").getPublicUrl(path);

    return {
      provider: "elevenlabs",
      mode:     "audio",
      status:   "success",
      url:      data.publicUrl,
      mimeType: "audio/mpeg",
      metadata: { voiceId, model },
    };
  },
};
