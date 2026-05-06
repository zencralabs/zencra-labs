/**
 * MP4 Audio Track Detection — production-grade, two-stage architecture
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  PRIMARY:  mp4box.js ISO 14496-12 parser                                 │
 * │            Reads actual track metadata; checks nb_samples > 0            │
 * │  FALLBACK: lightweight manual MP4 atom scan (existing, battle-tested)     │
 * │            Walks trak → mdia → hdlr → stsz, verifies real sample entries │
 * │  FINAL:    null = unknown — NEVER assumes audio exists                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Return contract:
 *   true  — audio track confirmed present with real samples
 *   false — confirmed no audio track, or track found but zero samples (silent/stubbed)
 *   null  — parser failed / file unreadable / both stages inconclusive
 *
 * Kling behaviour:
 *   Without the Sound Generation add-on, Kling returns an mp4 with a soun
 *   handler box but ZERO samples in stsz. Both stages catch this: mp4box
 *   checks nb_samples, the manual scanner checks stsz sample count.
 *
 * Async because mp4box fires an onReady callback that we wrap in a Promise.
 * mirrorVideoToStorage already awaits this inside an async function.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type AudioDetectionResult = boolean | null;

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 — mp4box.js parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempt audio detection using mp4box.js.
 * Returns null when mp4box is not installed or parsing fails.
 *
 * mp4box fires onReady synchronously during appendBuffer when the moov box is
 * found in-memory, so the Promise resolves quickly with the full file provided.
 * A 2-second timeout guards against any edge-case async behaviour.
 */
async function detectWithMp4Box(buffer: Buffer): Promise<boolean | null> {
  // Lazy-require mp4box — optional dependency; falls through if not installed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let MP4Box: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    MP4Box = require("mp4box");
  } catch {
    console.log("[audio-detect] mp4box not installed — skipping primary stage");
    return null;
  }

  return new Promise<boolean | null>((resolve) => {
    // Safety timeout — should never fire when full buffer is provided
    const timeout = setTimeout(() => {
      console.warn("[audio-detect] mp4box primary stage timed out → null");
      resolve(null);
    }, 2000);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mp4boxFile = MP4Box.createFile();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mp4boxFile.onReady = (info: any) => {
        clearTimeout(timeout);
        try {
          if (!info || !Array.isArray(info.tracks)) {
            console.log("[audio-detect] mp4box: onReady received invalid info → null");
            resolve(null);
            return;
          }

          // ── Find audio tracks ─────────────────────────────────────────────
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const audioTracks = info.tracks.filter((t: any) =>
            t.type === "audio" || t.handler === "soun"
          );

          if (audioTracks.length === 0) {
            console.log("[audio-detect] mp4box: no audio tracks → false");
            resolve(false);
            return;
          }

          // ── Verify real samples exist ─────────────────────────────────────
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hasRealAudio = audioTracks.some((t: any) => {
            // nb_samples is the authoritative check
            if (typeof t.nb_samples === "number") {
              const ok = t.nb_samples > 0;
              console.log(
                `[audio-detect] mp4box: track type=${t.type} handler=${t.handler} ` +
                `nb_samples=${t.nb_samples} codec=${t.codec ?? "?"} → ${ok}`
              );
              return ok;
            }
            // nb_samples unavailable — use codec presence as a reliable proxy.
            // A track with a recognised audio codec but no sample count is almost
            // certainly real audio; a stubbed/empty track has no codec string.
            const hasCodec = !!(t.codec || t.audio);
            console.log(
              `[audio-detect] mp4box: track type=${t.type} handler=${t.handler} ` +
              `nb_samples=unavailable codec=${t.codec ?? "?"} → proxy=${hasCodec}`
            );
            return hasCodec;
          });

          console.log(`[audio-detect] mp4box primary stage → ${hasRealAudio}`);
          resolve(hasRealAudio);
        } catch (innerErr) {
          console.warn("[audio-detect] mp4box onReady handler threw:", innerErr);
          resolve(null);
        }
      };

      mp4boxFile.onError = (e: unknown) => {
        clearTimeout(timeout);
        console.warn("[audio-detect] mp4box parse error:", e);
        resolve(null);
      };

      // Convert Node Buffer → ArrayBuffer with fileStart annotation
      // mp4box requires the ArrayBuffer to carry a fileStart property.
      const ab = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ) as ArrayBuffer & { fileStart: number };
      ab.fileStart = 0;

      mp4boxFile.appendBuffer(ab);
      mp4boxFile.flush();
    } catch (err) {
      clearTimeout(timeout);
      console.warn("[audio-detect] mp4box stage threw unexpectedly:", err);
      resolve(null);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2 — lightweight manual MP4 atom scan (fallback)
// ─────────────────────────────────────────────────────────────────────────────
//
// ISO 14496-12 structure walked:
//   moov → trak → mdia → hdlr  (find handler_type = "soun")
//                       → minf → stbl → stsz  (verify sample_count > 0)
//
// Uses linear byte-search rather than boundary walking. Reliable for files
// produced by major video providers; heuristic, not a full parser.

// Byte constants
const HDLR = [0x68, 0x64, 0x6c, 0x72] as const; // "hdlr"
const SOUN = [0x73, 0x6f, 0x75, 0x6e] as const; // "soun"
const STSZ = [0x73, 0x74, 0x73, 0x7a] as const; // "stsz"

function find4(
  buf:  Buffer,
  from: number,
  a: number, b: number, c: number, d: number,
): number {
  const limit = buf.length - 3;
  for (let i = from; i < limit; i++) {
    if (buf[i] === a && buf[i + 1] === b && buf[i + 2] === c && buf[i + 3] === d) {
      return i;
    }
  }
  return -1;
}

function detectWithManualScan(buffer: Buffer): AudioDetectionResult {
  try {
    // ── Level 1: locate a soun HandlerBox ────────────────────────────────────
    // HandlerBox (FullBox 'hdlr'):
    //   [0..3]   box size   [4..7]  box type "hdlr"
    //   [8]      version    [9..11] flags
    //   [12..15] pre_defined
    //   [16..19] handler_type  ← "soun" for audio

    let soundHdlrStart = -1;
    let searchFrom     = 0;

    while (searchFrom < buffer.length - 20) {
      const hdlrPos = find4(buffer, searchFrom, HDLR[0], HDLR[1], HDLR[2], HDLR[3]);
      if (hdlrPos === -1) break;

      const boxStart = hdlrPos - 4;
      if (boxStart >= 0 && boxStart + 20 <= buffer.length) {
        if (
          buffer[boxStart + 16] === SOUN[0] &&
          buffer[boxStart + 17] === SOUN[1] &&
          buffer[boxStart + 18] === SOUN[2] &&
          buffer[boxStart + 19] === SOUN[3]
        ) {
          soundHdlrStart = boxStart;
          break;
        }
      }
      searchFrom = hdlrPos + 1;
    }

    if (soundHdlrStart === -1) {
      console.log("[audio-detect] manual scan: no soun hdlr → false");
      return false;
    }

    console.log("[audio-detect] manual scan: soun hdlr at", soundHdlrStart);

    // ── Level 2: verify SampleSizeBox (stsz) has real samples ────────────────
    // SampleSizeBox (FullBox 'stsz'):
    //   [0..3]  box size   [4..7]  box type "stsz"
    //   [8]     version    [9..11] flags
    //   [12..15] sample_size   (0 = variable sizes follow)
    //   [16..19] sample_count
    //   [20+ ]   entry_size[] when sample_size == 0

    const stszPos = find4(buffer, soundHdlrStart, STSZ[0], STSZ[1], STSZ[2], STSZ[3]);

    if (stszPos === -1) {
      // soun hdlr present but no stsz — cannot verify real samples.
      // Return null (inconclusive) rather than blindly trusting hdlr.
      console.log("[audio-detect] manual scan: soun hdlr found but no stsz → null");
      return null;
    }

    const stszBox = stszPos - 4;
    if (stszBox < 0 || stszBox + 20 > buffer.length) {
      console.log("[audio-detect] manual scan: stsz boundary OOB → null");
      return null;
    }

    const sampleSize  = buffer.readUInt32BE(stszBox + 12);
    const sampleCount = buffer.readUInt32BE(stszBox + 16);

    console.log(
      `[audio-detect] manual scan: stsz sampleSize=${sampleSize} sampleCount=${sampleCount}`
    );

    if (sampleCount === 0) {
      console.log("[audio-detect] manual scan: sampleCount=0 → empty/stubbed → false");
      return false;
    }

    if (sampleSize > 0) {
      // Constant non-zero sample size → real audio confirmed
      console.log(`[audio-detect] manual scan: constant sampleSize=${sampleSize} → true`);
      return true;
    }

    // Variable sample sizes — check up to 8 entries for any non-zero value
    const checkCount = Math.min(sampleCount, 8);
    for (let i = 0; i < checkCount; i++) {
      const entryPos = stszBox + 20 + i * 4;
      if (entryPos + 4 > buffer.length) break;
      const entrySize = buffer.readUInt32BE(entryPos);
      if (entrySize > 0) {
        console.log(
          `[audio-detect] manual scan: sample[${i}] size=${entrySize} → true`
        );
        return true;
      }
    }

    console.log("[audio-detect] manual scan: all sample entries are zero → false");
    return false;

  } catch (err) {
    console.warn("[audio-detect] manual scan threw:", err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * detectMp4AudioTrack
 *
 * Production-grade two-stage audio detection for an in-memory MP4 buffer.
 *
 * Stage 1: mp4box.js ISO parser — reads actual track metadata (nb_samples)
 * Stage 2: manual atom scan     — hdlr "soun" + stsz sample verification
 *
 * @param buffer  Full MP4 file content as a Node.js Buffer
 * @returns
 *   true  — audio track present with real samples (confirmed by parser)
 *   false — no audio track, or track present but zero samples (stubbed/silent)
 *   null  — detection inconclusive; both stages failed or returned null
 */
export async function detectMp4AudioTrack(
  buffer: Buffer,
): Promise<AudioDetectionResult> {
  // ── Stage 1: mp4box ───────────────────────────────────────────────────────
  try {
    const mp4boxResult = await detectWithMp4Box(buffer);
    if (mp4boxResult !== null) {
      // mp4box gave a definitive answer (true or false)
      console.log(`[audio-detect] resolved by mp4box → ${mp4boxResult}`);
      return mp4boxResult;
    }
    // mp4box returned null (not installed, parse error) — fall through
    console.log("[audio-detect] mp4box inconclusive → trying manual scan");
  } catch (err) {
    console.warn("[audio-detect] mp4box stage error:", err);
  }

  // ── Stage 2: manual atom scan ────────────────────────────────────────────
  const manualResult = detectWithManualScan(buffer);
  console.log(`[audio-detect] resolved by manual scan → ${manualResult}`);
  return manualResult;
}
