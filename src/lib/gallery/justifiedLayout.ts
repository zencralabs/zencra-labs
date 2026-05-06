/**
 * justifiedLayout.ts
 *
 * Pure algorithm — no React, no DOM, no side effects.
 *
 * Produces a Higgsfield / Google Photos–style "justified row" layout:
 *   • Images flow left-to-right in DOM order (newest = top-left)
 *   • Each row fills the full container width with no gaps between images
 *   • Every image preserves its natural aspect ratio — 16:9 appears
 *     proportionally wider than 9:16 in the same row
 *   • The last (incomplete) row keeps targetRowHeight and does NOT stretch
 *
 * Usage:
 *   import { buildJustifiedRows } from "@/lib/gallery/justifiedLayout";
 *
 *   const rows = buildJustifiedRows(images, containerWidth, 260, 12);
 *   // rows[i].height         — computed pixel height for the row
 *   // rows[i].items[j].data  — original item object (full type preserved via generic)
 *   // rows[i].items[j].width — computed pixel width for this cell
 *   // rows[i].items[j].height — same as row.height (convenience copy)
 */

// ── Input contract ────────────────────────────────────────────────────────────

/**
 * Minimum shape an item must satisfy to enter the layout engine.
 *
 * `aspectRatio` — stored string, e.g. "16:9", "9:16", "1:1", "Auto".
 * `naturalWidth` / `naturalHeight` — optional measured pixel dimensions.
 *   When both are provided and > 0 they take priority over the stored
 *   string, which matters most for "Auto" images where we don't know the
 *   true ratio until the browser loads the image.
 */
export interface JustifiedInput {
  id: string;
  src: string | null;
  aspectRatio: string;
  naturalWidth?: number;
  naturalHeight?: number;
}

// ── Output contract ───────────────────────────────────────────────────────────

export interface JustifiedLayoutItem<T extends JustifiedInput = JustifiedInput> {
  /** Original item object — full type is preserved via the generic. */
  data: T;
  /** Computed pixel width for this cell. */
  width: number;
  /** Computed pixel height — always equals the parent row's height. */
  height: number;
}

export interface JustifiedRow<T extends JustifiedInput = JustifiedInput> {
  /** Pixel height for every image in this row. */
  height: number;
  /** Ordered list of items (left-to-right, matching DOM order). */
  items: JustifiedLayoutItem<T>[];
}

// ── Aspect-ratio parser ───────────────────────────────────────────────────────

/**
 * Resolve the aspect ratio (width ÷ height) for a single item.
 *
 * Priority order:
 *   1. naturalWidth / naturalHeight — real measured pixel dimensions.
 *      These are populated via an onLoad handler and are always accurate,
 *      even for "Auto" images where the stored string gives no information.
 *   2. Stored "W:H" string — parsed arithmetically.
 *   3. Fallback 1.0 — renders as a square; safe for first layout pass
 *      before image dimensions are known.
 */
function parseAspectRatio(
  aspectRatio: string,
  naturalWidth?: number,
  naturalHeight?: number,
): number {
  // 1. Natural dimensions (post-load metadata)
  if (
    naturalWidth != null &&
    naturalHeight != null &&
    naturalWidth > 0 &&
    naturalHeight > 0
  ) {
    return naturalWidth / naturalHeight;
  }

  // 2. Stored string "W:H"
  if (aspectRatio && aspectRatio !== "Auto") {
    const parts = aspectRatio.split(":");
    if (parts.length === 2) {
      const w = Number(parts[0]);
      const h = Number(parts[1]);
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        return w / h;
      }
    }
  }

  // 3. Cinematic fallback — 16:9 is the dominant Zencra output format.
  //    Using 1:1 here caused all "Auto" images to render as squares,
  //    producing wrong row widths and black spaces in the justified layout.
  return 16 / 9;
}

// ── Core algorithm ────────────────────────────────────────────────────────────

/**
 * Build justified rows from an ordered list of items.
 *
 * @param items          - Items in display order (index 0 = newest = top-left).
 * @param containerWidth - Available pixel width (content box, excluding padding).
 * @param targetRowHeight - Ideal row height in pixels (default 260).
 *   Higher values → taller rows → fewer items per row → larger images.
 *   Drive this from a zoom slider to give users control over image size.
 * @param gap            - Pixel gap between images within a row (default 12).
 *   Vertical gap between rows should match this value in the flex container.
 *
 * @returns Array of rows, each with a computed height and sized items.
 *   The last row keeps `targetRowHeight` and is left-aligned (not stretched).
 */
export function buildJustifiedRows<T extends JustifiedInput>(
  items: T[],
  containerWidth: number,
  targetRowHeight = 260,
  gap = 12,
): JustifiedRow<T>[] {
  // Guard: can't layout into zero or negative space
  if (containerWidth <= 0 || items.length === 0) return [];

  const rows: JustifiedRow<T>[] = [];

  // Accumulators for the row being built
  let rowBuffer: T[] = [];
  let totalAspectRatio = 0;

  const flushFullRow = () => {
    // Total gap pixels consumed by spaces between items
    const gapTotal = (rowBuffer.length - 1) * gap;
    // Available image width after subtracting gaps
    const imageWidth = containerWidth - gapTotal;
    // Row height that makes all images exactly fill containerWidth
    const rowHeight = imageWidth / totalAspectRatio;

    const rowItems: JustifiedLayoutItem<T>[] = rowBuffer.map((item) => {
      const ar = parseAspectRatio(
        item.aspectRatio,
        item.naturalWidth,
        item.naturalHeight,
      );
      return {
        data: item,
        width: rowHeight * ar,
        height: rowHeight,
      };
    });

    rows.push({ height: rowHeight, items: rowItems });
    rowBuffer = [];
    totalAspectRatio = 0;
  };

  for (const item of items) {
    const ar = parseAspectRatio(
      item.aspectRatio,
      item.naturalWidth,
      item.naturalHeight,
    );

    rowBuffer.push(item);
    totalAspectRatio += ar;

    // Gap pixels consumed after adding this item
    const gapTotal = (rowBuffer.length - 1) * gap;
    const imageWidth = containerWidth - gapTotal;

    // The row is "full" when the images at targetRowHeight would exceed
    // the available width — at that point we lock the row and compute
    // the exact height that makes them fit perfectly.
    if (totalAspectRatio * targetRowHeight >= imageWidth) {
      flushFullRow();
    }
  }

  // ── Last (incomplete) row ─────────────────────────────────────────────────
  // Keep targetRowHeight — do NOT stretch images to fill the row.
  // This matches the Google Photos / Higgsfield convention: the last row
  // shows images at their natural size, left-aligned.
  if (rowBuffer.length > 0) {
    const rowItems: JustifiedLayoutItem<T>[] = rowBuffer.map((item) => {
      const ar = parseAspectRatio(
        item.aspectRatio,
        item.naturalWidth,
        item.naturalHeight,
      );
      return {
        data: item,
        width: targetRowHeight * ar,
        height: targetRowHeight,
      };
    });
    rows.push({ height: targetRowHeight, items: rowItems });
  }

  return rows;
}
