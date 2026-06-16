// Curator: scores the skill library, flags stale/archive items, detects merge
// pairs. It only *proposes* — deletion/merge/archive always go through human
// confirmation in the distill-curate skill. (Hermes-style gate 3.)
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { makeStore } from './state.mjs';

const D = 864e5;
const STALE = 30 * D;
const ARCH = 90 * D;

export function classify(item, now = Date.now()) {
  const idle = now - (item.lastUsedTs || item.createdTs || now);
  if (idle >= ARCH) return { ...item, status: 'archive' };
  if (idle >= STALE) return { ...item, status: 'stale' };
  return { ...item, status: 'active' };
}

export function rank(ledger) {
  return [...ledger].sort((a, b) => (b.uses || 0) - (a.uses || 0));
}

function tokens(s) {
  return new Set(
    String(s || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2)
  );
}
function jaccard(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

// Propose merge pairs whose name+description overlap exceeds `sim`. Proposal only.
export function findMergePairs(ledger, sim = 0.6) {
  const pairs = [];
  for (let i = 0; i < ledger.length; i++) {
    for (let j = i + 1; j < ledger.length; j++) {
      const a = ledger[i], b = ledger[j];
      const score = jaccard(
        a.name + ' ' + (a.description || ''),
        b.name + ' ' + (b.description || '')
      );
      if (score >= sim) pairs.push({ a: a.name, b: b.name, similarity: +score.toFixed(2) });
    }
  }
  return pairs;
}

// Count Skill invocations from transcripts to refresh real usage.
function tallySkillUsage(projectsDir) {
  const uses = new Map();
  const lastTs = new Map();
  if (!existsSync(projectsDir)) return { uses, lastTs };
  for (const proj of readdirSync(projectsDir)) {
    const dir = join(projectsDir, proj);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
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
        let ev;
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        const msg = ev.message;
        if (!msg || !Array.isArray(msg.content)) continue;
        const ts = ev.timestamp ? Date.parse(ev.timestamp) : 0;
        for (const b of msg.content) {
          if (b.type === 'tool_use' && b.name === 'Skill') {
            const n = b.input?.name;
            if (!n) continue;
            uses.set(n, (uses.get(n) || 0) + 1);
            if (ts) lastTs.set(n, Math.max(lastTs.get(n) || 0, ts));
          }
        }
      }
    }
  }
  return { uses, lastTs };
}

export function runCurate({
  projectsDir = join(homedir(), '.claude', 'projects'),
  stateDir = join(homedir(), '.claude', 'skill-distiller'),
  now = Date.now(),
} = {}) {
  const store = makeStore(stateDir);
  const { uses, lastTs } = tallySkillUsage(projectsDir);
  let ledger = store.getLedger().map((e) => ({
    ...e,
    uses: uses.get(e.name) ?? e.uses ?? 0,
    lastUsedTs: lastTs.get(e.name) ?? e.lastUsedTs ?? e.createdTs,
  }));
  for (const e of ledger) store.upsertLedger(e);
  const classified = ledger.map((e) => classify(e, now));
  return {
    ranking: rank(ledger).map((e) => ({ name: e.name, uses: e.uses || 0 })),
    stale: classified.filter((e) => e.status === 'stale').map((e) => e.name),
    archive: classified.filter((e) => e.status === 'archive').map((e) => e.name),
    mergePairs: findMergePairs(ledger),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(runCurate(), null, 2));
}
