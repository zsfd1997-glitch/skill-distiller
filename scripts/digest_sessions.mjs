// Build a compact, semantic digest of each Claude Code session — cheap and
// LLM-free. The digest (user intent + key action chain WITH arguments) is the
// material /distill-scan hands to Claude for semantic clustering. The "LLM step"
// runs inside the skill itself (Claude is the one executing it), so there is no
// external model call here — this script only prepares readable material.
//
// Cost control: it aggressively drops noise (file reads, bare shell exploration,
// todo/question bookkeeping) and skips trivial sessions, so the whole history
// compresses to something Claude can actually read.
import {
  readFileSync,
  readdirSync,
  statSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  renameSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const base = (p) => (p ? String(p).split('/').pop() : '');

// Shell commands that are pure exploration / housekeeping — no workflow signal.
const NOISE_CMDS = new Set([
  'ls', 'cd', 'cat', 'echo', 'pwd', 'grep', 'find', 'head', 'tail', 'which', 'wc',
  'env', 'sleep', 'clear', 'tree', 'printf', 'date', 'sort', 'uniq', 'cut', 'xargs',
  'awk', 'sed', 'type', 'set', 'source', 'export', 'true', 'false', 'test', 'cmp',
]);
// Tools that carry no reusable-workflow signal on their own.
const NOISE_TOOLS = new Set([
  'Read', 'TodoWrite', 'AskUserQuestion', 'BashOutput', 'KillShell', 'KillBash',
]);

// program + subcommand carries the intent: "git commit", "npm test", "docker run"
export function cmdHead(cmd) {
  if (!cmd) return '';
  const firstLine = String(cmd).trim().split('\n')[0];
  const toks = firstLine.split(/\s+/).filter(Boolean);
  return toks.slice(0, 2).join(' ');
}
export function cmdProgram(cmd) {
  if (!cmd) return '';
  return String(cmd).trim().split('\n')[0].split(/\s+/).filter(Boolean)[0] || '';
}

// Return a short label, or null if the action is noise (dropped from the digest).
export function actionLabel(b) {
  const n = b.name || '?';
  const inp = b.input || {};
  if (NOISE_TOOLS.has(n)) return null;
  if (n === 'Bash') {
    const prog = cmdProgram(inp.command);
    if (!prog || NOISE_CMDS.has(prog)) return null; // bare/exploration shell = noise
    return `Bash(${cmdHead(inp.command)})`;
  }
  if (n === 'Edit' || n === 'Write' || n === 'NotebookEdit')
    return `${n}(${base(inp.file_path || inp.notebook_path || '')})`;
  if (n === 'Skill') return `Skill:${inp.name || '?'}`;
  if (n === 'Task') return `Task:${inp.subagent_type || '?'}`;
  if (n.startsWith('mcp__')) return 'mcp:' + n.slice(5);
  return n;
}

function extractText(content) {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join(' ')
      .trim();
  }
  return '';
}

// [A,A,A,B,A] -> ["A×3","B","A"] so a repeated step reads as one item with a count.
export function collapse(labels) {
  const out = [];
  for (const l of labels) {
    const last = out[out.length - 1];
    if (last && last.label === l) last.n++;
    else out.push({ label: l, n: 1 });
  }
  return out.map((e) => (e.n > 1 ? `${e.label}×${e.n}` : e.label));
}

export function digestSession(events, { maxIntent = 120, maxActions = 30 } = {}) {
  let intent = '';
  const actions = [];
  for (const ev of events) {
    const msg = ev.message;
    if (!msg) continue;
    if (!intent && msg.role === 'user') {
      const txt = extractText(msg.content);
      if (txt) intent = txt.slice(0, maxIntent);
    }
    if (Array.isArray(msg.content)) {
      for (const b of msg.content) {
        if (b.type === 'tool_use') {
          const lbl = actionLabel(b);
          if (lbl) actions.push(lbl);
        }
      }
    }
  }
  return { intent, actions: collapse(actions).slice(0, maxActions) };
}

function* iterSessionFiles(projectsDir) {
  if (!existsSync(projectsDir)) return;
  for (const proj of readdirSync(projectsDir)) {
    const dir = join(projectsDir, proj);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.jsonl')) yield { file: f, full: join(dir, f) };
    }
  }
}

function parseEvents(text) {
  const evs = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      evs.push(JSON.parse(line));
    } catch {}
  }
  return evs;
}

export function runDigest({
  projectsDir = join(homedir(), '.claude', 'projects'),
  stateDir = join(homedir(), '.claude', 'skill-distiller'),
  incremental = true,
  minActions = 3, // pre-filter: trivial/one-off sessions are skipped
} = {}) {
  mkdirSync(stateDir, { recursive: true });
  const cachePath = join(stateDir, 'digests.json');
  const seenPath = join(stateDir, 'digest-seen.json');
  const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
  const seen = existsSync(seenPath) ? JSON.parse(readFileSync(seenPath, 'utf8')) : {};
  let updated = 0;
  let skipped = 0;
  for (const { file, full } of iterSessionFiles(projectsDir)) {
    let text;
    try {
      text = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    const size = text.length;
    if (incremental && seen[file] === size && cache[file]) continue;
    const d = digestSession(parseEvents(text));
    seen[file] = size;
    if (d.actions.length < minActions) {
      delete cache[file]; // a session that shrank below threshold drops out
      skipped++;
      continue;
    }
    cache[file] = d;
    updated++;
  }
  const save = (p, v) => {
    const t = p + '.tmp';
    writeFileSync(t, JSON.stringify(v, null, 2));
    renameSync(t, p);
  };
  save(cachePath, cache);
  save(seenPath, seen);
  return { updated, skipped, total: Object.keys(cache).length, cachePath };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = runDigest({ incremental: !process.argv.includes('--full') });
  console.error(`digested: ${r.updated} updated, ${r.skipped} skipped, ${r.total} total -> ${r.cachePath}`);
}
