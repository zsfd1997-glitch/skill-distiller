# skill-distiller

> Turn the things you do over and over in Claude Code into reusable skills —
> with quality control, not noise.

A Claude Code plugin that watches your session history, notices action sequences
you repeat across sessions, and distills them into skills. Inspired by the
self-improvement loop in [Hermes Agent](https://github.com/NousResearch/hermes-agent),
but packaged as a plugin you drop in — no separate agent to install.

## The three gates (why it doesn't pollute your library)

Naively "auto-creating skills from repeated actions" produces a pile of junk.
skill-distiller borrows Hermes' three-gate model so only good skills survive:

1. **Review agent** — a `skill-reviewer` subagent scores every candidate 0–100
   on recurrence, generality, determinism, and non-duplication. Low scores die.
2. **Human opt-in** — survivors are written as *drafts* to a staging area.
   Nothing enters your real library until you approve it in `/distill-review`.
3. **Curator** — a background pass ranks skills by real usage, flags stale ones
   (30d) and archival candidates (90d), and proposes merging near-duplicates —
   always with your confirmation, never auto-deleting.

## How it works

```
~/.claude/projects/*.jsonl
   │  (Stop hook, incremental — just harvests, never interrupts)
   ▼
candidates.json ──/distill-scan──▶ skill-reviewer scores ──▶ .suggested/ drafts
                                                                  │
                                              /distill-review (you approve)
                                                                  ▼
                                                   ~/.claude/skills/<name>/
                                                                  │
                                              /distill-curate (weekly)
                                                                  ▼
                                          rank · stale · archive · merge (confirmed)
```

## Install

```sh
git clone https://github.com/zsfd1997-glitch/skill-distiller
# Option A: load as a plugin (recommended)
#   point your Claude Code plugins at the cloned folder
# Option B: copy the three skills into ~/.claude/skills/ and register the Stop
#   hook from hooks/hooks.json in your settings.json
```

Requires Node ≥ 18 (no dependencies — pure `node:` builtins).

## Usage

| Command | What it does |
|---|---|
| `/distill-scan` | Scan history, score candidates, stage drafts |
| `/distill-review` | Approve / edit / reject drafts (opt-in gate) |
| `/distill-curate` | Rank, flag stale, propose merges (confirmed) |

The **Stop hook** quietly harvests candidates after each session, so by the time
you run `/distill-review` there's something to look at. It never creates skills
on its own.

## Data & control

- Runtime state: `~/.claude/skill-distiller/` (`candidates.json`, `ledger.json`,
  `seen.json`, `backups/`). Never committed.
- Staged drafts: `~/.claude/skills/.suggested/`.
- **Disable auto-harvest:** remove the `Stop` hook from your settings (or this
  plugin's `hooks/hooks.json`). The slash commands still work manually.

## Tuning

- "Worth distilling" threshold (`MIN_SESSIONS`, default 3) and window
  (`WIN`, default 2) live in `scripts/scan_sessions.mjs`.
- Stale/archive horizons live in `scripts/curator.mjs`.

## License

MIT © Jasonzsfd1997
