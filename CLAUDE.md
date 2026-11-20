# Working on miDepo

Read this first, then `README.md` (what the product does and how to run it), `PRODUCT.md` (users and product rules) and `DESIGN.md` (the design system). The user manual is in `wiki/` (Spanish) and is served at `/ayuda`. Why things were decided as they are: `docs/DECISIONS.md`. Next steps and questions for the owner: `docs/ROADMAP.md`. Everything learned about Fierro, with its B2B API schema and the questions to ask them: `docs/fierro/README.md`. Every error message and its code: `docs/ERRORS.md`.

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
- **Neutral, professional, as few words as possible; never narrative.** A value under a column says only what the header does not: "Fierro" under Origen, not "De Fierro"; "Sin pedidos", not "Este cliente no tiene pedidos"; "Pendiente en Fierro", not "Falta cargarla en Fierro". No story-telling notices ("Cuando alguien termine…, aparece aquí"), no instructions the screen already makes obvious.
- **Every text is cut to the fewest words before it ships** (owner, repeatedly). Professional and neutral. Before adding or changing any copy (labels, headings, buttons, messages, error texts, empty states, the manual), reread it and remove:
  - connectors and fillers at the start: "Y 3 más" → "3 más"; "Ahora es de Ana" → "Asignado a Ana"; no "Pero", "Además", "Entonces", "Por favor", "Recuerda que";
  - what the screen already shows: the heading, the column, the document on screen, the icon ("Seguir con PED-1" in a card titled Pedido needs no "este pedido");
  - context the user can work out alone, and explanations of ordinary controls;
  - speech: labels are nouns or short facts ("Sin movimientos", not "No hubo movimientos en estos 7 días").
  - confirms for actions that can be undone, and success messages that repeat what the screen now shows ("Guardado." is enough).
  If a word can go without losing meaning, it goes. `tests/copy.test.ts` refuses the openers and fillers; the rest is on you. This review is required for every text added or changed, by anyone, in any session: see "Copy review" under "Verifying a change".
- **Two options are a switch, not a dropdown** (`<Toggle>` in `src/components/Toggle.tsx`), with a short name and, when the name alone is not enough, an `InfoHint` (owner's example: "Redundancia", hint "Prohíbe que el armador controle su propio pedido"). Dropdowns are for three or more.
- **Options are one to three words.** Dropdown options, tabs and toggles carry no `detail` line unless it states a fact the label cannot; their text must fit the control without truncating at 1440px and 390px. A section heading needs no subtitle ("Para toda la empresa").
- **No over-explaining.** No subtitles that say what a screen is for, no helper paragraphs for ordinary controls. Keep text that states a fact or a consequence the user could not guess.
- **Notes go in hints, not on the screen.** Why a button is disabled (`reason` on `ActionButton`/`ActionForm`, or `DisabledReason`) and side notes (`InfoHint`, an ⓘ beside a heading or option) open on hover, focus or tap (`src/components/Hint.tsx`). Status notices (`Notice`) and facts the user needs to act stay visible.
- **Nothing grows without limit on an overview.** Inicio, banners, cards and summaries show a fixed number of rows (Inicio: one "Seguir con…" banner, 5 of your tasks, 8 people) and sum up the rest in one line that links to the full list. Only list screens, which page, show everything. A busy day must never push the overview off the screen.
- **Dropdowns are the app's own `<Select>`** with a search box that stays open; never a system `<select>`.
- **List screens show their table even when empty** (one `EmptyRow`), with a "+ Nueva" button (`NewButton`) for creating.
- **Article names are shown in capitals** everywhere (lists, article page, scan feedback, messages, printouts) through `articleName()` in `src/lib/article.ts`. The stored name keeps its case, and the CSV files for Fierro use it as stored.
- **Tú, never voseo**, in the app, its messages and the manual.
- **The app never speaks as "I".** Messages are impersonal: "No se encontró ese pedido", "No se pudo leer esa imagen", not "No encuentro…", "No pude…". `tests/copy.test.ts` refuses it.
- The owner prefers concise replies, with assumptions stated up front, and asks questions before large changes.

## Conventions

- Code, comments, database names and configuration are in English. Interface copy is Spanish, addressing the user as tú ("Escanea", "Puedes"). Never voseo ("Escaneá", "Podés", "vos"); `tests/copy.test.ts` refuses it.
- Kept Spanish on purpose: page URLs and their query parameters (`/recepcion`, `/reposicion`, `?prefijo=`), the CSV headers and condition words in files sent to Fierro, and zone codes printed on shelf labels (`RECEPCION`, `DEVOLUCIONES`…).
- Spanish domain words with English names: tejuelo = shelf mark (`ShelfMark`), grapa = floppy (stapled single issue), saldo = clearance, remito = delivery note (Fierro issues those, not miDepo).

## How the code is organised

```
src/db/schema.ts          Every table, with comments. Change it, then `npm run db:generate`.
drizzle/                  Migrations, applied by `npm run db:setup` (and by the Vercel build).
src/lib/flows/*.ts        Warehouse rules, one file per flow. Plain functions taking a Ctx
                          ({ db, companyId, userId }); they throw UserError for anything the
                          user should see. Tested in tests/flows.test.ts.
src/lib/stock.ts          moveStock(): the only place stock quantities change; always logs a movement.
src/lib/flows/adjustments.ts  Stock changes with nobody on the other side (write-offs, found stock):
                          every one is an adjustment document with a cause. Never a fake order.
src/lib/lists.ts          The register lists (suppliers, customers, orders, movements, documents by
                          supplier or customer): read-only, paged. Tested in tests/lists.test.ts.
src/lib/lookup.ts         The as-you-type check behind /api/lookup. It must accept and reject
                          exactly what the flow would; tests/lookup.test.ts checks that they agree.
src/lib/action.ts         action(role, fn): wraps a flow as a server action (session, role,
                          error-to-message, revalidate). Each screen's actions.ts uses it.
src/lib/fierro/           The Fierro boundary (FierroConnector) and the simulator. A real
                          connector implements the same interface; nothing else changes.
src/lib/covers.ts         List-size cover thumbnails, made once at Fierro sync (never resized per request).
src/lib/session.ts        Multi-account sessions per device; requireSession() for pages.
src/lib/fonts.ts, color.ts  Per-user font and accent; applied in src/app/layout.tsx.
src/app/(app)/<screen>/   One folder per screen: page.tsx (server), actions.ts, small client parts.
src/app/(app)/layout.tsx  Shell: top bar, sidebar with queue counts, phone bottom bar.
src/app/(print)/          A4 print layouts (labels, packing list).
src/app/(manual)/         The manual site at /ayuda, rendered from wiki/; admins edit pages at
                          /ayuda/editar/<page> (stored per company in wiki_edits, see src/lib/wiki.ts).
src/lib/markdown.ts       Manual Markdown → HTML, server and editor preview alike; escapes raw HTML.
src/components/           ScanForm (scan fields + live check), Select, NewButton, RowMenu (⋯ row options), Hint, ProductCards (cover cards +
                          view switch), ListTools (Pager, FilterTabs) and LiveSearch for paged lists, ui.tsx
                          (PageHeader, Badge, EmptyRow, ShelfMark, Progress…), Icon, Hotkeys.
src/lib/search/           The top search (src/components/GlobalSearch.tsx, /api/search): functions.ts lists
                          screens, actions and settings with their synonyms; inventory.ts finds articles,
                          locations, suppliers, customers and documents; the manual is searched by section in src/lib/wiki.ts.
                          A new screen, action or setting gets an entry in functions.ts.
src/lib/hotkeys.ts        Keyboard shortcuts: Alt+digit screens, F-key meanings. Mark a screen's
                          buttons with hotkey("primary") etc.; F1 lists what is marked.
src/app/globals.css       Design tokens and component classes (btn, field, data-table…).
```

Adding a feature usually means: rule in `src/lib/flows/`, test in `tests/`, action in the screen's `actions.ts`, UI in the screen's `page.tsx` with its buttons marked for the keyboard (`hotkey()`, same F-key for the same kind of action), and, if it is a scan form, the matching check in `src/lib/lookup.ts`.

## Error codes

Every error message the user can see has a code (`RCV-02`), shown after the message (`Esta recepción ya está cerrada. · RCV-02`) and listed in `docs/ERRORS.md`. Keep that file current in the same commit as the code change:

- New message: `throw new UserError("AREA-NN", "…")` with the next free number in its area (browser-side or API messages use `withCode(message, code)`; scripts write `[AREA-NN]` at the start). Add its row to `docs/ERRORS.md`: code, message, file · function, and when it happens.
- Changed wording, same meaning: keep the code, update the row. Moved to another file: update the row's file.
- Removed message: move its row to "Retired codes". Never reuse a number.
- New area: add it to the area table in `docs/ERRORS.md` and to `AREAS` in `tests/errors.test.ts`.
- As-you-type warnings (`src/lib/lookup.ts`) get no code.
- Every error message is in Spanish (tú, never voseo), including script and configuration errors only a developer sees. Codes and the rest of `docs/ERRORS.md` stay in English.

`tests/errors.test.ts` (which scans `src/` and `scripts/`) fails if a code is undocumented, documented in the wrong file, used in two files, retired but back, or if a `UserError` or a thrown `Error` has no code.

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

It must end with `NO CONSOLE ERRORS OR 5xx`.

**Copy review (required before every push that adds or changes interface text or the manual).** Read every user-visible string in the added lines:

```bash
git diff origin/main -- src wiki | grep '^+' | grep -v '^+++'
```

Cut each one against the rules in "Owner's standing preferences" (fewest words, neutral, nothing the screen or the user already knows), then check the screenshots for text that wraps, truncates or overflows its box. Error messages change in `docs/ERRORS.md` in the same commit. Look at screenshots at desktop (1440px) and phone (390px) width; no screen may scroll sideways on a phone.

Design checks use the Impeccable skill in `.claude/skills/impeccable` (its hook runs after UI edits). `npx impeccable update` updates it.

## Open items

- Assignment does not lock work (D35); the owner may want an assigned order to be off-limits to others. List screens (Picking, Recepción…) do not show the assignee yet, only detail screens and Inicio.
- Not yet looked at after the Jira-density overhaul: desktop screens for packing, return detail and count detail (they pass the walkthrough).
- The sidebar runs five count queries per page (six with Control on); not measured on a hosted database.
- See also "What is not done" in `README.md`.
