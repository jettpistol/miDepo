# What is known about Fierro

Research done 2026-11-16 from Fierro's public site and help centre. **Page contents were read through a summarising tool, not verbatim**, so exact wording, column orders and field names below are only as reliable as that. The one exception is [`b2b-openapi.yaml`](b2b-openapi.yaml), the full OpenAPI 3.0.3 schema (v0.1.17, 4,227 lines) downloaded from `https://b2b.fierro.com.ar/api/schema/`; it is Fierro's data, kept as a reference and never executed.

Nothing here was tested against a real Fierro account. **No Fierro access exists yet.**

## Who and what

[Fierro](https://www.fierro.com.ar) is a cloud management system for bookstores, publishers and distributors, built in Argentina (Parque Patricios, CABA), about 17 years old, ISO 9001 certified, with 300+ clients and 3,200+ connected workstations in about nine Latin American countries (2022/2023 presentation; the site now lists ten). Products: **Fierro** (bookstores, publishers, distributors), **Fierro Go** (online entry plan), **Fierro B2B** (network connecting bookstores and suppliers, 130+ companies), **Cruz** (built-in AI assistant). Extra modules: accounting, royalties, press, subscriptions, trade fair, used books, loyalty, instalments. Pricing is not public. Contact: `info@fierro.com.ar`, support tickets at `soporte.fierro.com.ar`, phone (54 11) 7079-0656.

## Integration channels

| Channel | What it gives | What it cannot do |
|---|---|---|
| **B2B REST API** (`b2b.fierro.com.ar`) | Books, availabilities (stock per branch, firm or consignment), prices, companies. Includes write endpoints (see below). | No orders, remitos, customers or stock documents. |
| **"Acceso a datos"** (FAQ: `soporte.fierro.com.ar/portal/es/kb/articles/preguntas-frecuentes-fierro-acceso-a-datos`) | Standard PostgreSQL connection to **read-only views** (sales, stock, items); `SELECT` only; credentials issued on activation. | Replicated with a delay (not real time). The list of views is in a separate document that was not seen. Pricing unknown. |
| **Spreadsheets** | Fierro states that every document can be loaded from a spreadsheet and every search result exported; prices can be loaded for a future date. Migration from spreadsheet covers catalogue, customers, suppliers, stock, current accounts and consignments. | Column layouts are configured by Fierro support and were not seen (except inventory counts, below). |
| **Inventory count import** | CSV `code,quantity,location` per row, no header; one code type per file (ISBN, barcode or internal code); the location must already exist; conflicts when a code is unknown or matches several books. | Setting up the column mapping needs Fierro support (`soporte@fierro.com.ar`). |
| **SINLI** | Standard book-trade documents exchanged by email: firm and consignment orders, cancellation orders, delivery notes (remitos), invoices, cancellations, catalogue. Fierro has an inbox and outbox for the SINLI address. | Email transport only. |
| **Stock update by FTP** | Exists as a help category (`integraciones/actualización-de-stock-por-ftp`). | The article was not readable; format, direction and frequency unknown. |
| Marketplace and shop integrations | Mercado Libre (catalogue and real-time stock out; sales come back as "web reservations"), Tiendanube, Shopify, WooCommerce, Publica.la, Nielsen, Livriz, DeLibros, Metabooks. | Mechanism of each (API, file, webhook) is not documented publicly. |

### B2B API in detail

- Production `https://b2b.fierro.com.ar`, staging `https://b2b-staging.fierro.com.ar` (same behaviour, different domain). Interactive docs at `/api/schema/docs/`, schema at `/api/schema/`.
- Access is for "business partners" and needs a user **created by Fierro support**.
- Auth: `POST /api/token/` returns a JWT pair. The access token (valid 24 h) goes in `Authorization: Bearer …`; refresh with `POST /api/token/refresh/` (refresh token valid 7 days). A second scheme, `tokenAuth` (`Authorization: Token …`), is listed only on `DELETE /prices/…`.

| Method and path | Purpose |
|---|---|
| `GET /books/`, `GET /books/{isbn}/` | Search (paginated, filterable) and read books |
| `POST /books/`, `PUT /books/{isbn}/`, `DELETE /books/{isbn}/` | Create (queued, async), update (async), delete a book |
| `POST /isbns/` | Send a list of ISBNs, get the matching books |
| `POST /availabilities/{isbn}/` | Create an availability (async) |
| `PUT` / `DELETE /availabilities/{isbn}/{availability_target_key}/{sucursal_key}/` | Update (async) / delete one |
| `GET /availability_types/` | Supported types (ONIX code list 65) |
| `POST /prices/`, `PUT /prices/`, `DELETE /prices/{price_list_key}/{book_isbn}/` | Create, update, delete prices in a price list |
| `GET /company/`, `GET /company/{legal_id}/` | Companies on the network |
| `GET /user/me/` | The authenticated user |

`Availability` fields: `availability` (type code), `stock` (integer, only meaningful for "En Stock"), `availability_target`, `sucursal`, `allow_firme`, `allow_consign`, `days_to_deliver`, `book_key`, timestamps.

**Inference, not verified:** the write endpoints suggest a publisher or distributor can push its own books, prices and availability into the network. If Ovnipress is a publisher on Fierro B2B, miDepo could publish the **real physical stock per title** as availabilities. Whether Ovnipress's user may do this, and whether it duplicates what its Fierro already publishes, is unknown.

## Fierro features relevant to a warehouse

- **Stock** (help category `stock`): sections Reportes, Inventario, Documentos de stock. Warehouses ("depósitos") exist per branch ("sucursal"); stock documents can have a recipient or sender; there are articles to move all stock between warehouses and to zero a warehouse.
- **Inventory by location**: a count ("toma") records books per location inside an inventory; closing it adjusts the warehouse stock and posts entry/exit stock documents. Location is optional. Fierro appears to use locations for counts and picking lists, **not as a permanent stock balance per location**: that is the gap miDepo fills.
- **Picking list**: when an order is set to "En Elaboración", a preparation list and a **picking list grouped by location** can be printed.
- **Boxes and dispatch ("cajas y despachos")**, from the article `circuito-de-cajas-y-despachos`: orders in states Firme, Baja/Cons. or Consignación; scan books (keyboard or barcode reader) into a box tied to an order, with an optional "book group" validation; box label and packing list; **remitos or factura-remitos generated automatically from the boxes**; dispatch groups boxes under a responsible person and carrier; delivery is confirmed per dispatch. Order states there: Pendiente → En Elaboración → Documentado en Cajas → Cerrado, plus Bloqueado (credit), Stand By, Cancelado. Available stock is physical stock minus what is in preparation or packed.
- Wholesale articles (not read in detail): orders, consignments, invoicing, current accounts, sale conditions, returns, "servicio de novedades", cajas y despachos.

### How miDepo's order states line up with Fierro's

| miDepo | Fierro |
|---|---|
| `pending` | Pendiente |
| `in_picking`, `picked` | En Elaboración |
| `packed` | (boxes exist; waiting to be documented) |
| `shipped` (marked as loaded in Fierro) | Documentado en Cajas / dispatched |

## Not known

- Whether Fierro can **receive** documents or stock movements from outside in real time (the schema has none for orders or receipts).
- The CSV/spreadsheet layouts for orders, receipts and returns; the FTP stock format; the list of "acceso a datos" views; SINLI file details.
- Pricing and conditions for API access or data access, and whether Ovnipress's plan includes them.

## Questions for Fierro

1. Can a partner create or update **stock documents, receipts, returns or order status** from outside, by API or file? If not, what is the intended path for a warehouse system?
2. Can you share the **list of views** in "acceso a datos", and is access included in Ovnipress's plan?
3. What exactly is the **FTP stock update** (format, direction, frequency)?
4. Which **spreadsheet layouts** does Fierro accept for orders, remitos, receipts and returns, and can they be set up for a third-party system?
5. Can the **B2B availability** endpoints be used to publish real warehouse stock per title for a publisher?
6. Is there a **sandbox** account for a third-party developer?

## Help-centre map

Base `https://soporte.fierro.com.ar/portal/es/kb/fierro/`. Categories: `capacitaciones`, `basics`, `catalogo`, `ventas` (clientes, ventas-mayoristas, facturación, señas-y-reservas, impresoras-fiscales, facturación-electrónica, reportes, otros-módulos, cobranzas), `compras`, `cajaybancos`, `stock` (reportes, inventario, documentos-de-stock), `seguridad`, `general`, `módulo-contable`, `ddaa`, `integraciones` (operaciones, mercado-libre, tiendanube, woocommerce, shopify, publica-la, actualización-de-stock-por-ftp, nielsen, livriz, delibros), `prensa`, `suscripciones`, `impuestos`, `sistema`, `feria`, `b2b`, `api-fierro-b2b`, `webinar`, `sinli`, `acuerdo-de-servicio`, `implementación-fierrogo`, `cruz`.

Articles actually read (under `https://soporte.fierro.com.ar/portal/es/kb/articles/`): `circuito-de-cajas-y-despachos`, `tomas-archivo-csv`, `howtos-stock-stock-07` (toma de inventario con o sin ubicación), `catalogo-fierro-b2b`, `b2b-tecnica`, `preguntas-frecuentes-fierro-acceso-a-datos`, `cuales-son-los-documentos-que-contempla-sinli`, `cruz`. Others seen only by title: `como-mover-todo-el-stock-de-un-deposito-a-otro`, `documentos-de-stock-destinatario-remitente`, `bandeja-de-entrada-y-salida`, `pedidos-fierro-b2b`, `importar-libro-b2b`, `reporte-de-cajas-lista-de-empaque`, `validacion-de-libros-por-grupo-en-documentos-de-caja`.

## Why this is not a full mirror

The owner asked for the whole documentation to be downloaded or synced. That was **not completed**. The help centre is a hosted help-desk portal whose article list is not exposed as plain pages, and the one attempt to read its listing endpoint directly was blocked by the session's permission check as unauthorised access; it was not retried or worked around. Pages were instead read one by one. A future attempt should be agreed with the owner first. Better routes: ask Fierro for an export or for the "acceso a datos" view documentation (question 2), or read the remaining articles one at a time from the map above.
