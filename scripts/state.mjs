// State store for skill-distiller: candidates / ledger / seen.
// All writes are atomic (tmp + rename) so a crash never corrupts a file.
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

export function makeStore(dir) {
  mkdirSync(dir, { recursive: true });
  const p = (n) => join(dir, n + '.json');
  const load = (n) =>
    existsSync(p(n)) ? JSON.parse(readFileSync(p(n), 'utf8')) : n === 'seen' ? {} : [];
  const save = (n, v) => {
    const t = p(n) + '.tmp';
    writeFileSync(t, JSON.stringify(v, null, 2));
    renameSync(t, p(n));
  };
  return {
    getCandidates: () => load('candidates'),
    getLedger: () => load('ledger'),
    getSeen: () => load('seen'),
    saveSeen: (s) => save('seen', s),
    upsertCandidate(x) {
      const cs = load('candidates');
      let c = cs.find((c) => c.sig === x.sig);
      if (!c) {
        c = {
          sig: x.sig,
          kind: x.kind,
          sample: x.sample,
          count: 0,
          sessions: [],
          firstTs: x.ts,
          lastTs: x.ts,
          status: 'new',
        };
        cs.push(c);
      }
      if (!c.sessions.includes(x.session)) c.sessions.push(x.session);
      c.count++;
      c.lastTs = Math.max(c.lastTs, x.ts);
      save('candidates', cs);
      return c;
    },
    setCandidateStatus(sig, status, score) {
      const cs = load('candidates');
      const c = cs.find((c) => c.sig === sig);
      if (c) {
        c.status = status;
        if (score != null) c.score = score;
      }
      save('candidates', cs);
    },
    upsertLedger(item) {
      const l = load('ledger');
      const i = l.findIndex((e) => e.name === item.name);
      if (i >= 0) l[i] = { ...l[i], ...item };
      else l.push(item);
      save('ledger', l);
    },
  };
}
