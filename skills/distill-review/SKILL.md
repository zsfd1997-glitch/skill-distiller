---
name: distill-review
description: Review distilled draft skills and approve, edit, or reject them before they enter your skill library. Use when the user says /distill-review, "审技能草稿", "看看沉淀了啥", or wants to decide which harvested skills to keep.
---

# Distill Review (gate 2: human opt-in)

Drafts produced by `/distill-scan` sit in `~/.claude/skills/.suggested/` and do
**nothing** until you approve them here. This is the human opt-in gate.

## Steps

1. **List drafts.** Read every `~/.claude/skills/.suggested/*/SKILL.md`. For each,
   show the user its `name`, `description`, the reviewer `score`, and the candidate
   `sample` (the action sequence it came from).

2. **Decide, one at a time.** For each draft, use **AskUserQuestion** with options:
   - **Approve** — move `.suggested/<name>/` → `~/.claude/skills/<name>/`, then
     record it in the ledger: `upsertLedger({ name, description, source: 'distilled', createdTs: Date.now(), uses: 0, status: 'active' })` (see `scripts/state.mjs`).
   - **Edit then approve** — apply the user's changes to the draft, then move it.
   - **Reject** — delete `.suggested/<name>/` and `setCandidateStatus(sig, 'rejected')`.
   - **Later** — leave it staged.

3. **Report.** Summarize: approved / edited / rejected / deferred counts, and the
   names now live in the library.

Never bulk-approve. One decision per draft keeps the library curated.
