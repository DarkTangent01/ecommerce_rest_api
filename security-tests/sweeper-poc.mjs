// SEC-12 PoC (slow, ~1.5 min): the domain-event unique index makes every order.cancelled event after
// the first fail, which aborts the reservation sweeper mid-batch: each pass releases at most ONE expired order, so
// unpaid orders keep holding stock long after their window (default: 1 order per 60 s sweep). Run from the repo root:  node security-tests/sweeper-poc.mjs
// Local only: own API on 127.0.0.1:5055, in-memory database, 1-minute reservations, 5 s sweeps.
import { startHarness } from './harness.mjs';

const h = await startHarness({ env: { INVENTORY_RESERVATION_MINUTES: '1', RESERVATION_SWEEP_SECONDS: '5' } });
const { users } = h;
const product = await h.createProduct('seller', { name: 'Scarce Item', price: 5, stock: 8 });

const orders = [];
for (const who of ['alice', 'bob', 'alice', 'bob', 'alice', 'bob', 'alice', 'bob']) {
  await h.must('POST', '/cart/items', { token: users[who].token, body: { productId: product._id, quantity: 1 } });
  orders.push((await h.checkout(who)).json.data._id);
}
const stockOf = async () => (await h.must('GET', `/products/${product._id}`)).stock;
console.log(`8 unpaid orders hold all stock; stock now ${await stockOf()}`);

// Reservations expire after 60 s; wait ~3 sweeps past that. A healthy sweeper clears all 8 in one pass.
await new Promise((r) => setTimeout(r, 76_000));
const statuses = await Promise.all(
  orders.map(async (id, i) => (await h.must('GET', `/orders/${id}`, { token: users[i % 2 ? 'bob' : 'alice'].token })).status)
);
const stock = await stockOf();
const cancelled = statuses.filter((s) => s === 'cancelled').length;
console.log(`${cancelled === 8 && stock === 8 ? 'NOT REPRODUCED' : 'CONFIRMED'}  SEC-12  sweeper stalls after the first expiry`);
console.log(`    76 s after checkout (≈3 sweeps past expiry): ${cancelled}/8 expired orders cancelled; stock=${stock}/8`);
await h.stop();
process.exit(0);
