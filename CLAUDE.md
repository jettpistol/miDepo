# Working on miDepo

Read this first, then `README.md` (what the product does and how to run it), `PRODUCT.md` (users and product rules) and `DESIGN.md` (the design system). The user manual is in `wiki/` (Spanish) and is served at `/ayuda`. Why things were decided as they are: `docs/DECISIONS.md`. Next steps and questions for the owner: `docs/ROADMAP.md`. Everything learned about Fierro, with its B2B API schema and the questions to ask them: `docs/fierro/README.md`.

## Next.js 16 is not the Next.js you know

This project runs Next.js 16 (App Router, server components, server actions, Turbopack). APIs and conventions differ from older versions. Before writing framework code, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices. (`next dev` also writes this warning into `AGENTS.md`, which is gitignored.)

## Git

- Push every finished change to `main`, unless the owner says not to for that change. Fast-forward only: if `main` has moved on, merge it into the working branch first, then push.
- Before pushing, run `npm run typecheck`, `npm test` and a production build (`npx next build`); push only when they pass. For changes to screens, also run the browser walkthrough (below).
- Pushing to `main` deploys: the owner's Vercel project rebuilds from `main` (see `docs/HOSTING.md`), and the owner's computer pulls `main` automatically.

## Owner's standing preferences

These came from the owner directly; keep to them unless told otherwise.

- **Density like Jira on desktop.** 14px text, 32px controls, compact tables, free space left free. Phones keep 44px touch targets. Do not enlarge controls to fill a page.
- **Say problems before the click.** Validate as the user types, suggest valid values, disable what cannot work with the reason beside it. The server still validates everything.
- **The database is the source of truth.** Suppliers, customers, products, stock and locations are chosen from what exists, never typed as free text. Creating one is a separate, confirmed action that refuses near-duplicates (see `createSupplier`).
- **No over-explaining.** No subtitles that say what a screen is for, no helper paragraphs for ordinary controls. Keep text that states a fact or a consequence the user could not guess.
- **Dropdowns are the app's own `<Select>`** with a search box that stays open; never a system `<select>`.
- **List screens show their table even when empty** (one `EmptyRow`), with a "+ Nueva" button (`NewButton`) for creating.
- The owner prefers concise replies, with assumptions stated up front, and asks questions before large changes.

## Conventions

- Code, comments, database names and configuration are in English. Interface copy is Spanish (Argentina, voseo).
- Kept Spanish on purpose: page URLs and their query parameters (`/recepcion`, `?prefijo=`), the CSV headers and condition words in files sent to Fierro, and zone codes printed on shelf labels (`RECEPCION`, `DEVOLUCIONES`…).
- Spanish domain words with English names: tejuelo = shelf mark (`ShelfMark`), grapa = floppy (stapled single issue), saldo = clearance, remito = delivery note (Fierro issues those, not miDepo).

## How the code is organised

```
src/db/schema.ts          Every table, with comments. Change it, then `npm run db:generate`.
drizzle/                  Migrations, applied by `npm run db:setup` (and by the Vercel build).
src/lib/flows/*.ts        Warehouse rules, one file per flow. Plain functions taking a Ctx
                          ({ db, companyId, userId }); they throw UserError for anything the
                          user should see. Tested in tests/flows.test.ts.
src/lib/stock.ts          moveStock(): the only place stock quantities change; always logs a movement.
src/lib/lookup.ts         The as-you-type check behind /api/lookup. It must accept and reject
                          exactly what the flow would; tests/lookup.test.ts checks that they agree.
src/lib/action.ts         action(role, fn): wraps a flow as a server action (session, role,
                          error-to-message, revalidate). Each screen's actions.ts uses it.
src/lib/fierro/           The Fierro boundary (FierroConnector) and the simulator. A real
                          connector implements the same interface; nothing else changes.
src/lib/session.ts        Multi-account sessions per device; requireSession() for pages.
src/lib/fonts.ts, color.ts  Per-user font and accent; applied in src/app/layout.tsx.
src/app/(app)/<screen>/   One folder per screen: page.tsx (server), actions.ts, small client parts.
src/app/(app)/layout.tsx  Shell: top bar, sidebar with queue counts, phone bottom bar.
src/app/(print)/          A4 print layouts (labels, packing list).
src/app/(manual)/         The manual site at /ayuda, rendered from wiki/.
src/components/           ScanForm (scan fields + live check), Select, NewButton, ui.tsx
                          (PageHeader, Badge, EmptyRow, ShelfMark, Progress…), Icon.
src/app/globals.css       Design tokens and component classes (btn, field, data-table…).
```

Adding a feature usually means: rule in `src/lib/flows/`, test in `tests/`, action in the screen's `actions.ts`, UI in the screen's `page.tsx`, and, if it is a scan form, the matching check in `src/lib/lookup.ts`.

Migrations that change existing data: generate with `npm run db:generate`, then append the data backfill to the generated SQL (separated by `--> statement-breakpoint`). See `drizzle/0001_suppliers.sql`. Never rewrite a migration that has shipped; the owner's local database and any deployed one have applied it.

## Verifying a change

```bash
npm run typecheck && npm test && npx next build
```

Browser walkthrough of every flow (needs Playwright and the app running on fresh demo data):

```bash
npm run db:reset && npm run dev        # in one terminal
node tests/walkthrough.e2e.js /tmp/shots
```

It must end with `NO CONSOLE ERRORS OR 5xx`. Look at screenshots at desktop (1440px) and phone (390px) width; no screen may scroll sideways on a phone.

Design checks use the Impeccable skill in `.claude/skills/impeccable` (its hook runs after UI edits). `npx impeccable update` updates it.

## Open items

- Who may create suppliers: today any operator (they work the dock). The owner may want supervisors only.
- Stock has two search boxes (top bar, and the page's own live one); the owner was offered hiding the top-bar one there.
- Not yet looked at after the Jira-density overhaul: desktop screens for packing, return detail and count detail (they pass the walkthrough).
- The sidebar runs five count queries per page; not measured on a hosted database.
- See also "What is not done" in `README.md`.
