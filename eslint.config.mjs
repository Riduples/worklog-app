import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Static/vendored assets served as-is — not source. Notably the minified
    // pdf.js worker (public/pdf.worker.min.mjs), which trips no-this-alias.
    "public/**",
  ]),
]);

export default eslintConfig;
