// Local backend for development and E2E: in-memory MongoDB replica set + the API from ../src,
// seeded through the public API. Does not modify the backend; it only uses the backend's own
// devDependencies (mongodb-memory-server, mongodb, tsx).
//
//   node e2e/support/backend.mjs            # runs until Ctrl+C
//
// Writes the seeded accounts and ids to e2e/.seed.json (git-ignored). The accounts and secrets
// are throwaway test values that only exist inside this in-memory database.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '../..');
const backendRoot = path.resolve(frontendRoot, '..');
const requireBackend = createRequire(path.join(backendRoot, 'package.json'));
// Reuse the mongod binary the backend's own test suite already cached (otherwise
// mongodb-memory-server derives the cache from the cwd and downloads a second copy).
process.env.MONGOMS_DOWNLOAD_DIR ??= path.join(backendRoot, 'node_modules', '.cache', 'mongodb-memory-server');
const { MongoMemoryReplSet } = requireBackend('mongodb-memory-server');
const { MongoClient } = requireBackend('mongodb');

const PORT = Number(process.env.E2E_API_PORT ?? 5000);
const API = `http://127.0.0.1:${PORT}/api/v1`;
const TENANT = 'default';
const seedFile = path.join(frontendRoot, 'e2e', '.seed.json');

// --- tiny solid-colour PNG encoder (passes the backend's magic-byte image check) ---
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const png = ([r, g, b], size = 320) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3).map((_, i) => [r, g, b][i % 3])]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
};

// --- seed data ---
const PASSWORD = 'ShopTest123';
const accounts = {
  admin: { name: 'Avery Admin', email: 'admin@shop.test', password: PASSWORD, role: 'admin' },
  seller: { name: 'Sam Seller', email: 'seller@shop.test', password: PASSWORD, role: 'seller' },
  customer: { name: 'Casey Customer', email: 'customer@shop.test', password: PASSWORD, role: 'user' },
};
const products = [
  { name: 'Stoneware Mug', price: 14.5, stock: 40, category: 'kitchen', color: [196, 120, 80], description: 'Hand-glazed 350 ml mug.' },
  { name: 'Pour-over Coffee Set', price: 42, stock: 12, category: 'kitchen', color: [120, 84, 60], description: 'Dripper, carafe and filters.' },
  { name: 'Linen Apron', price: 29.99, stock: 25, category: 'kitchen', color: [210, 200, 180], description: 'Washed linen with pockets.' },
  { name: 'Merino Beanie', price: 24, stock: 30, category: 'apparel', color: [70, 90, 140], description: 'Soft, warm and breathable.' },
  { name: 'Canvas Tote', price: 19.95, stock: 50, category: 'apparel', color: [230, 220, 200], description: 'Heavy cotton canvas, 18 L.' },
  { name: 'Rain Shell Jacket', price: 129, stock: 6, category: 'apparel', color: [40, 110, 90], description: 'Waterproof, packable shell.' },
  { name: 'Wireless Earbuds', price: 79.99, stock: 18, category: 'electronics', color: [30, 30, 40], description: 'Noise reduction, 24 h battery.' },
  { name: 'Desk Lamp', price: 49.5, stock: 3, category: 'home', color: [240, 200, 80], description: 'Dimmable LED with USB-C.' },
  { name: 'Wool Throw', price: 89, stock: 0, category: 'home', color: [150, 60, 60], description: 'Currently out of stock.' },
  { name: 'Trail Water Bottle', price: 22, stock: 60, category: 'outdoors', color: [60, 140, 200], description: 'Insulated steel, 750 ml.' },
  { name: 'Camping Lantern', price: 34.75, stock: 15, category: 'outdoors', color: [250, 150, 40], description: 'Rechargeable, 300 lumens.' },
  { name: 'Hammock', price: 59, stock: 9, category: 'outdoors', color: [90, 160, 110], description: 'Parachute nylon, carry bag included.' },
];

const secret = () => crypto.randomBytes(32).toString('hex');
const secrets = {
  JWT_SECRET: secret(),
  REFRESH_SECRET: secret(),
  WEBHOOK_SECRET: secret(),
  SERVICE_JWT_SECRET: secret(),
  SIGNED_URL_SECRET: secret(),
};

const call = async (method, url, { token, body, form, headers = {} } = {}) => {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: {
      'X-Tenant-Id': TENANT,
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(body && { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: form ?? (body && JSON.stringify(body)),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${JSON.stringify(json)}`);
  return json.data;
};

const waitForReady = async () => {
  for (let i = 0; i < 120; i++) {
    const res = await fetch(`${API}/ready`).catch(() => null);
    if (res?.ok) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Backend did not become ready');
};

const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
const dbUrl = mongo.getUri('ecommerce_e2e');

const server = spawn(process.execPath, [path.join(backendRoot, 'node_modules/tsx/dist/cli.mjs'), 'src/server.ts'], {
  cwd: backendRoot,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    APP_PORT: String(PORT),
    APP_IP_ADDRESS: '127.0.0.1',
    APP_URL: `http://127.0.0.1:${PORT}`,
    DB_URL: dbUrl,
    DEBUG_MODE: 'false',
    CORS_ORIGIN: 'http://localhost:4200,http://127.0.0.1:4200',
    BCRYPT_ROUNDS: '4',
    ...secrets,
  },
  stdio: ['ignore', 'ignore', 'inherit'],
});

let shuttingDown = false;
const shutdown = async (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  server.kill();
  await mongo.stop().catch(() => undefined);
  process.exit(code);
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
server.on('exit', (code) => {
  if (!shuttingDown) {
    console.error(`[e2e-backend] API exited with code ${code}`);
    void shutdown(1);
  }
});

try {
  await waitForReady();

  // Accounts: registered through the API; elevated roles are set directly in the test database
  // because the API deliberately has no endpoint for granting roles.
  const client = await MongoClient.connect(dbUrl);
  const tokens = {};
  for (const [key, account] of Object.entries(accounts)) {
    await call('POST', '/register', { body: { name: account.name, email: account.email, password: account.password, repeat_password: account.password } });
    if (account.role !== 'user') await client.db().collection('users').updateOne({ email: account.email }, { $set: { role: account.role } });
    tokens[key] = (await call('POST', '/login', { body: { email: account.email, password: account.password } })).access_token;
  }
  await client.close();

  const productIds = [];
  for (const product of products) {
    const form = new FormData();
    for (const field of ['name', 'price', 'stock', 'category', 'description']) form.set(field, String(product[field]));
    form.set('image', new Blob([png(product.color)], { type: 'image/png' }), `${product.name.toLowerCase().replace(/\W+/g, '-')}.png`);
    productIds.push((await call('POST', '/products', { token: tokens.seller, form }))._id);
  }

  await call('POST', '/coupons', {
    token: tokens.admin,
    body: { code: 'WELCOME10', type: 'percentage', value: 10, usageLimit: 1000, perUserLimit: 1, minOrderTotal: 0, isActive: true },
  });

  // One paid order for the customer, so order history and reviews have data.
  await call('POST', '/cart/items', { token: tokens.customer, body: { productId: productIds[0], quantity: 2 } });
  const order = await call('POST', '/orders/checkout', {
    token: tokens.customer,
    headers: { 'Idempotency-Key': `seed-${crypto.randomUUID()}` },
    body: { shippingAddress: { line1: '1 Market Street', city: 'Springfield', state: 'IL', postalCode: '62701', country: 'US' } },
  });
  const payload = JSON.stringify({ orderId: order._id, type: 'payment.succeeded', paymentReference: 'seed-payment' });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHmac('sha256', secrets.WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest('hex');
  const webhook = await fetch(`${API}/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Webhook-Event-Id': `seed-${order._id}`, 'X-Webhook-Timestamp': timestamp, 'X-Webhook-Signature': signature },
    body: payload,
  });
  if (!webhook.ok) throw new Error(`webhook failed: ${webhook.status}`);

  fs.writeFileSync(
    seedFile,
    JSON.stringify(
      {
        apiBaseUrl: API,
        accounts: Object.fromEntries(Object.entries(accounts).map(([key, a]) => [key, { email: a.email, password: a.password, role: a.role }])),
        productIds,
        paidOrderId: order._id,
        coupon: 'WELCOME10',
        webhookSecret: secrets.WEBHOOK_SECRET,
      },
      null,
      2,
    ),
  );
  console.log(`[e2e-backend] ready on ${API} (seed written to ${path.relative(frontendRoot, seedFile)})`);
} catch (err) {
  console.error('[e2e-backend] failed to start:', err);
  await shutdown(1);
}
