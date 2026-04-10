#!/bin/bash
# Zencra Labs — push feat/backend-orchestration-v1 and trigger Vercel preview
# Run from the repo root: bash scripts/push-preview.sh

set -e
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Zencra Labs — Push + Preview Deploy"
echo "  Branch: $(git branch --show-current)"
echo "═══════════════════════════════════════════════════"

# Remove stale lock if it exists
if [ -f .git/index.lock ]; then
  echo "  ⚠️  Removing stale .git/index.lock..."
  rm -f .git/index.lock
fi

# Stage all the backend-orchestration work
echo ""
echo "  📦 Staging files..."
git add \
  src/app/api/credits/balance/route.ts \
  src/app/api/credits/history/route.ts \
  src/app/api/generate/image/route.ts \
  src/app/api/generate/route.ts \
  "src/app/api/generate/status/[provider]/[taskId]/route.ts" \
  src/app/api/credits/estimate/ \
  src/lib/ai/types.ts \
  src/lib/ai/tool-registry.ts \
  src/lib/auth.ts \
  src/lib/supabase.ts \
  src/lib/credits/ \
  src/lib/supabase/ \
  supabase/migrations/ \
  scripts/ \
  next.config.mjs

echo ""
echo "  📋 Staged files:"
git status --short

echo ""
echo "  ✍️  Committing..."
git commit -m "$(cat <<'MSG'
feat(backend): atomic credit system + full Supabase integration

- Add tool registry (mode + provider → canonical tool name)
- Add shared credit calculator (calculateCredits utility)
- Rewrite /api/generate: auth, tool resolution, atomic spend_credits RPC
- Add /api/credits/estimate endpoint
- Rewrite /api/generate/status/[provider]/[taskId]: live DB query
- Rewrite /api/credits/balance + history: real JWT auth, correct tables
- Add /api/generate/image: requireAuthUser, resolveTool("image","dalle")
- Add spend_credits + refund_credits Postgres RPCs (FOR UPDATE row lock)
- Add verify-supabase.mjs v2: read-only + DEMO_MODE mutation tests
- Supabase schema confirmed: profiles.credits, credit_transactions ledger

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
MSG
)"

echo ""
echo "  🚀 Pushing to origin/feat/backend-orchestration-v1..."
git push -u origin feat/backend-orchestration-v1

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ Pushed! Vercel preview will build automatically."
echo "  Check: https://vercel.com/dashboard"
echo "═══════════════════════════════════════════════════"
echo ""
