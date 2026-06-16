---
name: distill-curate
description: Curate the skill library — rank by usage, flag stale/unused skills, and propose merges of near-duplicates, all with human confirmation. Use when the user says /distill-curate, "整理技能库", "清理没用的技能", or on the weekly curator schedule.
---

# Distill Curate (gate 3: autonomous maintenance, human-confirmed)

Keeps the library from rotting: ranks skills by real usage, flags stale ones,
and proposes merging near-duplicates. **Nothing is deleted or merged without
your confirmation.**

## Steps

1. **Run the curator:**
   ```sh
   node "${CLAUDE_PLUGIN_ROOT}/scripts/curator.mjs"
   ```
   It refreshes usage counts from `~/.claude/projects/*.jsonl`, then returns
   `{ ranking, stale, archive, mergePairs }`. (`stale` = unused ≥30d, `archive`
   = unused ≥90d, `mergePairs` = descriptions overlapping ≥0.6 Jaccard.)

2. **Show the report.** Present ranking (most/least used), the stale/archive
   lists, and any proposed merges.

3. **Confirm each action with AskUserQuestion.** Before any destructive change:
   - **Archive** a skill → back it up to `~/.claude/skill-distiller/backups/` first,
     then move it out of `~/.claude/skills/`.
   - **Merge** a pair → only after the user picks which to keep; back up the other.
   - **Keep** → mark active, do nothing.

4. **Report** what was archived/merged/kept. Never auto-delete — propose, confirm, then act.
