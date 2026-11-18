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
