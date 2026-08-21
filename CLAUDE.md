@AGENTS.md

# Worklog — guide for AI assistants

Bookkeeping for South African small and informal businesses (tradespeople, freelancers,
salons, spaza shops). Mobile-first PWA: **Next.js 16 App Router + React 19 + TypeScript**
on **Supabase** (Postgres + Auth + Storage), deployed to **Vercel**. Phones are the point —
the desktop layout is an enhancement on top of the 480px column, never the other way round.

`README.md` is the human-facing orientation and is worth reading too; this file is the
working detail an assistant needs before touching code.

## Before you write code

1. **This is not the Next.js in your training data** (see `AGENTS.md`). Version 16 has
   breaking changes — e.g. middleware is now **`src/proxy.ts` exporting `proxy()`**, not
   `middleware.ts`. Read the relevant guide in `node_modules/next/dist/docs/` first
   (run `npm install` if `node_modules` is absent).
2. **Read the file you're changing, end to end.** This codebase carries unusually dense
   comments that record *why* a thing is the way it is — most of them are the scar tissue
   of a real bug. A change that contradicts a comment is almost always a regression.
3. **Match the surrounding style.** Inline styles in components, comments that explain
   the reasoning rather than the mechanics, and no new dependencies without a reason.

## Commands

```bash
npm install
npm run dev            # http://localhost:3000
npm run lint           # eslint — must exit 0, there is no allowed baseline
npx tsc --noEmit       # must be silent
npm test               # vitest run (39 test files, 562 tests at last commit)
npm run test:watch
npm run build
```

**All four checks (lint, tsc, test, build) are the gate.** Run them before committing;
report the result in the commit message the way existing commits do
(`Gate: tsc 0, eslint 0, 562 tests, build ok`).

The suite runs at `TZ=Africa/Johannesburg`, set in `vitest.config.ts`. That is deliberate:
it is the only timezone the app is used in, and a whole class of date bug is invisible at
UTC. Never "fix" it by removing the setting.

## Layout

```
src/
  proxy.ts                  Next 16 proxy (was middleware) → src/lib/supabase/middleware.ts
  app/
    (app)/                  the app, behind auth — one page.tsx per tool
    (auth)/                 login, signup
    api/                    quick-log, help-assistant, parse-statement, render-pdf,
                            cron/notifications, payfast/checkout, payfast/notify
    help/, terms/, privacy/, pricing/, accept-invite/   public pages
    layout.tsx, globals.css, manifest.ts
  components/               one view per tool + modals; see components/ui for the kit
  lib/                      money/tax rules, Supabase hooks, docgen, offline outbox
supabase/migrations/        every schema change, numbered, in order (0001 → 0128)
supabase/email-templates/   Supabase Auth email HTML
public/                     service worker, pdf.js worker, icons, offline.html
```

### Page → view pattern

A route file is a thin server component that guards access and renders a client view:

```tsx
export default async function InvoicesPage() {
  await requireBusinessProfile();          // or requirePlanAccess("invoice")
  return <Suspense><InvoicesView /></Suspense>;
}
```

All real UI lives in `src/components/<area>/<Tool>View.tsx` as a `"use client"` component
that reads data through the react-query hooks. `Suspense` is needed wherever the view uses
`useSearchParams()`.

### Data access

Every table is reached through a hook in `src/lib/supabase/hooks/` using TanStack Query:
`useQuery` for reads keyed on a stable `QUERY_KEY`, `useMutation` + `invalidateQueries` for
writes. Rows are soft-deleted — lists filter `.is("deleted_at", null)`. Types come from
`src/lib/types/database.ts` (generated from the live schema) via `Tables<"income">`,
`TablesInsert<…>`, `TablesUpdate<…>`. Never hand-write a row type.

`getCurrentBusinessId()` resolves the caller's business; most queries don't filter by it
because **RLS already scopes them**.

## Security model — read this before adding any gate

There are three layers and only one of them is a control:

| Layer | Where | What it is |
|---|---|---|
| **Postgres RLS** | `supabase/migrations/` — `has_tool_access` (0047), `plan_allows` (0052), business membership (0031) | **The security boundary.** The database decides. |
| Page guards | `src/lib/auth.ts` — `requireUser`, `requireBusinessProfile`, `requirePlanAccess`, `requirePlatformAdmin` | A courtesy so a user meets an upgrade prompt instead of a database rejection. |
| UI gates | `useToolGate`, `useToolAccess`, `useWriteAccess`, `isLocked` | Decide only what is *worth showing*. Never a control. |

Rules that follow from that:

- Never treat a UI check as the thing preventing an action. If a new capability needs
  enforcing, it needs an RLS policy or a `SECURITY DEFINER` function.
- Client entitlement tables (`src/lib/tiers.ts` `ENTITLEMENTS`, `monthlyAiLogs`,
  `maxMembers`) **mirror** SQL (`plan_allows()`, `ai_monthly_cap()`, the member-cap
  function). Change one, change the other in the same commit.
- Components check **capabilities** (`hasStaffTools`, `hasComplianceTools`), not tier names.
- A page that is padlocked in the nav must call `requirePlanAccess()`, or it is reachable
  by typing the URL (this was a real bug fixed in the audit commit).
- `useToolGate` is shared by the sidebar and the dashboard precisely so they can never
  disagree about a tool.
- Business-type filtering (`src/lib/businessTypes.ts`) *hides* tools to reduce overwhelm;
  it never locks them. "Show every tool" restores the set.
- Read-only mode (expired trial, past-due subscription) comes from `useWriteAccess()`;
  read-only businesses may view and export, not write.
- Four tables — `ai_usage_monthly`, `api_rate_limits`, `payment_events`, `platform_admins` —
  have RLS on with **zero policies** on purpose (deny-all, server-only via SECURITY DEFINER
  RPCs or the service-role webhook). Migration 0128 documents this. Don't add a client
  policy without a real client read behind it.
- `SUPABASE_SERVICE_ROLE_KEY` is used only by the PayFast ITN and the cron route
  (`src/lib/supabase/admin.ts`). It bypasses RLS. Never reach for it to make a UI feature work.
- Secrets are server-only. Anything `NEXT_PUBLIC_*` is in the browser — only the Supabase
  URL and anon key belong there.

## Money and tax rules

These are the rules the app gets wrong when someone reimplements them locally. Use the
shared helper; don't retype the arithmetic.

- **VAT runs in two directions.** An invoice's `invoice_amount` is **ex-VAT** and VAT is
  added on top; cash `income.amount` is **gross** and VAT is extracted from within it.
  See `src/lib/taxRates.ts` (`incomeNet`, `expenseNet`) and `src/lib/vatSupplyTypes.ts`.
- **`balance_due` is ex-VAT and goes to zero when paid, while `vat_amount` stays.** Always
  use `balanceInclVat()` (`src/lib/balance.ts`). Adding the two by hand tells a customer a
  paid invoice still owes the VAT.
- **Dates are calendar days, not instants.** Use `toLocalIsoDate()` / `todayStr()` from
  `src/lib/format.ts`. `toISOString()` converts to UTC first and names the wrong day at
  UTC+2. Period filtering goes through `inPeriod()` (`src/lib/period.ts`), which is closed
  at both ends.
- **Profit is defined once**, in `src/lib/pnl.ts`: accrual, ex-VAT both sides, with a payment
  netted against the document it settles. The dashboard and the P&L report both call it.
- **Reports exclude `is_personal` and `is_credit_settlement` rows** and work ex-VAT on both
  sides. A new report that sums gross expenses against ex-VAT income overstates the profit.
- **SARS categories are canonical `"Group — Detail"` strings** from `src/lib/sarsCategories.ts`.
  Anything that classifies (AI statement parsing, CSV import, forms) must map through
  `getSarsMatch` / `getSarsIncomeMatch` / `findSarsCategory` and store `null` when there is
  no confident match — a bare label silently splits every grouped report.
- **Rates live in the `tax_rates` table** (admin-editable, one row per tax year, selected by
  effective date). The constants in `src/lib/taxRates.ts` are the fallback for load time,
  unreachability, server code and tests. Keep the fallback in step with the current row;
  `taxRates.test.ts` asserts the thresholds fall out of the rebates.
- **Money is `NUMERIC(12,2)`** in Postgres — a deliberate deviation from the spec's
  BIGINT-cents. Values arrive as numbers; coerce defensively (`Number(x ?? 0)`).
- **Document numbers are server-allocated.** `src/lib/docNumber.ts` calls the
  `reserve_doc_numbers` RPC (migration 0121), which increments a counter row in one
  statement. Never go back to "read the max and add one" — two users get the same number.
  Series: `QTE`, `INV`, `PO`, `CN`, `SI`, `EMP` (payslips are numbered inside `create_pay_run`).

## Offline capture

Income and expense capture survive a dropped signal (`src/lib/offline/`):

- The row id is **minted on the device** (`newClientId`), which is what makes replay safe:
  a write that actually landed before the drop collides on `23505` instead of entering the
  money twice.
- `captureWrite()` classifies the outcome **by SQLSTATE**, never `navigator.onLine` (which
  lies on captive wifi): `23505` → duplicate (done), any other five-character SQLSTATE →
  reject (throw, don't queue), no SQLSTATE → network (queue to the IndexedDB outbox).
- `identity.ts` remembers `businessId`/`userId` in localStorage so a queued row can be
  attributed without a database round-trip.
- Quotes, invoices and POs are deliberately **out of scope** — their document numbers are
  server-allocated and can't be minted on a phone.
- The pure decision logic lives in `outboxCore.ts` with no IndexedDB or network, so it can
  be tested exhaustively. Keep it that way.

## API routes

All under `src/app/api/`, all `runtime = "nodejs"`.

| Route | Notes |
|---|---|
| `quick-log` | Anthropic (`claude-haiku-4-5`), structured tool-schema output. Rate-limited **and** monthly AI quota (`enforceAiQuota`). |
| `help-assistant` | Loggy, the in-app bot. Reads the Help Centre corpus (`src/lib/help/knowledge.ts`) as its whole knowledge base, with `cache_control` on the large system block. |
| `parse-statement` | Bank-statement reading. `maxDuration = 60`. Must map categories to canonical SARS values. |
| `render-pdf` | Puppeteer + `@sparticuz/chromium` (local dev uses `PUPPETEER_EXECUTABLE_PATH`). Renders the `src/lib/docgen/build*HTML` templates. |
| `cron/notifications` | Daily via `vercel.json` cron. Guarded by a `CRON_SECRET` bearer, fails closed, marks `*_notified_at` so nothing is emailed twice. |
| `payfast/checkout` | Builds and auto-submits the signed PayFast form server-side; the passphrase never reaches the browser. |
| `payfast/notify` | The ITN webhook. Public (no session), verifies PayFast's signature, writes with the service-role client. |

The four AI/PDF routes call `enforceRateLimit(supabase, "<route>")` **after** the auth check
and **before** the expensive work. Limits live in Postgres (`consume_rate_limit`, migration
0058) because these routes talk to the DB as the signed-in user; the route name must match a
`CASE` arm there. The limiter fails **open**.

Public routes (`/api/payfast/notify`, `/api/cron/*`, the legal and help pages, `/pricing`,
`/accept-invite`) are enumerated in `src/lib/supabase/middleware.ts` — each enforces its own auth.

## Styling

- **Inline styles**, ported from the prototype. Only layout that genuinely needs a media
  query lives in `src/app/globals.css`, because a `style` attribute cannot hold one.
- Mobile is the default: one 480px column, no sidebar. `.app-shell` / `.app-sidebar` /
  `.app-content` add the desktop shell at `min-width: 1024px`. The sidebar is *hidden*, not
  unrendered, so nothing has to measure the viewport in JS.
- Typeface is set once on `body` (Inter, via `next/font` in the root layout).
- **Navy `#0C4A6E` is primary; sky blue means success. Green is reserved for WhatsApp.**
- Tailwind v4 is installed and imported, but the app is overwhelmingly inline-styled — follow
  the file you're in.

## Testing

- Vitest, **unit tests only** (`environment: "node"`, `src/**/*.test.ts`). Pure functions in
  `src/lib` and the document templates.
- Anything touching Supabase or the browser is verified against the live app instead —
  **mocking the database would only test the mock.** Don't add DB mocks.
- New money/tax/date logic belongs in `src/lib` with a test beside it. If the logic is
  currently inside a component and you need to test it, lift it into `src/lib` first.
- Tests that must be timezone-independent should build their own `Date` rather than relying
  on the runner's zone.

## Database changes

- Every schema change is a new numbered file in `supabase/migrations/` (`0129_…` next),
  applied **straight to production — there is no staging**. Write them to be safe on live data.
- Open each migration with a comment explaining the problem it solves; the existing files
  are the model (0121 and 0128 are good examples).
- After a schema change, regenerate `src/lib/types/database.ts` from the live schema and
  commit it with the migration.
- Functions that clients call are `SECURITY DEFINER` with a pinned `search_path` (see 0027,
  0091) and explicit grants (0034).
- Keep SQL and its TypeScript mirror in step: `plan_allows` ↔ `tiers.ts`,
  `reserve_doc_numbers`'s prefix whitelist ↔ `DocSeries`, `consume_rate_limit`'s CASE arms ↔
  `RateLimitedRoute`, `ai_monthly_cap()` ↔ `monthlyAiLogs`.

## Environment

`.env.local` (gitignored, must stay that way) — copy `.env.example`:

| Variable | For |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase; RLS is the boundary, so the anon key is safe in the browser |
| `ANTHROPIC_API_KEY` | Quick Log, Loggy, statement parsing — **server-only** |
| `SUPABASE_SERVICE_ROLE_KEY` | PayFast ITN + cron only; bypasses RLS |
| `PAYFAST_*` | Unset = PayFast sandbox with public test credentials, which works end to end |
| `RESEND_API_KEY`, `EMAIL_FROM` | Transactional email; unset = clean no-op |
| `CRON_SECRET` | Guards `/api/cron/*`; unset = the route refuses to run |
| `PUPPETEER_EXECUTABLE_PATH` | Local Chrome for PDF rendering; unset in production |

## Deployment

Push to `main`; Vercel builds and deploys. Env vars are configured in Vercel. Security
headers and a moderate CSP are set in `next.config.ts` — the source lists are tight
(self, Supabase, PayFast for the checkout POST); tightening `unsafe-inline` away needs its
own tested change.

## Conventions checklist for a change

- [ ] Read the surrounding comments; don't contradict a documented decision silently.
- [ ] Arithmetic goes in `src/lib` with a test, not in a component.
- [ ] Use the shared helper (`balanceInclVat`, `inPeriod`, `toLocalIsoDate`, `incomeNet`/
      `expenseNet`, `getNextDocNumber`, `captureWrite`) rather than reimplementing it.
- [ ] If it changes what a user may do, the DB enforces it; the UI only reflects it.
- [ ] SQL mirrors in TypeScript updated in the same commit.
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` all clean.
- [ ] Commit message says what broke and why the fix is right, not just what changed.
