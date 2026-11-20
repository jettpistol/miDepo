import Link from "next/link";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { LiveSearch } from "@/components/LiveSearch";
import { Pager, paging, requestedPage } from "@/components/ListTools";
import { containsText } from "@/lib/lookup";
import { ActionForm } from "@/components/ScanForm";
import { AssigneeCell, assignees } from "@/components/Assignee";
import { Progress, PageHeader, shortDate, Badge, EmptyRow } from "@/components/ui";
import { countLocations, counts } from "@/db/schema";
import { can, requireSession } from "@/lib/session";
import { create } from "./actions";
import { PrefixField } from "./PrefixField";
import { hotkey } from "@/lib/hotkeys";

export const metadata = { title: "Conteos" };

export default async function Counts({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const session = await requireSession();
  const { db, company, user } = session;
  const a = await assignees(session);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = requestedPage(sp.pagina);
  const filter = and(eq(counts.companyId, company.id), q ? containsText(counts.name, q) : undefined);
  const [[{ n: total }], rows] = await Promise.all([db.select({ n: count() }).from(counts).where(filter), db
    .select({
      k: counts,
      total: sql<number>`count(${countLocations.locationId})`.mapWith(Number),
      countedCount: sql<number>`count(*) filter (where ${countLocations.status} = 'counted')`.mapWith(Number),
    })
    .from(counts)
    .leftJoin(countLocations, eq(countLocations.countId, counts.id))
    .where(filter)
    .groupBy(counts.id)
    .orderBy(desc(counts.date), desc(counts.id))
    .limit(paging(page).limit)
    .offset(paging(page).offset)]);

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
      <h2 className="section-title">
        Conteos <small>{total}</small>
      </h2>
      {(total > 0 || q) && <LiveSearch placeholder="Nombre del conteo" className="mb-3 max-w-md" />}
      <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Conteo</th>
                <th className="hidden sm:table-cell">Asignado</th>
                <th className="hidden w-[30%] min-w-40 sm:table-cell">Ubicaciones contadas</th>
                <th className="hidden md:table-cell">Creado</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <EmptyRow columns={5} title={q ? `Ningún conteo coincide con "${q}"` : "Sin conteos"} />
              )}
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
                    <AssigneeCell a={a} kind="count" id={k.id} value={k.assignedTo} open={k.status === "open"} />
                  </td>
                  <td className="hidden sm:table-cell">
                    <Progress done={countedCount} total={total} />
                  </td>
                  <td className="hidden whitespace-nowrap text-muted md:table-cell">{shortDate(k.date)}</td>
                  <td className="w-px">{k.status === "closed" ? <Badge tone="ok">Cerrado</Badge> : countedCount === total ? <Badge tone="warn">En revisión</Badge> : <Badge tone="accent">Abierto</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      <Pager base="/conteos" params={{ q }} page={page} total={total} />
    </>
  );
}
