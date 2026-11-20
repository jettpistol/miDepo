# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: the warehouse supervisor or administrator at a desk computer.** They plan and review the day: which receipts and orders are pending, who is picking what, count differences to approve, documents to send to Fierro, users, shelf locations and labels. (Confirmed by the owner, 2026-11-16.)
- **Secondary: operators on the warehouse floor with a phone or a handheld scanner.** They work one task at a time, scanning a shelf code and then a book code: receiving, put-away, picking, packing, returns, counts, moves. Many log in with a company code and a 6-digit PIN.
- Three roles exist: `operario`, `supervisor`, `admin`. Each sees only the menu items its role allows.

## Product Purpose

miDepo is a warehouse tool for small book warehouses that sits on top of Fierro (the Argentine book-trade ERP) instead of replacing it. Fierro keeps the catalogue, customers, orders, remitos and invoices. miDepo owns what Fierro does not track: which shelf every copy is on, and the scan-by-scan work of the warehouse floor. Success is a supervisor who can see the state of the day at a glance and operators who finish each task without mistakes.

## Positioning

A warehouse layer built for one ERP (Fierro) and one trade (books): it speaks Fierro's vocabulary (`pedido`, `remito`, `ubicación`), identifies stock by ISBN and internal code, and hands finished documents back to Fierro.

## Operating Context

- Interface entirely in Spanish, addressing the user as tú. Never voseo. Text lives in the pages.
- Daily flows: Recepción, Reposición (put-away), Picking, Control (optional), Empaque, Devoluciones, Conteos, Mover, Stock. Management: Ubicaciones, Fierro (sync, CSV export, stock reconciliation), Usuarios. Plus Ajustes (personal settings; admins also set how orders are checked) and a user manual at `/ayuda`.
- Barcodes everywhere: ISBN/EAN on books, Code 128 on shelf labels. USB and Bluetooth scanners act as keyboards; phones scan with the camera.
- Printed output on A4: shelf labels (24 per sheet), box labels, packing lists, product labels.
- Installable as a PWA. Needs working wifi; there is no offline mode.

## Capabilities and Constraints

- Next.js App Router, React server components and server actions, Tailwind CSS v4, Drizzle on Postgres (embedded PGlite in development).
- Several companies in one deployment, fully separated.
- Login by password, 6-digit PIN or passkey. Up to five accounts stay logged in per device, with one-tap switching. Profile photos with initials as fallback.
- Each user chooses a light, dark or system theme and one of 14 interface fonts; the choice follows them to every device.
- Suppliers, customers, products and locations are master data. Customers and products come only from Fierro. Suppliers come from Fierro and can be added in miDepo on purpose (confirmed, near-duplicates refused).
- Each user can currently pick their own accent colour. The owner did not list this as a commitment the redesign must keep (see Brand Commitments).
- The Fierro connector is simulated; only demo data exists.

## Brand Commitments

- **Klein blue (`#002FA7`) is miDepo's colour and stays the default.** (Confirmed by the owner, 2026-11-16.)
- **Light and dark themes both stay.** (Confirmed by the owner, 2026-11-16.)
- The name is "miDepo".
- Not commitments: the current warehouse icon and the per-user accent colour. The owner was asked and did not mark either as something to keep.

## Evidence on Hand

- Demo data only: Ovnipress (6,000 titles, 300 customers, 80 pending orders, 6 expected receipts, 800 shelf locations) and Librería Demo. All invented.
- A Spanish user manual in `wiki/`.
- No real customers, usage figures, testimonials or photographs exist. miDepo is not in daily use yet. Future work must not invent any.

## Product Principles

1. The supervisor's overview comes first: the state of the day should be readable from a desk without opening each task.
2. On the floor, one task and one next action per screen; the code to scan is always the most visible thing.
3. Speak Fierro's and the book trade's language; never rename what the trade already names.
4. Numbers and codes are the content: quantities, shelf codes and ISBNs must be easy to read and compare.
5. Nothing on screen claims more than the system knows (simulated Fierro, demo data).
6. The database is the source of truth: users pick existing records; free text never stands in for something that should already exist.
7. Problems are shown before the user commits an action, not after.
