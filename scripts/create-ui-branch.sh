#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# create-ui-branch.sh
#
# Run from the repo root:
#   bash scripts/create-ui-branch.sh
#
# What it does:
#   1. Clears stale git lock files
#   2. Merges feat/provider-integration-v1 → main
#   3. Pushes main to origin
#   4. Creates feat/ui-backend-connection-v1 from main
#   5. Applies the patched studio/image/page.tsx (wires /api/generate)
#   6. Commits and pushes
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "▶ Clearing stale lock files..."
rm -f .git/index.lock .git/HEAD.lock

# ── Step 1: Merge provider-integration into main ──────────────────────────────
echo "▶ Checking out main..."
git checkout main

echo "▶ Merging feat/provider-integration-v1 into main..."
git merge feat/provider-integration-v1 --no-edit -m "$(cat <<'EOF'
feat: merge provider integration into main

Merges feat/provider-integration-v1:
- Real DALL-E 3 image generation via /api/generate
- DEMO_MODE preview bypass on all API routes
- Mock provider for video/audio (Kling, ElevenLabs placeholders)
- Atomic credit deduction via spend_credits RPC
- Full generation status tracking in Supabase

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"

echo "▶ Pushing main to origin..."
git push origin main

# ── Step 2: Create UI branch ──────────────────────────────────────────────────
echo ""
echo "▶ Creating feat/ui-backend-connection-v1 from main..."
git checkout feat/ui-backend-connection-v1 2>/dev/null || git checkout -b feat/ui-backend-connection-v1

# ── Step 3: Apply patched studio page ────────────────────────────────────────
echo "▶ Applying patched studio/image/page.tsx..."
cp scripts/patches/studio-image-page.tsx src/app/studio/image/page.tsx

# ── Step 4: Commit ────────────────────────────────────────────────────────────
echo "▶ Staging and committing..."
git add src/app/studio/image/page.tsx scripts/patches/studio-image-page.tsx scripts/create-ui-branch.sh

git commit -m "$(cat <<'EOF'
feat(studio): wire image studio to live /api/generate backend

Connect src/app/studio/image/page.tsx to the real backend:

- Replace /api/generate/image with /api/generate (new unified endpoint)
- Add mapArToApiAr(): maps UI aspect ratios to API's 1:1 / 16:9 / 9:16 / 4:5
- Map quality: "1K" → "cinematic" (2 credits), "2K" → "studio" (4 credits)
- Handle HTTP 402 with a clear "Not enough credits — need X, you have Y" message
- Parse response from data.data.url (new API shape)
- Add ⚡ credits pill in top bar — shows live balance
- Call refreshUser() after each generation batch to update the pill

No design changes. Video/audio paths remain mocked and show SOON badges.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"

# ── Step 5: Push ──────────────────────────────────────────────────────────────
echo "▶ Pushing to origin..."
git push -u origin feat/ui-backend-connection-v1

echo ""
echo "✅ Done!"
echo ""
echo "   main is now up to date with all backend work."
echo "   feat/ui-backend-connection-v1 has the wired Studio UI."
echo ""
echo "   Vercel preview URL pattern:"
echo "   https://zencra-labs-git-feat-ui-backend-co-*-zencralabs-5066s-projects.vercel.app"
echo ""
echo "   Test the Studio at: <preview-url>/studio/image"
echo "   Log in or wait for DEMO_MODE to bypass auth."
