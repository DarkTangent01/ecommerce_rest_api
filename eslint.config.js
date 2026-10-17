import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**", "frontend/**", "logs/**", "uploads/**"],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  {
    files: ["**/*.ts"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["vitest.config.ts", "scripts/migrations/*.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // In-memory adapters (cache, redis, queue) keep async signatures to match their real backends.
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { arguments: false } }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
  {
    // Controller singletons bind every handler in their constructor, so passing
    // `controller.method` to the router is safe.
    files: ["src/modules/**/routes.ts"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
    },
  },
  {
    // Test fakes return plain values from async methods, and supertest bodies are untyped JSON.
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
    },
  },
  {
    files: ["**/*.js"],
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_|^(req|res|next)$", caughtErrors: "none" }],
    },
  },
  prettier
);
