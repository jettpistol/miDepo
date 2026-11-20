import Link from "next/link";
import { and, count, eq, inArray, sum } from "drizzle-orm";
import { Icon } from "@/components/Icon";
import { PageHeader, ShelfMark, EmptyState } from "@/components/ui";
import { counts, returns, orders, receivings, stock, locations } from "@/db/schema";
import { pendingExports } from "@/lib/flows/exports";
import { can, requireSession } from "@/lib/session";
import { InProgressTable, loadOpenOrders, PendingTable } from "./picking/Tables";

/** A work queue: what it is, how much there is, and where to go. */
function Queue({ href, number, title }: { href: string; number: number; title: string }) {
  return (
    <li>
      <Link href={href} className="row group">
        <span className="min-w-0 flex-1 font-semibold">{title}</span>
        <span className={`text-xl lg:text-base font-bold tabular-nums ${number > 0 ? "" : "text-muted/60"}`}>{number}</span>
        <Icon name="arrow" className="size-4 text-muted transition-transform duration-150 group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

const FIRST_N = 8;

export default async function Home() {
  const { db, user, company } = await requireSession();
  const e = company.id;

  const [openOrders, toPack, openReceivings, openReturns, openCounts, toPutAway, exports] = await Promise.all([
    loadOpenOrders(db, e),
    db.select({ n: count() }).from(orders).where(and(eq(orders.companyId, e), eq(orders.status, "picked"))),
    db.select({ n: count() }).from(receivings).where(and(eq(receivings.companyId, e), inArray(receivings.status, ["pending", "in_progress"]))),
    db.select({ n: count() }).from(returns).where(and(eq(returns.companyId, e), eq(returns.status, "in_progress"))),
    db.select({ n: count() }).from(counts).where(and(eq(counts.companyId, e), eq(counts.status, "open"))),
    db.select({ n: sum(stock.quantity).mapWith(Number) }).from(stock).innerJoin(locations, eq(locations.id, stock.locationId)).where(and(eq(stock.companyId, e), inArray(locations.type, ["receiving", "returns"]))),
    can(user.role, "supervisor") ? pendingExports(db, e) : Promise.resolve([]),
  ]);
  const { inProgress, pending } = openOrders;
  const myOrders = inProgress.filter((f) => f.p.takenBy === user.id);

  return (
    <>
      <PageHeader title="Inicio" />

      {myOrders.map(({ p, nextShelf }) => (
        <Link key={p.id} href={`/picking/${p.id}`} className="mb-6 flex items-center gap-4 rounded-control bg-accent px-4 py-3.5 text-on-accent transition-colors duration-150 hover:bg-accent-hover">
          {nextShelf && <ShelfMark code={nextShelf} size="md" onAccent />}
          <span className="min-w-0 flex-1">
            <span className="block text-sm opacity-85">Tienes un pedido a medio preparar</span>
            <span className="block text-lg lg:text-base leading-tight font-bold">Seguir con {p.number}</span>
          </span>
          <Icon name="arrow" className="size-6" />
        </Link>
      ))}

      <div className="grid gap-x-12 lg:gap-x-8 gap-y-8 lg:gap-y-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-8 lg:space-y-6">
          {inProgress.length > 0 && (
            <section>
              <h2 className="section-title">
                Pedidos en preparación <small>{inProgress.length}</small>
              </h2>
              <InProgressTable rows={inProgress} userId={user.id} />
            </section>
          )}

          <section>
            <h2 className="section-title">
              Pedidos para preparar <small>{pending.length}</small>
            </h2>
            {pending.length === 0 ? (
              <EmptyState title="No hay pedidos pendientes">Los pedidos nuevos aparecen cuando se sincroniza con Fierro.</EmptyState>
            ) : (
              <>
                <PendingTable rows={pending.slice(0, FIRST_N)} />
                {pending.length > FIRST_N && (
                  <p className="mt-3 text-sm text-muted">
                    Los {FIRST_N} más viejos de {pending.length}.{" "}
                    <Link href="/picking" className="link">
                      Ver todos en Picking
                    </Link>
                  </p>
                )}
              </>
            )}
          </section>
        </div>

        <section>
          <h2 className="section-title">Resumen del depósito</h2>
          <ul className="ruled-list framed">
            <Queue href="/empaque" number={toPack[0].n} title="Pedidos para empacar" />
            <Queue href="/recepcion" number={openReceivings[0].n} title="Recepciones abiertas" />
            <Queue href="/reposicion" number={toPutAway[0].n ?? 0} title="Unidades por reponer" />
            <Queue href="/devoluciones" number={openReturns[0].n} title="Devoluciones en curso" />
            <Queue href="/conteos" number={openCounts[0].n} title="Conteos abiertos" />
            {can(user.role, "supervisor") && <Queue href="/fierro" number={exports.length} title="Para cargar en Fierro" />}
          </ul>
        </section>
      </div>
    </>
  );
}
