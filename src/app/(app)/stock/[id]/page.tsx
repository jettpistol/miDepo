import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Icon } from "@/components/Icon";
import { Code, PageHeader, shortDate, Badge, ShelfMark } from "@/components/ui";
import { fierroStock, movements, products, stock, locations, users, type MovementReason } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { locationName } from "@/lib/stock";

const money = (cents: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(cents / 100);
const kg = (g: number) => `${(g / 1000).toLocaleString("es-AR", { maximumFractionDigits: 2 })} kg`;

const REASON = { initial: "Carga inicial", receiving: "Recepción", putaway: "Reposición", movement: "Movimiento", picking: "Picking", shipment: "Despacho", return: "Devolución", count_adjustment: "Ajuste por conteo", count_relocation: "Mal ubicado (conteo)", missing: "Faltante en picking", found: "Apareció", write_off: "Baja" } as const satisfies Record<MovementReason, string>;

export default async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, company } = await requireSession();
  const [p] = await db.select().from(products).where(and(eq(products.id, id), eq(products.companyId, company.id)));
  if (!p) notFound();
  const fromLoc = alias(locations, "from_loc");
  const toLoc = alias(locations, "to_loc");
  const [whereabouts, [fierro], moves] = await Promise.all([
    db.select({ s: stock, u: locations }).from(stock).innerJoin(locations, eq(locations.id, stock.locationId)).where(eq(stock.productId, id)).orderBy(asc(locations.code)),
    db.select().from(fierroStock).where(eq(fierroStock.productId, id)),
    db
      .select({ m: movements, fromLoc: fromLoc.code, toLoc: toLoc.code, who: users.name })
      .from(movements)
      .leftJoin(fromLoc, eq(fromLoc.id, movements.fromId))
      .leftJoin(toLoc, eq(toLoc.id, movements.toId))
      .leftJoin(users, eq(users.id, movements.userId))
      .where(eq(movements.productId, id))
      .orderBy(desc(movements.id))
      .limit(30),
  ]);
  const total = whereabouts.reduce((s, d) => s + d.s.quantity, 0);

  return (
    <>
      <PageHeader title={p.title} back={{ href: "/stock", text: "Stock" }} subtitle={[p.author, p.imprint].filter(Boolean).join(" · ")} />
      <div className={p.coverUrl ? "grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)] sm:items-start" : ""}>
        {p.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- local covers, already small
          <img src={p.coverUrl} alt={`Tapa de ${p.title}`} className="w-40 sm:w-full rounded-md border border-line object-cover shadow-sm sm:sticky sm:top-4" />
        )}
        <div className="min-w-0">
          <div className="mb-8 lg:mb-6 border-y border-line px-2 py-3 lg:py-2 lg:px-3">
            <dl className="flex flex-wrap items-end gap-x-10 lg:gap-x-8 gap-y-3">
              {[
                ["En el depósito", total],
                ["Según Fierro", fierro?.quantity ?? 0],
                ["Precio", p.price > 0 ? money(p.price) : "—"],
                ["Peso", kg(p.weightGrams)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm text-muted">{k}</dt>
                  <dd className="text-xl lg:text-base font-bold tabular-nums">{v}</dd>
                </div>
              ))}
              <div>
                <dt className="text-sm text-muted">Códigos</dt>
                <dd className="flex min-h-7 flex-wrap items-center gap-2">
                  <Code>{p.barcode}</Code>
                  {p.isbn && p.internalCode !== p.barcode && <Code>{p.internalCode}</Code>}
                  {!p.isbn && <Badge tone="warn">Sin ISBN</Badge>}
                </dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-x-12 lg:gap-x-8 gap-y-8 lg:gap-y-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
            <section>
              <h2 className="section-title">
                Ubicaciones {whereabouts.length > 0 && <small>{whereabouts.length}</small>}
              </h2>
              {whereabouts.length === 0 ? (
                <p className="border-y border-line px-2 py-6 lg:py-5 text-sm text-muted lg:px-3">No hay unidades en el depósito.</p>
              ) : (
                <ul className="ruled-list framed">
                  {whereabouts.map(({ s, u }) => (
                    <li key={u.id}>
                      <Link href={`/ubicaciones/${u.id}`} className="row">
                        <ShelfMark code={u.code} size="md" />
                        <span className="min-w-0 flex-1 truncate text-sm text-muted">{u.type === "shelf" ? "" : locationName(u)}</span>
                        <span className="text-xl lg:text-base font-bold tabular-nums">{s.quantity}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {moves.length > 0 && (
              <section className="min-w-0">
                <h2 className="section-title">Últimos movimientos</h2>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="hidden sm:table-cell">Fecha</th>
                        <th>Motivo</th>
                        <th>Origen → Destino</th>
                        <th className="text-right">Cantidad</th>
                        <th className="hidden md:table-cell">Usuario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moves.map(({ m, fromLoc, toLoc, who }) => (
                        <tr key={m.id}>
                          <td className="hidden whitespace-nowrap text-muted sm:table-cell">{shortDate(m.createdAt)}</td>
                          <td>
                            {REASON[m.reason]}
                            {m.reference && <span className="text-muted"> · {m.reference}</span>}
                            <span className="block text-muted sm:hidden">{shortDate(m.createdAt)}</span>
                            <span className="hidden text-muted sm:block md:hidden">{who ?? "—"}</span>
                          </td>
                          <td className="whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              {fromLoc ? <ShelfMark code={fromLoc} /> : <span className="text-muted">Fuera del depósito</span>}
                              <Icon name="arrow" className="size-4 text-muted" />
                              {toLoc ? <ShelfMark code={toLoc} /> : <span className="text-muted">Fuera del depósito</span>}
                            </span>
                          </td>
                          <td className="text-right font-semibold">{m.quantity}</td>
                          <td className="hidden text-muted md:table-cell">{who ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
