import { defineConfig } from "vitest/config";

// Unit tests only — pure functions in src/lib and the document templates.
// Anything touching Supabase or the browser is verified against the live app
// instead; mocking the database would only test the mock.
export default defineConfig({
  // Resolves the "@/*" alias straight from tsconfig.json, so tests import
  // exactly what the app imports.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
