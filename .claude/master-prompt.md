# Zencra Labs — Master Session Prompt
# Paste this at the start of any new Claude/ChatGPT build session.

---

You are working on Zencra Labs — a cinematic AI tool platform.

Before writing any code, you MUST:

1. Read `CLAUDE.md` at the project root — it contains all architecture rules, contracts, and locks
2. Follow ALL rules in CLAUDE.md strictly — especially:
   - Orchestrator isolation (providers never route each other)
   - Storage/DB contract (mirror all outputs to Supabase, never trust provider URLs)
   - Credit safety (deduct only on success, no silent loss)
   - Typography system (9 locked categories — do not invent sizes)
   - UX principles (no rounded corners on media, no alert(), no small text)
3. Do NOT assume anything outside CLAUDE.md
4. Do NOT rebuild existing systems (billing, auth, providers, gallery, dock)
5. TypeScript must be zero errors before every commit (`npx tsc --noEmit`)

Now confirm you have read CLAUDE.md, then answer:
1. What did you understand about the current build state?
2. Which files will you change?
3. What assumptions are you making?
4. What will you NOT touch?

Wait for approval before writing any code.

---

# Task-Spec Template (copy + fill per feature)

```
Task: [Feature name]

Branch: feat/[branch-name]
Base checkpoint: v1-video-studio-stable

Constraints:
- [specific constraint 1]
- [specific constraint 2]

CLAUDE.md rules apply — especially:
- [most relevant rule for this task]

Do NOT build yet.

First:
1. Break into components
2. Define interaction model
3. Define state changes
4. List files you will change and files you will NOT touch

Wait for approval.
```

---

# CD v2 Task-Spec (ready to use)

```
Task: Creative Director v2 — Phase A (Direction Layer backend)

Branch: feat/creative-director-v2
Base checkpoint: v1-video-studio-stable

The goal of CD v2 is to replace the form-based brief flow with a direction system.
Users orient a direction, focus it, lock it, then generate from it.
A "direction" is a concept the director has committed to — not just selected.

Phase A scope (backend only — no UI changes):
1. Create migration: direction_refinements table
   (concept_id, tone_intensity, color_palette, pacing, locked_at)
2. POST /api/creative-director/directions — lock a concept as a direction
3. PATCH /api/creative-director/directions/[id] — update refinements
4. Update creative_generations to accept direction_id alongside concept_id

CLAUDE.md rules apply — especially:
- No silent failures (all errors surface to user)
- Storage/DB contract (direction_id must persist through full generation lifecycle)
- TypeScript zero errors before commit

Do NOT touch: BriefBuilder, ConceptBoard, OutputWorkspace, CreativeRenderDock, CharacterPanel, any generation route logic.

Do NOT build Phase B or C yet.

First answer:
1. What tables already exist that this touches?
2. What is the exact migration SQL?
3. What files will you change?
4. What will you NOT touch?

Wait for approval.
```
