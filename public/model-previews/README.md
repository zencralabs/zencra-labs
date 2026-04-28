# 🎬 Zencra — Model Preview System

This directory powers the **Video Canvas Preview Cards** in Zencra Studio.
These are cinematic showcase videos, not user-generated content.
They define the first impression of each model.

---

## 🧭 Purpose

The preview system is used in:

- Canvas empty state (3-card cinematic stack)
- Model hover switching (Kling → Seedance → Hailuo…)
- Visual trust layer for users

These videos should feel like **high-end film stills in motion**, not demos.

---

## 📁 Folder Structure

```
/model-previews/
  kling/
    landscape.mp4   # 16:9 (center card)
    vertical.mp4    # 9:16 (left card)
    square.mp4      # 1:1 (right card)
  seedance/
    landscape.mp4
    vertical.mp4
    square.mp4
  minimax/
    landscape.mp4
    vertical.mp4
    square.mp4
```

---

## 🎯 Card Mapping (CRITICAL)

| Card Position  | Aspect Ratio | File            |
|----------------|--------------|-----------------|
| Center (main)  | 16:9         | `landscape.mp4` |
| Left (behind)  | 9:16         | `vertical.mp4`  |
| Right (behind) | 1:1          | `square.mp4`    |

All three:

- Must feel like the **same visual scene**
- Same lighting, subject, tone
- Only framing changes

---

## ⚠️ Activation Rule

Each folder contains `.placeholder` files.

To activate previews:

1. Delete `.placeholder`
2. Add real `.mp4` files with correct names
3. **No code changes required.**

---

## 🎞️ Video Guidelines (IMPORTANT)

These are not random clips. Follow this:

**Duration**
- 5–8 seconds ideal
- Must loop cleanly

**Style**
- Cinematic
- High contrast lighting
- Strong subject
- No UI overlays
- No text

**Motion**
- Slow camera movement OR subtle subject motion
- No fast cuts
- No shaky footage

**Audio**
- Must be removed

---

## ⚙️ Compression (Required)

```bash
ffmpeg -i input.mp4 -vcodec libx264 -crf 28 -an -vf scale=-2:720 output.mp4
```

Why:
- `-an` → removes audio
- `-crf 28` → keeps file small (~2–3MB)
- `scale=-2:720` → caps resolution

---

## 🚫 Do NOT

- ❌ Add audio
- ❌ Use long clips (>10s)
- ❌ Mix different scenes per aspect ratio
- ❌ Use low-quality or noisy footage
- ❌ Change filenames
- ❌ Add random test videos

---

## 🧠 Coming Soon Models

If a model is marked `comingSoon: true` in `VideoEmptyStateMascot.tsx`:

- Canvas will show placeholder state
- Do **NOT** add videos yet unless model is enabled

---

## 🔄 Future Upgrade (Optional)

Later this system may move to:

- Supabase CDN
- Dynamic preview loading
- Model-based preview switching

For now: **keep previews local** for speed + simplicity.

---

## 🔒 Separation of Concerns

| Type                   | Storage                                              | Purpose          |
|------------------------|------------------------------------------------------|------------------|
| Canvas preview videos  | `/public/model-previews/`                            | UI demo only     |
| Generated user videos  | Supabase Storage `generated-assets/videos/{uid}/{genId}/` | Real content |

Never mix preview content with user output.

---

## 🎬 Final Standard

Before committing any preview, ask:

> **Would this feel at home in a Netflix trailer frame?**

If not — replace it.
