import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeStore } from '../state.mjs';

test('upsertCandidate accumulates count and sessions', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sd-'));
  const s = makeStore(dir);
  s.upsertCandidate({ sig: 'A', kind: 'tool-seq', sample: 'x', session: 's1', ts: 1 });
  s.upsertCandidate({ sig: 'A', kind: 'tool-seq', sample: 'x', session: 's2', ts: 2 });
  const c = s.getCandidates().find((c) => c.sig === 'A');
  assert.equal(c.count, 2);
  assert.deepEqual(c.sessions, ['s1', 's2']);
  assert.equal(c.lastTs, 2);
  assert.equal(c.firstTs, 1);
  rmSync(dir, { recursive: true });
});

test('same session does not duplicate in sessions[]', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sd-'));
  const s = makeStore(dir);
  s.upsertCandidate({ sig: 'B', kind: 'tool-seq', sample: 'y', session: 's1', ts: 1 });
  s.upsertCandidate({ sig: 'B', kind: 'tool-seq', sample: 'y', session: 's1', ts: 5 });
  const c = s.getCandidates().find((c) => c.sig === 'B');
  assert.deepEqual(c.sessions, ['s1']);
  assert.equal(c.count, 2);
  rmSync(dir, { recursive: true });
});

test('setCandidateStatus and ledger upsert persist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sd-'));
  const s = makeStore(dir);
  s.upsertCandidate({ sig: 'C', kind: 'tool-seq', sample: 'z', session: 's1', ts: 1 });
  s.setCandidateStatus('C', 'suggested', 82);
  const c = s.getCandidates().find((c) => c.sig === 'C');
  assert.equal(c.status, 'suggested');
  assert.equal(c.score, 82);
  s.upsertLedger({ name: 'foo', source: 'distilled', uses: 0, status: 'active' });
  s.upsertLedger({ name: 'foo', uses: 3 });
  const e = s.getLedger().find((e) => e.name === 'foo');
  assert.equal(e.uses, 3);
  assert.equal(e.status, 'active');
  rmSync(dir, { recursive: true });
});
