import { test } from 'node:test';
import assert from 'node:assert';
import { cmdHead, cmdProgram, actionLabel, collapse, digestSession } from '../digest_sessions.mjs';

test('cmdHead keeps program + subcommand; cmdProgram keeps program', () => {
  assert.equal(cmdHead('git commit -m "msg"'), 'git commit');
  assert.equal(cmdHead('  npm   test '), 'npm test');
  assert.equal(cmdProgram('docker run x'), 'docker');
  assert.equal(cmdProgram(''), '');
});

test('actionLabel keeps meaningful actions with their key arg', () => {
  assert.equal(actionLabel({ name: 'Bash', input: { command: 'docker run x' } }), 'Bash(docker run)');
  assert.equal(actionLabel({ name: 'Edit', input: { file_path: '/a/b/auth.js' } }), 'Edit(auth.js)');
  assert.equal(actionLabel({ name: 'Skill', input: { name: 'brainstorming' } }), 'Skill:brainstorming');
  assert.equal(actionLabel({ name: 'mcp__chrome__navigate', input: {} }), 'mcp:chrome__navigate');
});

test('actionLabel drops noise: Read, bare shell, todo/question bookkeeping', () => {
  assert.equal(actionLabel({ name: 'Read', input: { file_path: 'x' } }), null);
  assert.equal(actionLabel({ name: 'Bash', input: { command: 'ls -la' } }), null);
  assert.equal(actionLabel({ name: 'Bash', input: { command: 'cat foo' } }), null);
  assert.equal(actionLabel({ name: 'TodoWrite', input: {} }), null);
  assert.equal(actionLabel({ name: 'AskUserQuestion', input: {} }), null);
});

test('collapse folds consecutive duplicates with a count', () => {
  assert.deepEqual(collapse(['A', 'A', 'A', 'B', 'A']), ['A×3', 'B', 'A']);
});

test('digestSession keeps intent and only meaningful actions (Read filtered out)', () => {
  const events = [
    { message: { role: 'user', content: 'fix the login bug' } },
    { message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'auth.js' } }] } },
    { message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'auth.js' } }] } },
    { message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm test' } }] } },
  ];
  const d = digestSession(events);
  assert.equal(d.intent, 'fix the login bug');
  assert.deepEqual(d.actions, ['Edit(auth.js)', 'Bash(npm test)']); // Read dropped
});
