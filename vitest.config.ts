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
    env: {
      /**
       * Run the suite where the users are.
       *
       * This isn't a preference — it's the only timezone the app is ever used
       * in, and testing anywhere else tests a configuration nobody has. It
       * matters because a whole class of bug here is invisible at UTC: the date
       * helpers used to convert a local-midnight Date to UTC before reading the
       * day off it, which is correct at offset 0 and a day out at UTC+2. The
       * VAT201 declared 30 June – 30 July as "July", "Today" showed yesterday,
       * and a sale logged after midnight was stored with yesterday's date. The
       * tests passed throughout, because they ran at UTC.
       *
       * Anything that must be timezone-independent should say so by building
       * its own Date, not by relying on the runner's zone.
       */
      TZ: "Africa/Johannesburg",
    },
  },
});
