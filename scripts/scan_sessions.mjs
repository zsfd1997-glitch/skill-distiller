// Scan Claude Code session transcripts for repeated action sequences.
// Reuses the session-report iterEvents pattern: ~/.claude/projects/<proj>/*.jsonl,
// one JSON event per line; tool calls are message.content[] blocks with type==='tool_use'.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { makeStore } from './state.mjs';

const WIN = 2; // sliding window length over the action stream
const MIN_SESSIONS = 3; // "worth distilling" = recurs across >= 3 sessions

// A stable fingerprint for an action sequence. Skill calls keep their skill name
// so /brainstorming and /xlsx don't collapse into one generic "Skill" step.
export const signature = (seq) =>
  seq.map((b) => b.name + (b.name === 'Skill' ? `:${b.input?.name || ''}` : '')).join('>');

export function extractSequences(toolBlocks, win = WIN) {
  const out = [];
  for (let i = 0; i + win <= toolBlocks.length; i++) out.push(toolBlocks.slice(i, i + win));
  return out;
}

function* iterEvents(projectsDir) {
  if (!existsSync(projectsDir)) return;
  for (const proj of readdirSync(projectsDir)) {
    const dir = join(projectsDir, proj);
    let st;
    try {
      st = statSync(dir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.jsonl')) continue;
      let text;
      try {
        text = readFileSync(join(dir, f), 'utf8');
      } catch {
        continue;
      }
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
          const ev = JSON.parse(line);
          ev.__file = basename(f);
          yield ev;
        } catch {}
      }
    }
  }
}

// Collect tool_use blocks per session file.
export function collectPerSession(events) {
  const perSession = new Map();
  for (const ev of events) {
    const msg = ev.message;
    if (!msg || !Array.isArray(msg.content)) continue;
    for (const b of msg.content) {
      if (b.type === 'tool_use') {
        if (!perSession.has(ev.__file)) perSession.set(ev.__file, []);
        perSession.get(ev.__file).push(b);
      }
    }
  }
  return perSession;
}

export function runScan({
  projectsDir = join(homedir(), '.claude', 'projects'),
  stateDir = join(homedir(), '.claude', 'skill-distiller'),
  incremental = true,
} = {}) {
  const store = makeStore(stateDir);
  const seen = store.getSeen();
  const perSession = collectPerSession(iterEvents(projectsDir));
  for (const [file, blocks] of perSession) {
    if (incremental && seen[file] === blocks.length) continue; // unchanged since last pass
    for (const seq of extractSequences(blocks)) {
      store.upsertCandidate({
        sig: signature(seq),
        kind: 'tool-seq',
        sample: signature(seq),
        session: file,
        ts: Date.now(),
      });
    }
    seen[file] = blocks.length;
  }
  store.saveSeen(seen);
  return store
    .getCandidates()
    .filter((c) => c.sessions.length >= MIN_SESSIONS && c.status === 'new');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = runScan({ incremental: process.argv.includes('--incremental') });
  console.log(JSON.stringify(r, null, 2));
}
