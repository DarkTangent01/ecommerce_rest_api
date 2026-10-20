// Serves the production build (dist/) with SPA fallback and proxies /api and /uploads to the
// local backend, the way a reverse proxy would in production.  node e2e/support/serve-dist.mjs
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist/ecommerce-admin-ui/browser');
const PORT = Number(process.env.DIST_PORT ?? 4300);
const API = { host: '127.0.0.1', port: Number(process.env.E2E_API_PORT ?? 5000) };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ico': 'image/x-icon', '.json': 'application/json' };

http
  .createServer((req, res) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/uploads/')) {
      const upstream = http.request({ ...API, path: req.url, method: req.method, headers: req.headers }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      });
      upstream.on('error', () => res.writeHead(502).end());
      return void req.pipe(upstream);
    }
    const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    const target = file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' });
    fs.createReadStream(target).pipe(res);
  })
  .listen(PORT, () => console.log(`[serve-dist] http://localhost:${PORT}`));
