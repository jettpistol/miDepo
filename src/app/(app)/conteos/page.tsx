import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { ActionForm } from "@/components/ScanForm";
import { Progress, PageHeader, shortDate, Badge, EmptyState } from "@/components/ui";
import { countLocations, counts } from "@/db/schema";
import { can, requireSession } from "@/lib/session";
import { create } from "./actions";
import { PrefixField } from "./PrefixField";
import { hotkey } from "@/lib/hotkeys";

export const metadata = { title: "Conteos" };

export default async function Counts() {
  const { db, company, user } = await requireSession();
  const rows = await db
    .select({
      k: counts,
      total: sql<number>`count(${countLocations.locationId})`.mapWith(Number),
      countedCount: sql<number>`count(*) filter (where ${countLocations.status} = 'counted')`.mapWith(Number),
    })
    .from(counts)
    .leftJoin(countLocations, eq(countLocations.countId, counts.id))
    .where(eq(counts.companyId, company.id))
    .groupBy(counts.id)
    .orderBy(desc(counts.date))
    .limit(40);

  return (
    <>
      <PageHeader title="Conteos" />
      {can(user.role, "supervisor") && (
        <section id="nuevo" className="panel mb-8 lg:mb-6 max-w-3xl p-4 lg:p-3">
          <h2 className="section-title">Nuevo conteo</h2>
          <ActionForm action={create} button="Crear conteo" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start [&>button]:sm:mt-[1.625rem]">
            <div>
              <label htmlFor="name" className="field-label">
                Nombre
              </label>
              <input id="name" name="name" className="field" placeholder="Pasillo A, noviembre" required />
            </div>
            <PrefixField />
          </ActionForm>
        </section>
      )}
      {rows.length === 0 ? (
        <EmptyState icon="count" title="No hay conteos">
          {can(user.role, "supervisor") ? "Crea el primero arriba." : "Cuando tu supervisor arme un conteo, va a aparecer acá."}
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Conteo</th>
                <th className="hidden w-[30%] min-w-40 sm:table-cell">Ubicaciones contadas</th>
                <th className="hidden md:table-cell">Creado</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ k, total, countedCount }) => (
                <tr key={k.id}>
                  <td>
                    <Link href={`/conteos/${k.id}`} className="link" {...(k.id === rows.find((x) => x.k.status === "open")?.k.id ? hotkey("primary", `Abrir ${k.name}`) : {})}>
                      {k.name}
                    </Link>
                    <span className="block text-muted md:hidden">
                      <span className="sm:hidden">
                        {countedCount} de {total} ubicaciones ·{" "}
                      </span>
                      {shortDate(k.date)}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell">
                    <Progress done={countedCount} total={total} />
                  </td>
                  <td className="hidden whitespace-nowrap text-muted md:table-cell">{shortDate(k.date)}</td>
                  <td className="w-px">{k.status === "closed" ? <Badge tone="ok">Cerrado</Badge> : countedCount === total ? <Badge tone="warn">Para revisar</Badge> : <Badge tone="accent">Abierto</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
