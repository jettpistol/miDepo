# Decisions

What was decided, by whom, and why. Newest context last. "Owner" is the person commissioning miDepo; "assumed" means nobody confirmed it.

## Product

**D1. miDepo is a layer on top of Fierro, not a replacement.** Owner asked first for a standalone WMS and then for one that switches to "layer mode" if Fierro is in use. Recommendation, accepted: design for both, build layer mode first. A standalone mode is as much work again (catalogue, customers, orders, remitos, consignment) and would compete with Fierro; "works with the Fierro you already have" is the easier sale to Fierro's roughly 300 clients. The boundary is `FierroConnector`; a standalone source of orders and catalogue would implement the same interface.

**D2. Small warehouses only.** No 3PL, wave planning, slotting, lots/serials/expiry, labour metrics, carrier integrations or billing.

**D3. Fierro stays master for what it owns.** Catalogue, customers, orders, remitos, invoices, consignment accounts. miDepo reads them and never edits them. miDepo owns shelf locations, floor tasks and the physical condition of returns.

**D4. A packed order leaves warehouse stock only when marked as loaded in Fierro.** Until then its books sit in the "Pedidos preparados" zone. This keeps the warehouse and Fierro stock figures comparable and makes reconciliation meaningful.

**D5. The MVP talks to a simulated Fierro and hands documents over as CSV.** Owner has no Fierro access. No documented way to push orders or receipts into Fierro in real time was found.

**D6. Returns are graded sellable, clearance or damaged** (shown in Spanish in the interface), each going to its own zone; only sellable copies go back to a shelf (owner accepted the default).

**D7. Counts are blind and by shelf range**, approved by a supervisor, adjusting only shelves marked as counted.

## Answers the owner gave to the 15 scoping questions

1. Uses Fierro, unknown how: assume for everything. 2. Fake Fierro plus CSV exports. 3. All five flows. 4. miDepo stops at packing and packing list; remito and invoice stay in Fierro. 5. Several companies in one system from day one. 6. USB scanners, a mobile app and a browser. 7. Wifi is reliable (so no offline mode). 8. Shelves are not named: offer sample naming sets each client can pick or adapt. 9. Volumes: double the suggested (6,000 titles, 80 orders, 8 operators). 10. Items without ISBN exist (single issues, variants, packs get an internal code). 11. Return grading as proposed. 12. Plain A4 printer. 13. Three roles; email and password (or passkey only) on desktop, short PIN or biometrics on phones. 14. Colour customisation **per user**, changing the whole site. 15. Spanish UI, English for development; "easiest to maintain" stack; owner has a domain and no hosting experience, so a guide was requested; also a user wiki in GitHub-wiki style.

## Follow-up requests

**D8. Several accounts logged in per device, switching without re-authenticating** (up to five). Owner request. The convenience costs security on shared devices; mitigated by always showing the active person's photo or initials and a "sign out of all" action. Assumed the owner is happy with that trade; flagged as an open question in [ROADMAP.md](ROADMAP.md).

**D9. Profile photos** are cropped square and shrunk to 256 px JPEG in the browser, stored in the database (table `user_photos`, separate from `users` so it is not loaded on every query), served only to users of the same company. Chosen so no file storage service is needed.

**D10. The manual is its own site** at `/ayuda` (black header, search, index), readable without logging in, built from the `wiki/` folder so the same files can be published as a real GitHub wiki.

**D11. "Mi cuenta" opens from the user's name and photo**, not from the main menu.

## Technical

**D12. Stack: Next.js (App Router) + TypeScript + Postgres through Drizzle + Tailwind v4.** Chosen for maintainability: one language, one codebase, one database, many developers who know it.

**D13. Embedded Postgres (PGlite) when `DATABASE_URL` is unset.** Lets the owner run it with `npm install` and nothing else. Production uses real Postgres. Both were tested.

**D14. Design:** Klein blue `#002FA7` by default. The accent is a per-user setting; light/dark/system theme is per user too. Text placed on the accent, and the accent used as text, are recomputed for contrast, so any colour is legible (`src/lib/color.ts`).

**D15. Scanning:** USB and Bluetooth scanners behave as keyboards (type code, Enter advances the field). Phones use the camera through the browser `BarcodeDetector`, falling back to a bundled ZXing WebAssembly reader (`public/zxing_reader.wasm`) where the browser has none (iPhone).

**D16. The app is an installable web app (PWA), not a native app.** Cheaper to maintain; camera needs HTTPS.

**D17. Login protections:** passwords with scrypt; PINs are 6 digits hashed with an HMAC keyed by `SECRET` so a PIN identifies someone within a company; after 6 failures the key is blocked 5 minutes; session tokens are random and stored hashed.

**D18. Hosting guide targets Vercel + Neon.** Fewest decisions for a first-time host. Vercel's free tier is non-commercial.

## Stock losses

Owner's experience: in a previous warehouse the system only let stock change through a sale or a purchase, so losses were booked through a ghost customer or orders with negative quantities. That corrupts sales figures, hides why stock disappears and leaves no real audit trail. These decisions make the honest path the easy one.

**D19. A stock change with nobody on the other side is an adjustment document** (`adjustments`, `adjustment_lines`, numbered `AJ-00001`): product, location, signed quantity, a cause per line (Diferencia de conteo, Robo o extravío, Rotura o daño, Error de carga, Uso interno o muestra, Apareció) and the supervisor who approved it. It is exported to Fierro as its own document ("Baja de stock"), never as an order. Any supervisor may approve (owner's answer). The CSV layout `ajuste,codigo,titulo,ubicacion,cantidad,motivo` is a guess, like the order, receipt and return layouts.

**D20. Counts separate misplaced, found and lost units, title by title.** Short on one counted shelf and over on another is a misplacement: the units move (`count_relocation`), no adjustment. Units still over come back from FALTANTES first, then enter as "Apareció". Units still short are written off with the cause the supervisor picks at approval (default "Diferencia de conteo"). The count tells Fierro only the change in total stock (its adjustment lines). Owner did not answer this question; the recommended option was taken.

**D21. Large count differences need a recount by someone else before approval:** 5 units or more, or 20% or more of the system quantity (from 2 units). Owner asked for no money threshold because of inflation; units and a percentage instead. The recount clears what was counted on that shelf (the count stays blind), and the first counter cannot do it. Once recounted, the difference can be approved even if it persists.

**D22. A picking shortage moves the units to a FALTANTES zone, not out of stock.** They are still owned and still in Fierro's figures, so reconciliation shows no difference. They come back with Mover (`found`) or when a count finds them, and a supervisor can write them off at any time from **Bajas** (owner chose no waiting period). Damaged stock (DANADOS) is written off from the same screen. Nothing can be moved into FALTANTES by hand. The **Bajas** screen also shows units in and out by cause over 90 days, misplaced units separately, and every adjustment line with its approver.

**D23. "Guardar" is now "Reposición"** (owner, 2026-11-18). URL `/reposicion`; `/guardar` and the manual's old page redirect (`next.config.ts`). In code it is still put-away (`context="putaway"`, icon `putaway`).

**D24. Keyboard shortcuts for desktop keyboards** (owner, 2026-11-18). Only desktop keyboards were asked for, not handheld terminals. Alt + digit opens a daily-work screen. F-keys run actions on a screen, with the same meaning everywhere: F2 main button, F3 back, F4 suggested quantity, F6 option, F7 suggested shelf, F8 other action, F9 finish the task, F10 new, Esc clear the scan. F1 lists them. The owner chose that list over badges on buttons, which keeps the density. A screen marks elements with `hotkey()` from `src/lib/hotkeys.ts`; `src/components/Hotkeys.tsx` presses them and builds the F1 list from the page, so the list cannot go stale. A key is only taken from the browser where the screen uses it; F5, F11 and F12 never are. Assumed: Alt + digit does not clash with how the warehouse's browsers switch tabs (on Linux, Chrome and Firefox use Alt + digit for that; the page takes it first).

## Home page and assignment

**D25. The home page is an overview of your own work, not another list** (owner, 2026-11-20, comparing it with a Jira project summary). Headline tiles per role, "Asignado a ti", an order pipeline, units per day for 7 days, stock waiting in zones, and for supervisors a team table. Charts are plain HTML/CSS (no chart library); the three series colours are a validated categorical set (`--series-1..3` in `globals.css`).

**D26. Supervisors assign work to a person** (owner chose real assignment over inferring it from activity). `assigned_to` on orders, receivings, returns and counts; put-away has no document, so its assignment is on the RECEPCION and DEVOLUCIONES zone locations. An assignment points, it does not lock: anyone can still work on it, because floor work moves between people. Not asked; assumed, and easy to change in `src/lib/flows/assignments.ts` if the owner wants it to lock. "Yours" on the home page = assigned to you, or the order you are picking.

