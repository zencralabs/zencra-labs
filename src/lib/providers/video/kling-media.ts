/**
 * Kling Media Normalization Helpers
 *
 * Kling's image API fields require raw base64 strings — no data: prefix, no blob: URLs.
 * This module provides a single entry-point `normalizeKlingImageInput` that accepts any
 * image source that may arrive from the frontend and returns a raw base64 string,
 * or null when input is absent/empty (optional image fields should treat null as "skip").
 *
 * Supported inputs:
 *   - null / undefined / ""  → returns null (no throw — callers skip optional fields)
 *   - data URL               → strip the "data:...;base64," prefix, return raw base64
 *   - HTTPS URL              → fetch server-side, return base64 of the downloaded bytes
 *   - raw base64             → pass through unchanged
 *
 * Hard rejections (throws immediately, no retry):
 *   - blob: URLs             → browser-memory-only, cannot be resolved server-side
 *   - base64 < 1000 chars    → truncated/corrupt encoding
 *   - invalid base64 chars   → corrupted data that would fail Kling even if long enough
 */

// ─────────────────────────────────────────────────────────────────────────────
// LOW-LEVEL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip the "data:<mime>;base64," prefix from a data URL.
 * Returns the raw base64 payload.
 * If the value is NOT a data URL, returns it unchanged.
 */
export function stripDataUrlPrefix(value: string): string {
  // Use [\s\S]+ instead of .+ with the /s flag for broader TypeScript target compatibility.
  const match = value.match(/^data:[^;]+;base64,([\s\S]+)$/);
  return match ? match[1] : value;
}

/**
 * Heuristic check: does this string look like base64 image data?
 * We check that it only contains base64 characters and is long enough
 * to plausibly encode an image.  This is NOT cryptographic — it is used
 * only to distinguish "already base64" from "HTTPS URL" paths.
 */
export function isLikelyBase64(value: string): boolean {
  if (value.length < 100) return false;
  // base64 alphabet: A-Z, a-z, 0-9, +, /, with optional trailing =
  return /^[A-Za-z0-9+/]+=*$/.test(value.trim());
}

/**
 * Fetch an HTTPS URL server-side and return the content as a raw base64 string.
 * Throws if the fetch fails or returns a non-OK status.
 */
export async function fetchUrlAsBase64(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, { method: "GET" });
  } catch (err) {
    throw new Error(
      `Failed to fetch image from URL: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Image fetch returned HTTP ${response.status} for URL: ${url}`
    );
  }

  const buffer = await response.arrayBuffer();
  // Convert ArrayBuffer → base64 string (Node-compatible)
  return Buffer.from(buffer).toString("base64");
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN NORMALIZER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize any image input into a raw base64 string suitable for Kling's API.
 *
 * Returns null when input is absent or empty — callers should treat null as
 * "no image provided" and skip the corresponding API field.
 *
 * Call this for every image field before building the Kling job payload.
 *
 * @throws Error immediately for blob: URLs (browser-memory, unusable server-side)
 * @throws Error if the resulting base64 is shorter than 1000 chars (corrupt encoding)
 * @throws Error if the base64 contains invalid characters (corrupted data URL)
 */
export async function normalizeKlingImageInput(input: unknown): Promise<string | null> {
  // ── Empty / absent input → null (optional field, not an error) ─────────────
  if (input === null || input === undefined || input === "") {
    console.log("[kling-media] normalizeKlingImageInput: empty input → returning null");
    return null;
  }

  // ── Log entry point ────────────────────────────────────────────────────────
  console.log("[kling-media] Input type:", typeof input);

  if (typeof input !== "string") {
    throw new Error(`Image input must be a string, got: ${typeof input}`);
  }

  const value = input.trim();

  if (value === "") {
    console.log("[kling-media] normalizeKlingImageInput: whitespace-only input → returning null");
    return null;
  }

  console.log("[kling-media] Input prefix:", value.slice(0, 40));

  // ── Hard reject: blob: URLs ──────────────────────────────────────────────
  // These are browser-memory references that are completely unresolvable
  // on the server.  Throwing here prevents a confusing Kling HTTP 400.
  if (value.startsWith("blob:")) {
    throw new Error(
      "Invalid image source: blob: URLs cannot be processed server-side. " +
      "Please re-upload the image."
    );
  }

  let base64: string;

  if (value.startsWith("data:")) {
    // ── data URL ────────────────────────────────────────────────────────────
    console.log("[kling-media] Path: data URL → stripping prefix");
    base64 = stripDataUrlPrefix(value);
  } else if (value.startsWith("https://") || value.startsWith("http://")) {
    // ── HTTPS / HTTP URL ────────────────────────────────────────────────────
    console.log("[kling-media] Path: HTTPS URL → fetching server-side");
    base64 = await fetchUrlAsBase64(value);
  } else if (isLikelyBase64(value)) {
    // ── Raw base64 pass-through ─────────────────────────────────────────────
    console.log("[kling-media] Path: raw base64 pass-through");
    base64 = value;
  } else {
    throw new Error(
      "Unrecognized image format. Expected a data URL, an HTTPS URL, or raw base64."
    );
  }

  // ── Minimum length guard ─────────────────────────────────────────────────
  // A valid image encoded in base64 is always at least a few KB.
  // Anything shorter is a truncated encoding, empty, or garbage.
  if (base64.length < 1000) {
    throw new Error("Invalid image encoding (too small).");
  }

  // ── Character validity guard ─────────────────────────────────────────────
  // Some corrupted data URLs pass the length check but contain characters
  // outside the base64 alphabet (newlines, nulls, etc.) that cause Kling
  // to reject the payload even when the length looks plausible.
  // Allow optional trailing '=' padding — strip trailing padding before test.
  if (!/^[A-Za-z0-9+/]+=*$/.test(base64.trim())) {
    throw new Error(
      "Invalid base64 encoding format: unexpected characters detected."
    );
  }

  console.log("[kling-media] normalizeKlingImageInput: output length =", base64.length);
  return base64;
}
