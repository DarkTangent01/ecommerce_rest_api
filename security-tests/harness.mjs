// Local-only test harness for the security PoCs.
// Starts the API from ../src on an in-memory MongoDB replica set (random secrets, port 5055),
// seeds one admin, one seller and two normal users through the API, and returns helpers.
// Nothing here talks to any host other than 127.0.0.1.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
export const backendRoot = path.resolve(here, '..');
const requireBackend = createRequire(path.join(backendRoot, 'package.json'));
process.env.MONGOMS_DOWNLOAD_DIR ??= path.join(backendRoot, 'node_modules', '.cache', 'mongodb-memory-server');
const { MongoMemoryReplSet } = requireBackend('mongodb-memory-server');
const { MongoClient } = requireBackend('mongodb');

export const PORT = 5055;
export const API = `http://127.0.0.1:${PORT}/api/v1`;
export const ADMIN_IP = '203.0.113.7'; // documentation range; only ever sent as a header to localhost
const PASSWORD = 'PocTest123';

// Smallest valid PNG (passes the backend's magic-byte check).
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
export const png = () => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(8, 0);
  ihdr.writeUInt32BE(8, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.concat(Array.from({ length: 8 }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(24, 128)])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
};

/** Raw request: returns { status, json, headers }. Every call gets its own X-Forwarded-For unless one is given. */
export const request = async (method, url, { token, body, form, headers = {} } = {}) => {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: {
      'X-Tenant-Id': 'default',
      'X-Forwarded-For': `198.51.100.${Math.floor(Math.random() * 250) + 1}`,
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(body && { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: form ?? (body && JSON.stringify(body)),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, headers: res.headers };
};

const must = async (...args) => {
  const r = await request(...args);
  if (r.status >= 400) throw new Error(`${args[0]} ${args[1]} -> ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.data;
};

// trustProxy 'loopback' simulates a trusted local proxy, so each request's X-Forwarded-For gives it its
// own rate-limit budget (needed since SEC-01 made TRUST_PROXY default to off). Pass false to test the default.
export const startHarness = async ({ env: extraEnv = {}, trustProxy = 'loopback' } = {}) => {
  const secrets = Object.fromEntries(
    ['JWT_SECRET', 'REFRESH_SECRET', 'WEBHOOK_SECRET', 'SERVICE_JWT_SECRET', 'SIGNED_URL_SECRET'].map((k) => [k, crypto.randomBytes(32).toString('hex')])
  );
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const dbUrl = mongo.getUri('ecommerce_security_poc');

  const uploadsDir = path.join(backendRoot, 'uploads');
  const uploadsBefore = new Set(fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : []);

  const server = spawn(process.execPath, [path.join(backendRoot, 'node_modules/tsx/dist/cli.mjs'), 'src/server.ts'], {
    cwd: backendRoot,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      APP_PORT: String(PORT),
      APP_IP_ADDRESS: '127.0.0.1',
      DB_URL: dbUrl,
      DEBUG_MODE: 'false',
      BCRYPT_ROUNDS: '4',
      ADMIN_IP_ALLOWLIST: ADMIN_IP,
      ...secrets,
      ...(trustProxy && { TRUST_PROXY: trustProxy }),
      ...extraEnv,
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  for (let i = 0; ; i++) {
    const res = await fetch(`${API}/ready`).catch(() => null);
    if (res?.ok) break;
    if (i > 120) throw new Error('backend did not become ready');
    await new Promise((r) => setTimeout(r, 500));
  }

  const db = new MongoClient(dbUrl);
  await db.connect();
  const users = {};
  for (const [key, role] of [['admin', 'admin'], ['seller', 'seller'], ['alice', 'user'], ['bob', 'user']]) {
    const email = `${key}@poc.test`;
    await must('POST', '/register', { body: { name: key, email, password: PASSWORD, repeat_password: PASSWORD } });
    if (role !== 'user') await db.db().collection('users').updateOne({ email }, { $set: { role } });
    users[key] = { email, role };
  }

  const login = async (key, headers = {}) => {
    const data = await must('POST', '/login', { body: { email: users[key].email, password: PASSWORD }, headers });
    return data;
  };
  for (const key of Object.keys(users)) users[key].token = (await login(key)).access_token;

  const createProduct = async (key, { name, price, stock }) => {
    const form = new FormData();
    form.append('name', name);
    form.append('price', String(price));
    form.append('stock', String(stock));
    form.append('image', new Blob([png()], { type: 'image/png' }), 'p.png');
    return must('POST', '/products', { token: users[key].token, form, headers: { 'X-Forwarded-For': ADMIN_IP } });
  };

  const signWebhook = (payload, timestamp = Math.floor(Date.now() / 1000)) =>
    crypto.createHmac('sha256', secrets.WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest('hex');

  const markPaid = async (orderId) => {
    const payload = JSON.stringify({ orderId, type: 'payment.succeeded' });
    const ts = Math.floor(Date.now() / 1000);
    const res = await fetch(`${API}/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signWebhook(payload, ts),
        'X-Webhook-Timestamp': String(ts),
        'X-Webhook-Event-Id': crypto.randomUUID(),
        'X-Payment-Provider': 'manual',
      },
      body: payload,
    });
    if (!res.ok) throw new Error(`webhook -> ${res.status}`);
  };

  const address = { line1: '1 Test St', city: 'Testville', state: 'TS', postalCode: '00000', country: 'Testland' };
  const checkout = (key, headers = {}) =>
    request('POST', '/orders/checkout', {
      token: users[key].token,
      body: { shippingAddress: { ...address, line1: `${key}'s home, 1 Private Lane` } },
      headers: { 'Idempotency-Key': crypto.randomUUID(), ...headers },
    });

  const stop = async () => {
    server.kill();
    await db.close();
    await mongo.stop();
    if (fs.existsSync(uploadsDir)) for (const f of fs.readdirSync(uploadsDir)) if (!uploadsBefore.has(f)) fs.rmSync(path.join(uploadsDir, f), { force: true });
  };

  return { users, login, createProduct, markPaid, checkout, signWebhook, request, must, db, stop, PASSWORD };
};
