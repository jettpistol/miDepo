# Status

Last updated 2026-11-18. `main` and `claude/practical-hawking-djbfe9` were identical at commit `c3e99a6`; check `git log` for anything newer.

## What exists

Everything in the README table works against a **simulated Fierro**: receiving, put-away, picking (with shortage re-routing), packing and A4 labels, returns grading, blind cycle counts, moves, stock search and history, location templates and printable shelf labels, CSV hand-off to Fierro plus reconciliation, three roles, password / PIN / passkey login, up to five accounts per device with one-tap switching, profile photos, per-user accent colour and theme, installable web app, camera and USB scanning, several companies in one database, and a Spanish manual served at `/ayuda`.

## What was verified, and how

| Claim | Evidence |
|---|---|
| Warehouse rules | `npm test`: 8 workflow tests on an in-memory database (full receive → put-away → pick → pack → dispatch cycle with Fierro and warehouse stock ending equal, shortage re-routing, returns, counts, company isolation, location templates). |
| Every screen and flow | `tests/recorrido.e2e.js`: real browser, desktop and Pixel 7 emulation, on the embedded database and on real Postgres 16 with the production build. |
| Accounts, photos, passkeys | `tests/cuentas.e2e.js`; passkeys and PIN lockout were driven with a virtual authenticator. |
| Manual site and search | `tests/manual.e2e.js`. |
| Production build | `npx next build` passes. |

Not verified: a real phone (camera scanning, installing the app, taking a photo with the camera), a real Fierro of any kind, an actual Vercel + Neon deployment (the hosting guide is written from general knowledge of those services), passkeys on a real domain, printing on a real printer, large-scale performance.

## How to verify a change

```bash
npm run typecheck && npm test && npx next build
```

Browser scripts need Playwright, which is not a dependency of the project:

```bash
npm i -D playwright && npx playwright install chromium
```

```bash
npm run db:reset && npm run dev -- -p 3100
```

In a second terminal, run the three scripts in order (the first one consumes demo orders, so reset between full runs). Each prints its steps and ends with a clear pass or `FALLÓ`:

```bash
BASE_URL=http://localhost:3100 node tests/recorrido.e2e.js
```

## Known gaps in the product

- **No real Fierro connector.** CSV layouts for orders, receipts and returns are guesses; only the count export follows a format Fierro documents (`code,quantity,location`, no header). See [fierro/README.md](fierro/README.md).
- No offline mode. No password reset by email (an admin sets a new one). No screen to create a company (use `npm run empresa:crear`). No translation file: Spanish is in the pages.
- Picking ignores consignment vs firm; orders cannot be edited or partially cancelled in miDepo (they come from Fierro as they are). Counts are limited to 300 locations each.
- Account switching needs no PIN or password by design (see decisions); anyone holding a shared device can act as any open account.
- A PIN login session lasts 14 hours; other logins 30 days. Passkeys need `APP_URL` to match the address in the browser.
- No CI, no linter configured (`next lint` no longer exists in this Next version), no error monitoring, no backups beyond what the database host provides.
- The multi-company isolation rule ("every query filters by `empresaId`") has not been audited systematically.
- Once, on a long-lived local database, PIN logins failed until `npm run db:reset`; the cause was not identified. PINs are hashed with `SECRETO`, so changing `SECRETO` invalidates all of them.

## State of the repository and hosting

- The GitHub default branch may still be the working branch rather than `main`; the owner was asked to change it (Vercel deploys the default branch).
- The manual in `wiki/` has **not** been published to the GitHub wiki; steps are in the README.
- Nothing is deployed. The domain exists but nothing points at it.

## Suggested next steps, in order

1. **Get Fierro access or a sandbox.** Everything else about integration depends on whether Fierro can accept documents in or only be read. Questions to ask are in [fierro/README.md](fierro/README.md#questions-for-fierro).
2. **Run it with Ovnipress staff on real phones and a real scanner**, using demo data, before building more. Watch picking and returns in particular.
3. **Deploy** following [HOSTING.md](HOSTING.md) with `DATOS_DEMO=no` and create Ovnipress with `npm run empresa:crear`.
4. **Audit tenant isolation** (every query, every action) and add tests for the screens not covered.
5. **Real connector** behind `ConectorFierro`: start read-only (B2B API for catalogue and availability, or the "acceso a datos" views for stock and sales), keep CSV for write-back.
6. **Thin standalone mode** for warehouses without Fierro: CSV import of catalogue and orders, printable remito. Designed for, not built.
7. Smaller: new-company screen, password reset flow, translation file, SINLI file import/export, offline tolerance for brief wifi drops, CI.

## Questions only the owner can answer

- Does Ovnipress really use Fierro's pedidos and "cajas y despachos" screens, or only invoice? (Assumed yes to pedidos, no to cajas.)
- Is there a contact at Fierro, and would they open write access?
- Real warehouse facts: SKU count, orders per day, number of staff, whether shelves are labelled, which printers exist. (Demo data assumes double the first estimate: 6,000 titles, 80 orders, 8 operators.)
- Should switching accounts ask for the PIN or password? Currently it does not.
