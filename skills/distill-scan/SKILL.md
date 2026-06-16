---
name: distill-scan
description: Scan Claude Code session history for repeated WORKFLOWS (not raw tool noise) and draft candidate skills via semantic analysis. Use when the user says /distill-scan, "沉淀技能", "扫历史找重复", "harvest skills from my sessions", or wants to turn recurring workflows into reusable skills.
---

# Distill Scan (semantic — gate 0 harvest + gate 1 review)

Find the *workflows* you repeat across sessions and draft them into candidate
skills. The semantic clustering is done by **you (Claude), running this skill** —
that is the whole reason this ships as a skill instead of a separate agent. No
external model, no extra cost. **Nothing enters the skill library here** — drafts
land in a staging area for `/distill-review`.

## Why this beats frequency counting

Counting raw tool sequences just surfaces noise (`Read>Edit`, `Bash>Bash`) that
every session has. Real reusable skills are *semantic*: a recurring intent
achieved a similar way. You read the digests and recognize those; a script can't.

## Token budget

You never read raw transcripts (that would be millions of tokens). Step 1
compresses each session to one line — intent + action chain — so the whole
history is typically a few thousand tokens. If it is still large, step 2 fans the
digests out to parallel subagents so no single context holds all of them.

## Steps

1. **Build digests (cheap, no LLM):**
   ```sh
   node "${CLAUDE_PLUGIN_ROOT}/scripts/digest_sessions.mjs" --full
   ```
   Writes `~/.claude/skill-distiller/digests.json` — one entry per session:
   `{ intent, actions }`, where `actions` is the key chain with arguments
   (`Bash(git commit)`, `Edit(auth.js)`, `Skill:new-api-pricing`).

2. **Read the digests.** Load `~/.claude/skill-distiller/digests.json`. If there
   are many sessions, dispatch parallel subagents (see
   `dispatching-parallel-agents`) to cluster chunks, then merge their findings.

3. **Cluster semantically (this is your job).** Across digests, find *recurring
   task types* — the same goal reached a similar way in **≥3 different sessions**.
   Judge by intent + action shape, not incidental tool ordering. Good clusters
   look like: "stand up a new API channel and adjust pricing", "debug → fix →
   test → commit loop on service X", "generate a weekly report from logs". Each
   cluster is one candidate skill.

4. **Score each candidate (gate 1).** Either dispatch the **skill-reviewer**
   subagent, or apply its rubric inline — 0–100 over recurrence / generality /
   determinism / non-duplication (check existing `~/.claude/skills/`). Keep ≥70.

5. **Draft the survivors.** For each kept candidate, write a complete `SKILL.md`
   to `~/.claude/skills/.suggested/<name>/SKILL.md`: kebab-case `name`, a
   trigger-rich one-line `description`, and concrete numbered steps drawn from
   the observed actions. Faithful to what was actually done — invent nothing.

6. **Report:** clusters found, drafts staged, and remind the user to run
   **`/distill-review`** to approve. Never write into `~/.claude/skills/<name>/`
   directly from here.
