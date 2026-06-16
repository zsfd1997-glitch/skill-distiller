import { test } from 'node:test';
import assert from 'node:assert';
import { classify, rank, findMergePairs } from '../curator.mjs';

test('classify: stale at 30d, archive at 90d, else active', () => {
  const now = Date.now(), d = 864e5;
  assert.equal(classify({ lastUsedTs: now - 40 * d }, now).status, 'stale');
  assert.equal(classify({ lastUsedTs: now - 100 * d }, now).status, 'archive');
  assert.equal(classify({ lastUsedTs: now - 2 * d }, now).status, 'active');
});

test('rank sorts by uses descending', () => {
  const r = rank([{ name: 'a', uses: 1 }, { name: 'b', uses: 9 }, { name: 'c', uses: 4 }]);
  assert.deepEqual(r.map((e) => e.name), ['b', 'c', 'a']);
});

test('findMergePairs flags near-duplicates, leaves unrelated alone', () => {
  const pairs = findMergePairs(
    [
      { name: 'deploy-prod', description: 'deploy the production server with docker' },
      { name: 'prod-deploy', description: 'deploy production server using docker compose' },
      { name: 'write-poem', description: 'compose a short rhyming poem' },
    ],
    0.4
  );
  assert.ok(
    pairs.some(
      (p) =>
        (p.a === 'deploy-prod' && p.b === 'prod-deploy') ||
        (p.a === 'prod-deploy' && p.b === 'deploy-prod')
    )
  );
  assert.ok(!pairs.some((p) => p.a === 'write-poem' || p.b === 'write-poem'));
});
