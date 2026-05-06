/**
 * downloadAsset — universal client-side download helper
 *
 * Cross-origin URLs (e.g. Supabase CDN) cannot be downloaded via a raw
 * `<a href download>` anchor because the browser ignores the download attribute
 * and navigates instead.  This helper fetches the asset as a Blob first, creates
 * a temporary object URL, and triggers a real file-save dialog.
 *
 * Fallback: if the blob fetch fails for any reason (CORS error, network timeout,
 * non-OK HTTP status), the file is opened in a NEW TAB — never the same tab, so
 * the user is never navigated away from the Studio page.
 *
 * Usage:
 *   import { downloadAsset } from "@/lib/client/downloadAsset";
 *   await downloadAsset("https://cdn.supabase.co/...mp4", "my-video.mp4");
 */

/**
 * Download a remote asset as a file.
 *
 * @param url      - The URL of the asset to download (any origin).
 * @param filename - The suggested filename for the saved file (e.g. "clip.mp4").
 */
export async function downloadAsset(url: string, filename: string): Promise<void> {
  if (!url) return;

  let objectUrl: string | null = null;

  try {
    // Fetch the resource client-side — this resolves CORS for Supabase public buckets
    // because they include Access-Control-Allow-Origin: * on public assets.
    const response = await fetch(url, { method: "GET" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching asset`);
    }

    const blob = await response.blob();
    objectUrl = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } catch (err) {
    // Blob fetch failed — open in a new tab only, never replace the current page.
    console.warn("[downloadAsset] Blob fetch failed, opening in new tab:", err);
    window.open(url, "_blank", "noopener,noreferrer");
  } finally {
    // Always revoke the object URL to avoid memory leaks.
    if (objectUrl) {
      // Small delay so the browser has time to start the download before revocation.
      setTimeout(() => URL.revokeObjectURL(objectUrl!), 5_000);
    }
  }
}
