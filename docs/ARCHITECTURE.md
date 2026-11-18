# Architecture

One Next.js app (App Router): server components read the database directly, server actions write through the rules in `src/lib/flujos/`. There is no separate API server; the only route handlers are for passkeys, CSV export and profile photos.

## Layers

Dependencies go one way, top to bottom.

```
src/app/**/page.tsx          Server components: read with Drizzle, render. Forms are small client components.
src/app/**/acciones.ts       "use server" files. Each export is accion(rolMinimo, fn): session + role check,
                             error to message, revalidate.   (src/lib/accion.ts)
src/lib/flujos/*.ts          The warehouse rules. Take a Ctx {db, empresaId, usuarioId}. Throw ErrorUsuario.
src/lib/stock.ts             moverStock: the only writer of the `stock` table. Lookups by code. Zones.
src/lib/fierro/              ConectorFierro (interface), FierroSimulado, sincronizar(), csv helpers.
src/db/schema.ts             Every table, commented.
```

`src/lib/errores.ts`: `ErrorUsuario` carries a Spanish message for the user; `intentar()` turns it into `{ error }`, anything else into a generic message plus a server log, and lets `redirect()`/`notFound()` through.

## Data model

| Group | Tables |
|---|---|
| Tenancy and people | `empresas`, `usuarios`, `usuario_fotos`, `sesiones`, `passkeys`, `intentos_login` |
| Mirror of Fierro (read-only for miDepo) | `productos`, `clientes`, `fierro_stock` (what Fierro believes the stock is), `pedidos` + `pedido_lineas` and `recepciones` + `recepcion_lineas` (copied in by sync, then worked on here) |
| Physical stock (owned by miDepo) | `ubicaciones`, `stock` (product × location), `movimientos` (append-only history) |
| Picking and packing | `tareas_picking`, `cajas`, `caja_items` |
| Returns | `devoluciones`, `devolucion_lineas` |
| Counts | `conteos`, `conteo_ubicaciones`, `conteo_lineas` |

Every business table carries `empresa_id` (directly or through its parent). Products without an ISBN get an internal code (`OVN-001824`); `productos.codigo_barras` is what a scanner reads (the ISBN, or the internal code when there is none).

## Stock model

- Location types: `estanteria` (a real shelf) plus five zones created per company: `recepcion`, `devoluciones`, `danados`, `saldos`, `preparacion`.
- Stock enters through receiving (into Recepción) and returns (into Devoluciones / Dañados / Saldos), moves with Guardar and Mover, goes to `preparacion` when picked, and **leaves only when an order is marked as loaded in Fierro** (`marcarEnviado`).
- `stock` rows at zero are deleted. `moverStock` rejects moves that would go negative.
- Picking availability for a title is the stock on active shelves minus what other pending pick stops have already promised (`disponible()` in `flujos/picking.ts`). Where one shelf covers the quantity it is used alone to avoid extra stops.

## State machines

```
pedido        pendiente → en_preparacion → preparado → empacado → despachado
              (taken)     (picking)        (picking   (boxes     (marked loaded
                                            finished)  closed)    in Fierro)
tarea picking pendiente → hecha | faltante      (a shortage may spawn new stops on another shelf)
caja          abierta → cerrada
recepcion     pendiente | en_curso → cerrada
devolucion    en_curso → cerrada
conteo        abierto → cerrado               (each location: pendiente → contada)
```

`tomarPedido` claims an order with a conditional UPDATE so two people tapping at once cannot both get it.

## Handing documents to Fierro

Finished documents are rows with a closed state and `enviado_a_fierro IS NULL`. `pendientesDeEnvio()` lists them, `archivoPara()` builds the CSV, `marcarEnviado()` stamps the time, applies the dispatch movement for orders, and calls `ConectorFierro.enviar()`. With the simulator that adds the deltas to `fierro_stock`, which is exactly what the reconciliation screen compares against.

## Fierro boundary

`ConectorFierro` (`src/lib/fierro/tipos.ts`): `libros`, `clientes`, `pedidosPendientes`, `ingresosEsperados`, `stock`, `enviar`. `conector()` in `src/lib/fierro/index.ts` chooses the implementation per company; today always `FierroSimulado`. `sincronizar()` upserts catalogue and customers, inserts orders and receipts not seen before (it never overwrites ones already started), and refreshes `fierro_stock`.

The simulator is deterministic from `empresas.sim_semilla`: same seed, same books, customers and orders. `src/db/seed.ts` leaves roughly 1 title in 70 with a different Fierro quantity so the reconciliation screen has something to show. The "simulate new orders / receipt" buttons on the Fierro screen bump `sim_pedidos` / `sim_ingresos` and re-sync.

## Authentication and sessions

- Password: scrypt. PIN: 6 digits, stored as `HMAC(SECRETO, empresaId:pin)`, unique per company. Passkeys: SimpleWebAuthn, the challenge travels in a signed 5-minute cookie, relying-party id from `APP_URL` (or the request host).
- 6 failed attempts on the same key block it for 5 minutes (`intentos_login`; keys are `clave:<email>` and `pin:<company>:<ip>`).
- A device holds up to five sessions: cookie `midepo_sesion` is the active token, `midepo_sesiones` is all tokens joined with `.`. Tokens are random and stored hashed. Switching account only changes which token is active. Logging in again as someone already open replaces that session. PIN logins expire after 14 hours, others after 30 days. Code: `src/lib/sesion.ts`.
- Roles `operario < supervisor < admin`. Pages use `requerir(minimo)` (redirects), actions use `accion(minimo, …)` (message).

## Interface

- **Tokens:** `src/app/globals.css` defines CSS variables and Tailwind names for surfaces, text, status colours and the accent. `src/lib/color.ts` derives the text-on-accent and text-as-accent colours so any chosen colour stays readable in light and dark. The root layout writes them on `<html>` from the signed-in user, so the whole site follows that person. `cuenta/Apariencia.tsx` previews live and restores on leave.
- **Scanning:** `components/Escaneo.tsx` (form, field chaining, sound, vibration), `Camara.tsx` (native `BarcodeDetector` or ZXing WASM from `public/`).
- **Layout groups:** `(app)` the dashboard shell (sidebar on desktop, bottom bar and header on phones); `(imprimir)` black-and-white A4 pages; `(manual)` the manual site with its own black header. Barcodes are Code 128 SVG from `bwip-js/node` (server only).
- **Manual:** `wiki/*.md` in GitHub-wiki layout (`Home`, `_Sidebar`, `_Footer`). `src/lib/wiki.ts` renders it with `marked`, rewrites page links to `/ayuda/<Page>`, and implements accent-insensitive search.

## Configuration

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | Postgres connection string. Unset means embedded database in `.data/pglite` (local testing only). |
| `SECRETO` | Long random text for PIN hashes and challenge cookies. **Required when `DATABASE_URL` is set**; never change it after PINs exist. |
| `APP_URL` | Public address without trailing slash. Must match the browser address for passkeys. |
| `DATOS_DEMO` | `no` skips seeding the demo companies. |
| `PGLITE_DIR` | Override the embedded database folder (`memory://` for tests). |

`npm run db:setup` (also part of `build:prod` and `dev`) applies migrations from `drizzle/` and seeds when the database has no companies.

## Testing

`tests/flujos.test.ts` (vitest, in-memory database) covers the rules; `tests/*.e2e.js` are Playwright scripts run by hand against a running server. See [STATUS.md](STATUS.md#how-to-verify-a-change).
