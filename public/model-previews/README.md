# /public/model-previews/

Canvas empty-state preview videos — UI demo only. No auth needed.

## Structure

```
model-previews/
  kling/
    vertical.mp4      9:16  ~5–8s loop, no audio
    landscape.mp4    16:9  ~5–8s loop, no audio
    square.mp4        1:1  ~5–8s loop, no audio
  seedance/
    vertical.mp4
    landscape.mp4
    square.mp4
  minimax/
    vertical.mp4
    landscape.mp4
    square.mp4
```

## Guidelines

- Keep clips short: 5–10 seconds, looping cleanly
- Strip audio (muted autoplay only)
- Compress: target < 3MB per file (H.264, CRF 28)
- Resolution: 720p is enough — these are small preview cards

## Adding a new model

1. Create `/public/model-previews/<modelKey>/` folder
2. Add `vertical.mp4`, `landscape.mp4`, `square.mp4`
3. Add the model key to `MODEL_PREVIEW_SETS` in `VideoEmptyStateMascot.tsx`
4. Remove `comingSoon: true` once videos are in place

## NOT for user-generated content

Real generated videos → Supabase Storage bucket `generated-assets/videos/{userId}/{genId}/output.mp4`
Never mix preview content with user output.
