/**
 * MP4 Audio Track Detection
 *
 * Pure-buffer, zero-dependency scanner that determines whether an MP4 file
 * contains a real audio track with actual audio samples.
 *
 * Detection is two-level:
 *
 *   Level 1 — Track existence
 *     Scan for an `hdlr` FullBox whose `handler_type` field (boxStart + 16) is
 *     the 4-byte ASCII sequence `soun`. This identifies a sound media track in
 *     the ISO Base Media file format (ISO 14496-12).
 *
 *   Level 2 — Sample verification
 *     From the position of the `soun` hdlr, scan forward for the first `stsz`
 *     (Sample Size Box). Check:
 *       a. `sample_count > 0`  (at boxStart + 16)
 *       b. At least one non-zero entry in the sample size table
 *     This guards against stubbed tracks where a provider writes a soun hdlr
 *     but delivers no actual audio data (Kling's silent audio-pack behaviour).
 *
 * Return values
 *   true  — audio track confirmed present with samples
 *   false — no audio track, or track found but all samples are empty
 *   null  — buffer read error or unexpected structure; treat as unknown
 *
 * ⚠️  This is a heuristic, not a full ISO 14496-12 parser. It uses linear
 *     byte-pattern search rather than box-boundary walking. False positives
 *     are theoretically possible if these 4-byte sequences appear as payload
 *     inside a non-box region, but in practice MP4 files produced by major
 *     video providers are structured such that this approach is reliable.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Byte constants
// ─────────────────────────────────────────────────────────────────────────────

// box type: "hdlr"
const HDLR = [0x68, 0x64, 0x6c, 0x72] as const;
// handler_type: "soun"
const SOUN = [0x73, 0x6f, 0x75, 0x6e] as const;
// box type: "stsz"
const STSZ = [0x73, 0x74, 0x73, 0x7a] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the first occurrence of a 4-byte sequence in `buf` starting at `from`.
 * Returns the index of the first byte match, or -1 if not found.
 */
function find4(
  buf:  Buffer,
  from: number,
  a: number,
  b: number,
  c: number,
  d: number,
): number {
  const limit = buf.length - 3;
  for (let i = from; i < limit; i++) {
    if (buf[i] === a && buf[i + 1] === b && buf[i + 2] === c && buf[i + 3] === d) {
      return i;
    }
  }
  return -1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export type AudioDetectionResult = boolean | null;

/**
 * detectMp4AudioTrack
 *
 * Scan an in-memory MP4 buffer for a sound audio track with real samples.
 *
 * @param buffer  Full MP4 file content as a Node.js Buffer
 * @returns
 *   true  — audio track present and non-empty
 *   false — no audio track, or track is empty (silent/stubbed)
 *   null  — detection inconclusive (buffer error or malformed structure)
 */
export function detectMp4AudioTrack(buffer: Buffer): AudioDetectionResult {
  try {
    // ── Level 1: locate a sound media handler (soun hdlr) ────────────────────
    //
    // ISO 14496-12 §8.4.3 HandlerBox:
    //   aligned(8) class HandlerBox extends FullBox('hdlr', version=0, 0) {
    //     unsigned int(32) pre_defined = 0;
    //     unsigned int(32) handler_type;          ← boxStart + 16
    //     const unsigned int(32)[3] reserved = 0;
    //     string name;
    //   }
    //
    // FullBox layout:
    //   [0..3]   box size (4 bytes, big-endian)
    //   [4..7]   box type "hdlr" (4 bytes)
    //   [8]      version (1 byte)
    //   [9..11]  flags (3 bytes)
    //   [12..15] pre_defined (4 bytes)
    //   [16..19] handler_type ← "soun" for audio

    let soundHdlrStart = -1;
    let searchFrom     = 0;

    while (searchFrom < buffer.length - 20) {
      const hdlrTypePos = find4(buffer, searchFrom, HDLR[0], HDLR[1], HDLR[2], HDLR[3]);
      if (hdlrTypePos === -1) break; // no more hdlr boxes

      // The 4-byte box type sits at boxStart+4, so boxStart = hdlrTypePos - 4
      const boxStart = hdlrTypePos - 4;
      if (boxStart < 0) {
        searchFrom = hdlrTypePos + 1;
        continue;
      }

      // Read handler_type at boxStart+16
      if (boxStart + 20 <= buffer.length) {
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

      searchFrom = hdlrTypePos + 1;
    }

    if (soundHdlrStart === -1) {
      // No soun handler found → no audio track
      console.log("[audio-detect] Level 1: no soun hdlr found → false");
      return false;
    }

    console.log("[audio-detect] Level 1: soun hdlr found at buffer offset", soundHdlrStart);

    // ── Level 2: verify stsz (Sample Size Box) has real samples ──────────────
    //
    // ISO 14496-12 §8.7.3 SampleSizeBox:
    //   aligned(8) class SampleSizeBox extends FullBox('stsz', version=0, 0) {
    //     unsigned int(32) sample_size;    ← boxStart + 12
    //     unsigned int(32) sample_count;  ← boxStart + 16
    //     if (sample_size == 0) {
    //       for (i=1; i<=sample_count; i++) {
    //         unsigned int(32) entry_size; ← boxStart + 20 + (i-1)*4
    //       }
    //     }
    //   }

    const stszTypePos = find4(buffer, soundHdlrStart, STSZ[0], STSZ[1], STSZ[2], STSZ[3]);

    if (stszTypePos === -1) {
      // stsz not found — cannot confirm audio samples exist.
      // Kling silent video: soun hdlr is present but no stsz means we cannot
      // verify real audio data. Fail safe to false rather than trusting Level 1.
      console.log("[audio-detect] Level 2: no stsz found after soun hdlr → false (cannot confirm samples)");
      return false;
    }

    const stszBox = stszTypePos - 4; // box starts 4 bytes before the type tag

    if (stszBox < 0 || stszBox + 20 > buffer.length) {
      console.log("[audio-detect] Level 2: stsz box boundary out of range → false (cannot confirm samples)");
      return false;
    }

    const sampleSize  = buffer.readUInt32BE(stszBox + 12);
    const sampleCount = buffer.readUInt32BE(stszBox + 16);

    console.log("[audio-detect] Level 2: stsz sampleSize=%d sampleCount=%d", sampleSize, sampleCount);

    if (sampleCount === 0) {
      // Explicit empty track
      console.log("[audio-detect] Level 2: sampleCount=0 → empty track → false");
      return false;
    }

    if (sampleSize > 0) {
      // Constant non-zero sample size → real audio data present
      console.log("[audio-detect] Level 2: constant sampleSize=%d → audio present → true", sampleSize);
      return true;
    }

    // Variable sample sizes: check first 8 entries for any non-zero value
    const checkCount = Math.min(sampleCount, 8);
    for (let i = 0; i < checkCount; i++) {
      const entryPos = stszBox + 20 + i * 4;
      if (entryPos + 4 > buffer.length) break;
      const entrySize = buffer.readUInt32BE(entryPos);
      if (entrySize > 0) {
        console.log("[audio-detect] Level 2: sample[%d] size=%d → audio present → true", i, entrySize);
        return true;
      }
    }

    // All checked samples are zero → stubbed/silent track
    console.log("[audio-detect] Level 2: all sample entries are zero → silent/stubbed → false");
    return false;

  } catch (err) {
    // Unexpected error parsing the buffer — return null (unknown)
    console.warn("[audio-detect] detection threw unexpectedly:", err);
    return null;
  }
}
