#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-provider-branch.sh
#
# Run from the repo root:
#   bash scripts/setup-provider-branch.sh
#
# What it does:
#   1. Clears stale git lock files (safe to do — they're leftover from sandbox)
#   2. Creates branch feat/provider-integration-v1 from feat/backend-orchestration-v1
#   3. Commits all provider integration changes
#   4. Pushes to origin
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "▶ Clearing stale lock files..."
rm -f .git/index.lock .git/HEAD.lock

echo "▶ Checking out feat/backend-orchestration-v1..."
git checkout feat/backend-orchestration-v1

echo "▶ Switching to feat/provider-integration-v1 (creates if missing)..."
git checkout feat/provider-integration-v1 2>/dev/null || git checkout -b feat/provider-integration-v1

echo "▶ Staging provider integration files..."
git add \
  src/lib/ai/providers/dalle.ts \
  src/lib/ai/providers/mock.ts \
  src/lib/ai/orchestrator.ts \
  src/app/api/generate/route.ts \
  "src/app/api/generate/status/[provider]/[taskId]/route.ts"

echo "▶ Committing..."
git commit -m "$(cat <<'EOF'
feat(providers): wire real DALL-E 3 into image generation path

- Add src/lib/ai/providers/dalle.ts: real OpenAI DALL-E 3 provider
  implementing the AiProvider interface. Maps quality/aspectRatio to
  DALL-E params, returns revised_prompt in metadata for audit logging.

- Add src/lib/ai/providers/mock.ts: clean placeholder for video/audio
  modes (kling, elevenlabs) until real providers are wired up.

- Update orchestrator.ts: dispatch dalle provider for image mode,
  mock provider for video/audio. Safety-net ensures result.provider
  always matches resolveProvider() output.

- Update /api/generate/route.ts: store error_message on failure,
  completed_at + result_urls on success so status route has full data.

- Update status route: add DEMO_MODE=true bypass (matches balance +
  history routes from feat/backend-orchestration-v1).

Video and audio paths remain mocked. No architecture changes.
Required env var: OPENAI_API_KEY (already set on Vercel).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"

echo "▶ Pushing to origin..."
git push -u origin feat/provider-integration-v1

echo ""
echo "✅ Done. Vercel will start building the preview deployment."
echo "   Preview URL pattern: https://zencra-labs-git-feat-provider-i-*-zencralabs-5066s-projects.vercel.app"
