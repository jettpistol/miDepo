# miDepo

A warehouse tool for small book warehouses, built to sit **on top of [Fierro](https://www.fierro.com.ar)** rather than replace it. Fierro keeps the catalogue, customers, orders, remitos and invoices; miDepo owns what Fierro does not track: which shelf every copy is on, and the scan-by-scan work of the warehouse floor.

The interface is entirely in Spanish, addressing the user as tú (never voseo). The code, comments, database and configuration are in English. Two things stay Spanish on purpose: the page addresses (`/recepcion`, `/reposicion`), because users see them, and the CSV files sent to Fierro, because that is the format Fierro's users load.

> **Status: MVP for testing.** It runs against a **simulated Fierro** with invented data. No real Fierro connection exists yet. See [What is not done](#what-is-not-done).

## Try it in two minutes

You need [Node.js](https://nodejs.org) 22 or newer. Nothing else: with no database configured, miDepo uses an embedded Postgres stored in `./.data`.

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:3000>. The first start creates the tables and loads demo data (about five seconds).

### Demo logins

All demo passwords are `midepo1234`.

| Company | Who | Email | PIN (company code + PIN) |
|---|---|---|---|
| Ovnipress | Administrator | `admin@ovnipress.test` | — |
| Ovnipress | Supervisor | `supervisor@ovnipress.test` | `ovnipress` + `100000` |
| Ovnipress | Operators 1–8 | `operario1@ovnipress.test` … | `ovnipress` + `100001` … `100008` |
| Librería Demo | Administrator | `admin@demo.test` | — |
| Librería Demo | Operator | `operario@demo.test` | `demo` + `200001` |

Ovnipress is seeded with the 118 real titles scraped from its shop (`scripts/scrape-ovnipress.mjs`), 300 customers, 80 pending orders, 6 expected receipts and 800 shelf locations. Librería Demo is a second, smaller company that uses a different location naming scheme; it is there to show that companies are isolated from each other.

### A good first test

1. Log in as the supervisor.
2. **Recepción** → open a receipt, type a few of the listed codes (or scan them), close it.
3. **Reposición** (put-away) → put those titles on a shelf such as `A-01-1`.
4. **Picking** → *Preparar* the first order and follow the stops. The shelf code and book code to scan are shown on screen.
5. **Empaque** → scan the picked books into boxes, close them, finish the order. Print the labels and packing list.
6. **Fierro** → download the CSV, mark it as loaded, then open *Conciliar stock*.
7. **Mi cuenta** → change your accent colour and font (14 to choose from).
8. On a phone (or a narrow browser window), log in with a PIN.

To start again from clean demo data:

```bash
npm run db:reset
```

## What it does

| Area | What is in the MVP |
|---|---|
| Receiving | Count against a receipt announced by Fierro, or start an unannounced one with **+ Nueva**, choosing the supplier from the list. Over, short and unannounced titles are flagged. |
| Put-away | Move received or returned stock to shelves, with a suggestion of where the title already lives. |
| Picking | One picker per order, a route sorted by shelf, validation of shelf and title on every stop, shortages re-routed to another shelf or moved to the FALTANTES zone. |
| Packing | Scan into boxes, real or estimated weight, A4 box labels and packing list. |
| Returns | Start with **+ Nueva** and a customer from the list; grade each copy as *vendible*, *saldo* or *dañado*; each grade goes to its own zone. |
| Cycle counts | Blind counts by shelf range, supervisor review of differences, a recount by another person for large differences (5+ units or 20%+). On approval, misplaced units move between shelves, found units come back from FALTANTES or enter as found, and losses are written off with a cause. |
| Write-offs | **Bajas**: write off what sits in FALTANTES or DANADOS with a cause (theft or loss, damage, entry error, internal use…). Every adjustment is a numbered document with its approver, sent to Fierro as a stock write-off, never as a fake order. Units in and out by cause over 90 days, misplaced units shown apart. |
| Stock | The whole catalogue, 50 titles per page; search by title, author, ISBN, internal code or shelf as you type; per-shelf quantities and movement history. |
| Locations | Four naming templates plus a custom builder; printable Code 128 shelf labels (24 per A4 sheet). |
| Fierro | Sync (catalogue, customers, suppliers, orders, expected receipts), CSV export of every finished document, stock reconciliation between warehouse and Fierro. |
| Data rules | Suppliers, customers, products, stock and locations come from the database and are picked from lists, never typed freely. Scan fields check codes as you type and block what would fail. A new supplier is created only on purpose, with confirmation, and near-duplicates are refused. |
| Accounts | Three roles; login by password, 6-digit PIN, or passkey (fingerprint, face, device PIN). Up to five accounts stay logged in per device, with one-tap switching. Profile photos, with initials as the fallback. |
| Appearance | The Tejuelo design system (see `DESIGN.md`) at the density of a work tool like Jira on desktop: left sidebar with a count beside each queue, compact tables and controls. Phones keep touch-size controls. **Each user picks their own accent colour, light/dark theme and font**; it follows them to every device. |
| Phones | Installable as an app (PWA). Camera barcode scanning; USB and Bluetooth scanners work as keyboards. |
| Companies | Several companies in one deployment, fully separated. |
| Search | The top bar searches everything, in three tabs: **Funciones** (screens, actions, settings, with synonyms and typo tolerance), **Inventario** (titles, shelves, orders, receivings, returns, counts; a scanned code goes first) and **Guías** (the manual, opened at the matching section). Ctrl/⌘+K or `/`; full screen on a phone. |
| Manual | A Spanish user manual in [`wiki/`](wiki/Home.md), also served as its own searchable site at `/ayuda` (search bar, readable without logging in). |

## How it fits with Fierro

```
Fierro ──(catalogue, customers, orders, expected receipts, its stock)──▶ miDepo
Fierro ◀──(packed orders, receipts, returns, counts, write-offs)──────── miDepo
```

Everything that touches Fierro goes through one interface, `FierroConnector` in [`src/lib/fierro/types.ts`](src/lib/fierro/types.ts). Today the only implementation is `SimulatedFierro`. A real connector implements the same six methods and nothing else in the app changes.

What Fierro publicly documents, and how a real connector could use it:

| Fierro channel | Gives | Limit |
|---|---|---|
| B2B API (`b2b.fierro.com.ar`, JWT) | Books, availability, prices, companies | No orders or stock documents |
| "Acceso a datos" | Read-only PostgreSQL views of sales, stock, items | Replicated with a delay; view list not public |
| CSV/spreadsheet import | Fierro says all its documents can be loaded from spreadsheets | Column mapping is set up by Fierro support |
| Inventory count import | `code,quantity,location` CSV | miDepo's count export already uses this format |
| SINLI by email | Orders, remitos, invoices, returns | Email transport |

There is no documented way to push a picked order or a receipt into Fierro in real time. Until Fierro offers one, the bridge is the CSV files on the **Fierro** screen.

## What is not done

- **No real Fierro connection.** The connector is simulated. The CSV layouts for orders, receipts, returns and write-offs are a reasonable guess; only the count export follows a format Fierro documents. They need checking against a real Fierro account.
- **No offline mode.** The warehouse needs working wifi.
- **No new-company screen.** Companies are created with a command (below).
- **Spanish only.** Text lives in the pages, not in a translation file.
- **No password reset by email.** An administrator sets a new password or PIN.
- **Camera scanning and app installation were not tested on physical phones**, only in an emulated mobile browser. Passkeys were tested with a virtual authenticator.
- **Suppliers can be created by any operator.** Restricting it to supervisors is a one-line change if wanted.
- **The demo data ships with known passwords.** Do not load it on a public site that holds real data: set `DEMO_DATA=no`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Prepares the database and starts the app at `localhost:3000`. |
| `npm test` | Runs the workflow tests against an in-memory database. |
| `node tests/walkthrough.e2e.js` | Drives every flow in a real browser (needs Playwright, and `npm run dev` on fresh demo data). |
| `npm run typecheck` | Checks types. |
| `npm run db:setup` | Creates or updates tables; loads demo data if the database is empty. |
| `npm run db:reset` | Deletes everything and starts again. |
| `npm run db:generate` | After editing `src/db/schema.ts`, writes the migration into `drizzle/`. |
| `npm run build:prod` | What the host runs: `db:setup`, then the production build. |
| `npm run company:create -- "Name" code admin@mail.com "password"` | Creates a company and its administrator. |

## Where things are

```
src/db/schema.ts        Every table, with comments
drizzle/                Migrations, applied on setup and on every deploy
src/lib/flows/          The warehouse rules: receiving, picking, packing, returns, counts
src/lib/stock.ts        The only place stock quantities change
src/lib/fierro/         The Fierro boundary and the simulator
src/lib/locations.ts    Location naming templates
src/lib/lookup.ts       Checks a scan form as you type (behind /api/lookup)
src/lib/color.ts        Accent colour and contrast handling
src/app/(app)/          One folder per screen
src/app/(print)/        A4 print layouts
src/components/         Scan form, dropdown (Select), New button, camera reader, navigation
wiki/                   User manual (GitHub wiki format)
tests/                  Workflow tests
docs/HOSTING.md         How to put it online
```

Stack: Next.js, TypeScript, Postgres through Drizzle, Tailwind CSS. Chosen because it is one codebase, one language and one database, with a large pool of developers who know it.

## Publishing the manual as a GitHub wiki

The `wiki/` folder already uses GitHub's wiki layout (`Home.md`, `_Sidebar.md`, `_Footer.md`, one file per page). To publish it:

1. On GitHub, open the repository's **Wiki** tab and create the first page (any content). This creates the wiki's own repository.
2. Copy the files across:

```bash
git clone https://github.com/jettpistol/miDepo.wiki.git
```

```bash
cp wiki/*.md miDepo.wiki/ && cd miDepo.wiki && git add . && git commit -m "Manual de miDepo" && git push
```

## For developers and agents

`CLAUDE.md` has the conventions, the code map, how to verify a change, the owner's standing preferences and the open items.

## Hosting

See [docs/HOSTING.md](docs/HOSTING.md).
