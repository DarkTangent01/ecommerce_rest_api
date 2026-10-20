import fs from 'node:fs';
import path from 'node:path';

/** Removes images uploaded to the backend's uploads/ folder during this run (seed + tests). */
export default function teardown(): void {
  const baselineFile = path.join(__dirname, '..', '.uploads-baseline.json');
  const uploadsDir = path.resolve(__dirname, '..', '..', '..', 'uploads');
  if (!fs.existsSync(baselineFile) || !fs.existsSync(uploadsDir)) return;
  const baseline = new Set(JSON.parse(fs.readFileSync(baselineFile, 'utf8')) as string[]);
  for (const file of fs.readdirSync(uploadsDir)) {
    if (!baseline.has(file)) fs.rmSync(path.join(uploadsDir, file), { force: true });
  }
}
