# Worklog

Bookkeeping for South African small and informal businesses — tradespeople, freelancers, salons, spaza shops.

A mobile-first PWA (Next.js App Router + TypeScript) on Supabase, deployed to Vercel. Phones are the point; the desktop layout is an enhancement on top of it, not the other way round.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

You need a `.env.local` before it will do anything. Copy `.env.example` and fill it in:

| Variable | What it's for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key — safe in the browser; RLS is the boundary |
| `ANTHROPIC_API_KEY` | Quick Log, the help assistant, bank-statement parsing. Server-only — never `NEXT_PUBLIC_*` |
| `PUPPETEER_EXECUTABLE_PATH` | Local Chrome, for PDF rendering. Vercel uses `@sparticuz/chromium` instead |

`.env.local` is gitignored and must stay that way.

## Checks

```bash
npm run lint         # must exit 0
npx tsc --noEmit     # must be silent
npm test             # vitest
npm run build
```

All four are expected to pass. Lint has no allowed baseline — if it reports anything, that's a regression.

The test suite runs at `Africa/Johannesburg` (set in `vitest.config.ts`). That's deliberate: it's the only timezone the app is used in, and a whole class of date bug here is invisible at UTC. Don't "fix" it by removing the setting.

## How it fits together

- **`src/app/(app)/`** — the app, behind auth. `proxy.ts` redirects anyone unauthenticated to `/login`.
- **`src/app/(auth)/`** — login and signup.
- **`src/app/api/`** — four routes: `quick-log`, `help-assistant`, `parse-statement` (all Anthropic) and `render-pdf` (Chromium). All rate-limited per user, per hour.
- **`src/components/`** — one view per tool, plus modals. Styling is inline, ported from the prototype; only layout that needs a media query lives in `globals.css`, because a style attribute can't hold one.
- **`src/lib/`** — the money and tax rules, and the Supabase hooks. Anything arithmetic belongs here where it can be tested.
- **`supabase/migrations/`** — every schema change, in order. Applied straight to production; there is no staging.

## Things worth knowing before you change something

- **RLS is the security boundary**, not the UI. `useToolAccess` and `useToolGate` only decide what's worth showing; the database decides what's allowed. Never treat a UI check as a control.
- **VAT runs in two directions.** An invoice's `invoice_amount` is ex-VAT and VAT is added on top; cash `income.amount` is gross and VAT is extracted from within it. This is not a bug — see `src/lib/taxRates.ts`.
- **`balance_due` is ex-VAT and goes to zero when paid, while `vat_amount` stays.** Always use `balanceInclVat()`; adding the two by hand says a paid invoice still owes you the VAT.
- **Dates are calendar days, not instants.** Use `toLocalIsoDate()`. `toISOString()` converts to UTC first and names the wrong day at UTC+2.
- **Money is `NUMERIC(12,2)`** — a deliberate deviation from the spec's BIGINT-cents.
- **Green is reserved for WhatsApp.** Navy `#0C4A6E` is primary, sky-blue means success.
- **Income and expense capture survive a dropped signal.** A write that can't reach the server is queued in an IndexedDB outbox (`src/lib/offline/`) under a device-minted row id and replayed when the connection returns. The device-minted id is what makes replay safe — a write that actually landed before the drop collides on `23505` instead of entering the money twice. Classification is by SQLSTATE, never `navigator.onLine` (which lies on captive wifi). Quotes/invoices/POs are deliberately out: their document numbers are server-allocated and can't be minted on a phone.

## Deployment

Push to `main`; Vercel builds and deploys. Env vars are configured in Vercel, not here.
