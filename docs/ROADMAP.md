# Roadmap and open questions

Where the project stands beyond what the README's "What is not done" lists. Last updated 2026-11-20.

## Suggested next steps, in order

1. **Get Fierro access or a sandbox.** Whether Fierro can accept documents or stock movements from outside, or can only be read, decides the whole integration. The questions to ask are in [fierro/README.md](fierro/README.md#questions-for-fierro).
2. **Try it with Ovnipress staff on real phones and a real scanner**, using demo data, before building more. Watch picking and returns in particular. Camera scanning, installing the app, taking a photo with the phone, printing on a real printer and passkeys on a real domain have never been tested on real hardware.
3. **Deploy** following [HOSTING.md](HOSTING.md) with demo data switched off, and create Ovnipress with `npm run company:create`. The hosting guide was written from general knowledge of Vercel and Neon and has not been followed end to end.
4. **Audit company isolation.** Companies share one database and every query must filter by company. A few paths are covered by tests; there has been no systematic audit of every screen and action.
5. **A real Fierro connector** behind `FierroConnector`. Start read-only (the B2B API for catalogue and availability, or the "acceso a datos" views for stock and sales) and keep CSV for write-back. The CSV layouts for orders, receipts, returns and write-offs are guesses; only the count export follows a format Fierro documents.
6. **A thin standalone mode** for warehouses without Fierro: CSV import of catalogue and orders, plus a printable delivery note. Designed for, not built.
7. **Comments on more documents** (D56). The table and component are generic; each screen is a few lines. Most useful first: receivings (what the supplier sent wrong, a damaged carton), returns (why the customer returned it), count locations (why a location differs, read before approving), adjustments (the story behind a write-off), Salidas (what was agreed with the fair or bookstore) and articles ("comes shrink-wrapped"). Waiting for the owner to choose.
8. Smaller: a screen to create companies, password reset, a translation file instead of Spanish text inside the pages, SINLI file import and export, tolerance for short wifi drops, continuous integration and a linter.

## Gaps review against the market research (2026-11-20)

Built from that review: Fierro order changes and cancellations (D40), urgent orders (D41), opening stock load (D46), Mover → Toda la ubicación (D50), damaged on arrival and receiving labels (D53), Despacho (D54), Salidas for fairs and consignment (D55). Batch picking was built separately (D43).

Still missing, roughly in order of value:

1. **Several barcodes per article and cartons.** One barcode per product today: no aliases for reprints or imported editions that share an ISBN, no ITF-14 carton code that counts as N units.
2. **Returns linked to the order or the consignment they come from.** A return names only the customer.
3. **Short shipments (saldo pendiente).** An order short-picked ships short and miDepo keeps no pending balance; with Fierro, Fierro may already track it (to ask).
4. **Replenishment from reserve.** No pick face vs reserve, no min/max per location, no alert when a pick shelf runs low.
5. **Floor reports.** Picking time per order, mispicks caught, orders per person: the baseline the research's rollout plan measures against.
6. **Count scheduling.** Counts are started by hand; nothing proposes which shelves to count next.
7. **Retries after a wifi drop.** Not checked whether a scan resent by the browser after a drop can be recorded twice; idempotency keys would rule it out.
8. **Standalone mode** (D39): catalogue, customers, orders, remitos and consignment without Fierro.

## Hardware plan (labels, printers, scanners)

Researched in [hardware/README.md](hardware/README.md), which numbers the owner's six original items as phases; below is the order of work. Each step waits for the owner's go-ahead.

1. **Research.** Done (2026-11-20).
2. **Labels prepared for one click, through the print dialog.** A label model in millimetres, every standard size, the label catalogue (item label at receiving, box label at packing, location and totem labels, return condition sticker, test label), a queue of prepared labels with reprint, a test label with a ruler, demo printers and scanners behind an admin test mode, the device panel, and the Spanish manual pages (supported models, setup, troubleshooting). Also the scan clean-up: keyboard-layout fixes, add-ons dropped, UPC-A and ISBN-10 accepted.
3. **Direct printing from Chrome:** ZPL and TSPL over WebUSB, Web Serial and Web Bluetooth. Android first; on Windows only COM-port and Bluetooth printers, plus an optional driver swap a supervisor does.
4. **Printers per computer:** a computer identity, a default printer per computer and label type, a company printer list for supervisors and admins.
5. **Windows helper** for wifi, network and driver-installed USB printers. Design only, in the research; not to be built until the owner says so.

## Questions only the owner can answer

- Comments (D56): which documents take them next? Are 5 minutes to edit and 2,000 characters right? Should anyone be told when a comment is left (a count in the sidebar, mentions)?

- Dropping a picking order (D36) keeps its "not here" reports in FALTANTES and asks the picker to use "Sí estaba" first if they were wrong. Should dropping undo them too? Should operators be able to drop someone else's order, or only supervisors (today)?
- Does Ovnipress really use Fierro's orders and "cajas y despachos" screens, or only invoice? (Assumed orders yes, boxes no.)
- Is there a contact at Fierro, and would they open write access?
- Real warehouse facts: number of titles, orders per day, staff, whether shelves are labelled, which printers exist. (Demo data assumes 6,000 titles, 80 orders and 8 operators.)
- Should switching accounts on a shared device ask for the PIN or password? Today it does not.
- Salidas (D55): is what sells at a fair or a consignment bookstore invoiced in Fierro (so miDepo sends nothing), and should losses at a stand be told apart from sales at closing?
- Despacho (D54): should loading a box require the remito number? Today only the carrier is required. Is ZPL needed, or does printing the 10 × 15 PDF to the Zebra driver do?
- Opening stock (D46): should a second load be refused once the warehouse is live, or is loading in parts fine?
- Notifications (D57, D58): is 17:00 the right closing hour for the end-of-day notice, and should it skip weekends? Is 2 hours without a pick the right moment to call an order stalled? Both are constants in `src/lib/notifications.ts`; a setting in Organización is easy if they differ.
- Stock losses (D19 to D22 in [DECISIONS.md](DECISIONS.md)): should count losses go through FALTANTES first instead of being written off at approval? Are the recount thresholds (5 units or 20%) right for Ovnipress? Should large write-offs need an admin? Today any supervisor approves.
