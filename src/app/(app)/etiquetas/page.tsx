import Link from "next/link";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { labelJobs, users } from "@/db/schema";
import { FilterTabs, Pager, paging, requestedPage } from "@/components/ListTools";
import { Icon } from "@/components/Icon";
import { RowMenu } from "@/components/RowMenu";
import { ActionButton } from "@/components/ScanForm";
import { Badge, EmptyRow, PageHeader, shortDate } from "@/components/ui";
import { kindName } from "@/lib/flows/labels";
import { targetFor } from "@/lib/flows/printers";
import { KIND_ORDER } from "@/lib/labels/kinds";
import { sizeById } from "@/lib/labels/sizes";
import { requireSession } from "@/lib/session";
import { currentWorkstation } from "@/lib/workstation";
import { discard, restore } from "./actions";
import { PrintNow } from "./PrintNow";

export const metadata = { title: "Etiquetas" };

const TABS = { "": "Pendientes", impresas: "Impresas", descartadas: "Descartadas" } as const;
type Tab = keyof typeof TABS;

/** Where a job's reference links to. */
function href(source: string) {
  const [type, id] = source.split(":");
  return type === "receiving" ? `/recepcion/${id}` : type === "order" ? `/empaque/${id}` : type === "return" ? `/devoluciones/${id}` : type === "locations" ? "/ubicaciones" : null;
}

export default async function Labels({ searchParams }: { searchParams: Promise<{ estado?: string; pagina?: string }> }) {
  const { db, company } = await requireSession();
  const sp = await searchParams;
  const tab: Tab = sp.estado === "impresas" || sp.estado === "descartadas" ? sp.estado : "";
  const page = requestedPage(sp.pagina);
  const where: Record<Tab, SQL> = {
    "": and(eq(labelJobs.companyId, company.id), isNull(labelJobs.printedAt), isNull(labelJobs.discardedAt))!,
    impresas: and(eq(labelJobs.companyId, company.id), isNotNull(labelJobs.printedAt))!,
    descartadas: and(eq(labelJobs.companyId, company.id), isNull(labelJobs.printedAt), isNotNull(labelJobs.discardedAt))!,
  };
  const counts = Object.fromEntries(
    await Promise.all((Object.keys(TABS) as Tab[]).map(async (t) => [t, (await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(labelJobs).where(where[t]))[0].n] as const)),
  ) as Record<Tab, number>;
  const [creator, printer] = [alias(users, "creator"), alias(users, "printer")];
  const rows = await db
    .select({ j: labelJobs, creator: creator.name, printer: printer.name })
    .from(labelJobs)
    .leftJoin(creator, eq(creator.id, labelJobs.createdBy))
    .leftJoin(printer, eq(printer.id, labelJobs.printedBy))
    .where(where[tab])
    .orderBy(tab === "impresas" ? desc(labelJobs.printedAt) : desc(labelJobs.id))
    .limit(paging(page).limit)
    .offset(paging(page).offset);
  // Where this computer prints each kind: a printer takes one click here, the dialog opens the view.
  const w = await currentWorkstation(db, company.id);
  const targets = Object.fromEntries(await Promise.all(KIND_ORDER.map(async (k) => [k, await targetFor(db, company.id, w?.id ?? null, k)] as const)));
  const params = { estado: tab || undefined };
  const verb = tab === "impresas" ? "Reimprimir" : "Imprimir";

  return (
    <>
      <PageHeader title="Etiquetas">
        <Link href="/etiquetas/prueba" target="_blank" className="btn-soft">
          <Icon name="print" /> Prueba
        </Link>
      </PageHeader>
      <FilterTabs base="/etiquetas" params={params} name="estado" value={tab} tabs={(Object.keys(TABS) as Tab[]).map((t) => ({ value: t, label: TABS[t], count: counts[t] }))} />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Origen</th>
              <th className="text-right">Etiquetas</th>
              <th className="hidden md:table-cell">{tab === "impresas" ? "Impresas" : "Preparadas"}</th>
              <th className="hidden lg:table-cell">Destino</th>
              <th className="w-px" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow columns={6} title={tab === "" ? "Sin etiquetas pendientes" : tab === "impresas" ? "Sin etiquetas impresas" : "Sin etiquetas descartadas"} />}
            {rows.map(({ j, creator, printer: printedBy }) => {
              const link = href(j.source);
              const t = targets[j.kind];
              const size = sizeById(t.sizeId)?.name ?? t.sizeId;
              const view = `/etiquetas/${j.id}`;
              return (
                <tr key={j.id}>
                  <td>
                    {kindName(j.kind)}
                    {!j.automatic && (
                      <>
                        {" "}
                        <Badge>Manual</Badge>
                      </>
                    )}
                  </td>
                  <td>{link ? <Link href={link} className="link doc-number">{j.reference}</Link> : <span className="doc-number">{j.reference}</span>}</td>
                  <td className="text-right tabular-nums">{j.total}</td>
                  <td className="hidden whitespace-nowrap text-muted md:table-cell">
                    {tab === "impresas" && j.printedAt ? `${shortDate(j.printedAt)} · ${printedBy ?? "—"}${j.prints > 1 ? ` · ${j.prints} veces` : ""}` : `${shortDate(j.createdAt)} · ${creator ?? "—"}`}
                  </td>
                  <td className="hidden text-muted lg:table-cell">
                    {t.printer?.name ?? "Diálogo"} · {size}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      {tab !== "descartadas" &&
                        (t.printer ? (
                          <PrintNow id={j.id} verb={verb} />
                        ) : (
                          <Link href={`${view}?auto=1`} target="_blank" className="btn-sm">
                            <Icon name="print" /> <span className="sr-only sm:not-sr-only">{verb}</span>
                          </Link>
                        ))}
                      <RowMenu label={`Opciones de ${j.reference}`}>
                        <Link href={view} target="_blank" className="menu-item">
                          Ver y elegir tamaño
                        </Link>
                        {tab === "" && (
                          <ActionButton action={discard} hiddenFields={{ id: j.id }} className="menu-item">
                            Descartar
                          </ActionButton>
                        )}
                        {tab === "descartadas" && (
                          <ActionButton action={restore} hiddenFields={{ id: j.id }} className="menu-item">
                            Volver a pendientes
                          </ActionButton>
                        )}
                      </RowMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager base="/etiquetas" params={params} page={page} total={counts[tab]} />
    </>
  );
}
