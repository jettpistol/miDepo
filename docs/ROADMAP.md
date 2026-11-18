# Roadmap and open questions

Where the project stands beyond what the README's "What is not done" lists. Last updated 2026-11-18.

## Suggested next steps, in order

1. **Get Fierro access or a sandbox.** Whether Fierro can accept documents or stock movements from outside, or can only be read, decides the whole integration. The questions to ask are in [fierro/README.md](fierro/README.md#questions-for-fierro).
2. **Try it with Ovnipress staff on real phones and a real scanner**, using demo data, before building more. Watch picking and returns in particular. Camera scanning, installing the app, taking a photo with the phone, printing on a real printer and passkeys on a real domain have never been tested on real hardware.
3. **Deploy** following [HOSTING.md](HOSTING.md) with demo data switched off, and create Ovnipress with `npm run company:create`. The hosting guide was written from general knowledge of Vercel and Neon and has not been followed end to end.
4. **Audit company isolation.** Companies share one database and every query must filter by company. A few paths are covered by tests; there has been no systematic audit of every screen and action.
5. **A real Fierro connector** behind `FierroConnector`. Start read-only (the B2B API for catalogue and availability, or the "acceso a datos" views for stock and sales) and keep CSV for write-back. The CSV layouts for orders, receipts, returns and write-offs are guesses; only the count export follows a format Fierro documents.
6. **A thin standalone mode** for warehouses without Fierro: CSV import of catalogue and orders, plus a printable delivery note. Designed for, not built.
7. Smaller: a screen to create companies, password reset, a translation file instead of Spanish text inside the pages, SINLI file import and export, tolerance for short wifi drops, continuous integration and a linter.

## Questions only the owner can answer

- Does Ovnipress really use Fierro's orders and "cajas y despachos" screens, or only invoice? (Assumed orders yes, boxes no.)
- Is there a contact at Fierro, and would they open write access?
- Real warehouse facts: number of titles, orders per day, staff, whether shelves are labelled, which printers exist. (Demo data assumes 6,000 titles, 80 orders and 8 operators.)
- Should switching accounts on a shared device ask for the PIN or password? Today it does not.
- Stock losses (D19 to D22 in [DECISIONS.md](DECISIONS.md)): should count losses go through FALTANTES first instead of being written off at approval? Are the recount thresholds (5 units or 20%) right for Ovnipress? Should large write-offs need an admin? Today any supervisor approves.
