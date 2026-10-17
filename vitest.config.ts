import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vitest/config";

// NodeNext-style imports use ".js" specifiers even when the source file is ".ts".
// Vite only applies that mapping for TS importers, so JS files that import an
// already-migrated module need this fallback while allowJs is in use.
const jsToTs = (): Plugin => ({
  name: "js-specifier-to-ts",
  enforce: "pre",
  resolveId(source, importer) {
    if (!importer || !source.startsWith(".") || !source.endsWith(".js")) return null;
    const resolved = path.resolve(path.dirname(importer), source);
    if (fs.existsSync(resolved)) return null;
    const tsFile = `${resolved.slice(0, -3)}.ts`;
    return fs.existsSync(tsFile) ? tsFile : null;
  },
});

export default defineConfig({
  plugins: [jsToTs()],
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup/env.ts"],
    // Integration suites start an in-memory MongoDB replica set per file.
    hookTimeout: 120_000,
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
