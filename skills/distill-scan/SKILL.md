---
name: distill-scan
description: Scan Claude Code session history for repeated action patterns and draft candidate skills. Use when the user says /distill-scan, "沉淀技能", "扫历史找重复", "harvest skills from my sessions", or wants to turn recurring workflows into reusable skills.
---

# Distill Scan (gate 0: harvest + gate 1: review)

Find action sequences you repeat across sessions and draft them into candidate skills. **Nothing is added to your skill library here** — drafts land in a staging area for you to approve later with `/distill-review`.

## Steps

1. **Scan.** Run the bundled scanner (absolute path, it lives beside this plugin):
   ```sh
   node "${CLAUDE_PLUGIN_ROOT}/scripts/scan_sessions.mjs"
   ```
   It walks `~/.claude/projects/*/*.jsonl`, extracts tool-use sequences, and returns candidates that recur across **≥3 sessions** (status `new`). Each candidate has `sig`, `sample`, `count`, `sessions`.

2. **Review each candidate (gate 1).** For every returned candidate, dispatch the **skill-reviewer** subagent (Task tool, `subagent_type: skill-reviewer`) with the candidate's `sample` + `count` + `sessions`. It scores 0–100 on a 4-part rubric and, for scores ≥70, returns a complete draft `SKILL.md`.

3. **Stage the drafts.** For each accepted draft, write it to
   `~/.claude/skills/.suggested/<name>/SKILL.md` and mark the candidate `suggested`
   (call `setCandidateStatus` in `scripts/state.mjs`). Reject low scores (`rejected`).

4. **Report.** Tell the user: N new candidates found, M staged as drafts. Remind them to run **`/distill-review`** to approve. **Never write into `~/.claude/skills/<name>/` directly from here.**
