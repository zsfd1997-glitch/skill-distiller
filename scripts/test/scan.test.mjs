import { test } from 'node:test';
import assert from 'node:assert';
import { extractSequences, signature, collectPerSession } from '../scan_sessions.mjs';

test('extractSequences yields length-2 sliding windows', () => {
  const blocks = [{ name: 'Read' }, { name: 'Edit' }, { name: 'Bash' }];
  const seqs = extractSequences(blocks, 2);
  assert.deepEqual(seqs.map(signature), ['Read>Edit', 'Edit>Bash']);
});

test('signature keeps skill name for Skill blocks', () => {
  const seq = [{ name: 'Skill', input: { name: 'brainstorming' } }, { name: 'Write' }];
  assert.equal(signature(seq), 'Skill:brainstorming>Write');
});

test('collectPerSession groups tool_use blocks by file', () => {
  const events = [
    { __file: 'a.jsonl', message: { content: [{ type: 'tool_use', name: 'Read' }, { type: 'text', text: 'hi' }] } },
    { __file: 'a.jsonl', message: { content: [{ type: 'tool_use', name: 'Edit' }] } },
    { __file: 'b.jsonl', message: { content: [{ type: 'tool_use', name: 'Bash' }] } },
  ];
  const m = collectPerSession(events);
  assert.deepEqual(m.get('a.jsonl').map((b) => b.name), ['Read', 'Edit']);
  assert.deepEqual(m.get('b.jsonl').map((b) => b.name), ['Bash']);
});

test('extractSequences with too few blocks yields nothing', () => {
  assert.deepEqual(extractSequences([{ name: 'Read' }], 2), []);
});
