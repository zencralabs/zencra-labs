import type { GenerationMode, ProviderName } from "./types";

const DEFAULT_PROVIDER_BY_MODE: Record<GenerationMode, ProviderName> = {
  image: "dalle",
  video: "kling",
  audio: "elevenlabs",
};

const ALLOWED_PROVIDERS_BY_MODE: Record<GenerationMode, ProviderName[]> = {
  image: ["dalle", "nano-banana", "ideogram"],
  video: ["kling", "seedance", "heygen"],
  audio: ["elevenlabs"],
};

export function getDefaultProvider(mode: GenerationMode): ProviderName {
  return DEFAULT_PROVIDER_BY_MODE[mode];
}

export function isProviderAllowedForMode(
  mode: GenerationMode,
  provider: ProviderName
): boolean {
  return ALLOWED_PROVIDERS_BY_MODE[mode].includes(provider);
}

export function resolveProvider(
  mode: GenerationMode,
  requestedProvider?: ProviderName
): ProviderName {
  if (!requestedProvider) {
    return getDefaultProvider(mode);
  }

  if (!isProviderAllowedForMode(mode, requestedProvider)) {
    throw new Error(
      `Provider "${requestedProvider}" is not allowed for mode "${mode}".`
    );
  }

  return requestedProvider;
}
