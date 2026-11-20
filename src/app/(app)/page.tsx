import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ROLE_LABEL } from "@/components/Accounts";
import { ActivityChart, Card, Meter, StageBar, StatTile, ZoneBars } from "@/components/charts";
import { Icon } from "@/components/Icon";
import { PageHeader, Progress, ShelfMark, plural, shortDate } from "@/components/ui";
import { pendingExports } from "@/lib/flows/exports";
import { hotkey } from "@/lib/hotkeys";
import { can, requireSession } from "@/lib/session";
import { assignablePeople, isMine, isUnassigned, KIND, movedToday, openTasks, orderStages, weekActivity, zoneStock, type Task } from "@/lib/work";
import { loadOpenOrders } from "./picking/Tables";
import { batchNumber } from "@/lib/flows/picking";

const FIRST_N = 8;

/** "3 pedidos · 1 recepción": how much of each kind, in a fixed order. */
function byKind(tasks: Task[]) {
  return (Object.keys(KIND) as Task["kind"][])
    .map((k) => [k, tasks.filter((t) => t.kind === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => plural(n, KIND[k].one, KIND[k].many))
    .join(" · ");
}

/** One piece of work in "Asignado a ti": what it is, how far along, and the button to carry on. */
function TaskRow({ t, first }: { t: Task; first: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-control bg-sunken text-muted" title={KIND[t.kind].one}>
        <Icon name={KIND[t.kind].icon} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <Link href={t.href} className="link doc-number">
          {t.name}
        </Link>
        <span className="block truncate text-[13px] text-muted">{t.detail}</span>
      </span>
      <span className="hidden w-36 sm:block">{t.total > 0 ? <Progress done={t.done} total={t.total} /> : <span className="text-sm text-muted">{t.kind === "return" ? `${t.done} unidades` : ""}</span>}</span>
      <Link href={t.href} className="btn-sm" {...(first ? hotkey("primary", `${t.verb}: ${t.name}`) : {})}>
        {t.verb}
      </Link>
    </li>
  );
}

export default async function Home() {
  const session = await requireSession();
  const { db, user, company } = session;
  const e = company.id;
  const supervisor = can(user.role, "supervisor");

  const [tasks, stages, days, zones, moved, people, exports, openOrders] = await Promise.all([
    openTasks(db, e),
    orderStages(db, e),
    weekActivity(db, e),
    zoneStock(db, e),
    movedToday(db, e),
    supervisor ? assignablePeople(db, e) : Promise.resolve([]),
    supervisor ? pendingExports(db, e) : Promise.resolve([]),
    loadOpenOrders(db, e),
  ]);

  // Yours first: the order you are picking right now, then the rest by age.
  const mine = tasks.filter((t) => isMine(t, user.id)).sort((a, b) => Number(b.takenBy === user.id) - Number(a.takenBy === user.id) || a.date.getTime() - b.date.getTime());
  const unassigned = tasks.filter(isUnassigned);
  const picking = openOrders.inProgress.filter((o) => o.p.takenBy === user.id);
  const myBatches = openOrders.batches.filter((x) => x.b.takenBy === user.id);
  // With nothing given to you, the oldest order nobody has is the next thing to do.
  const next = mine.length === 0 ? unassigned.find((t) => t.kind === "order" && t.verb === "Preparar") : undefined;
  const n = (key: string) => stages.find((s) => s.key === key)?.n ?? 0;
  const putAway = zones.filter((z) => z.type === "receiving" || z.type === "returns").reduce((s, z) => s + z.units, 0);

  return (
    <>
      <PageHeader title="Inicio">
        {supervisor && <span className="text-[13px] text-muted">{company.lastSync ? `Fierro sincronizado ${shortDate(company.lastSync)}` : "Fierro sin sincronizar"}</span>}
      </PageHeader>

      {myBatches.map(({ b, nextShelf, orders: count }) => (
        <Link key={`b${b.id}`} href={`/picking/lote/${b.id}`} className="mb-4 flex items-center gap-4 rounded-control bg-accent px-4 py-3 text-on-accent transition-colors duration-150 hover:bg-accent-hover" {...hotkey("primary", `Seguir con ${batchNumber(b.number)}`)}>
          {nextShelf && <ShelfMark code={nextShelf} size="md" onAccent />}
          <span className="min-w-0 flex-1">
            <span className="block text-sm opacity-85">Lote en curso · {plural(count, "pedido", "pedidos")}</span>
            <span className="block text-lg leading-tight font-bold lg:text-base">Seguir con {batchNumber(b.number)}</span>
          </span>
          <Icon name="arrow" className="size-6" />
        </Link>
      ))}
      {picking.map(({ p, nextShelf }) => (
        <Link key={p.id} href={`/picking/${p.id}`} className="mb-4 flex items-center gap-4 rounded-control bg-accent px-4 py-3 text-on-accent transition-colors duration-150 hover:bg-accent-hover">
          {nextShelf && <ShelfMark code={nextShelf} size="md" onAccent />}
          <span className="min-w-0 flex-1">
            <span className="block text-sm opacity-85">Pedido en curso</span>
            <span className="block text-lg leading-tight font-bold lg:text-base">Seguir con {p.number}</span>
          </span>
          <Icon name="arrow" className="size-6" />
        </Link>
      ))}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {supervisor ? (
          <>
            <StatTile icon="picking" value={n("pending")} label="Pedidos para preparar" href="/picking" tone={n("pending") > 0 ? "accent" : "neutral"} />
            <StatTile icon="packing" value={n("picked")} label="Pedidos para empacar" href="/empaque" />
            <StatTile icon="users" value={unassigned.length} label="Tareas sin asignar" tone={unassigned.length > 0 ? "warn" : "neutral"} />
            <StatTile icon="fierro" value={exports.length} label="Para cargar en Fierro" href="/fierro" />
          </>
        ) : (
          <>
            <StatTile icon="ok" value={mine.length} label="Asignado a ti" tone={mine.length > 0 ? "accent" : "neutral"} />
            <StatTile icon="move" value={moved.get(user.id) ?? 0} label="Unidades movidas hoy" />
            <StatTile icon="picking" value={n("pending")} label="Pedidos para preparar" href="/picking" />
            <StatTile icon="putaway" value={putAway} label="Unidades por reponer" href="/reposicion" />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Asignado a ti" count={mine.length}>
          {mine.length > 0 ? (
            <>
              <ul className="-my-2 divide-y divide-line">
                {mine.slice(0, FIRST_N).map((t, i) => (
                  <TaskRow key={`${t.kind}-${t.id}`} t={t} first={i === 0 && picking.length === 0 && myBatches.length === 0} />
                ))}
              </ul>
              {mine.length > FIRST_N && <p className="mt-3 text-[13px] text-muted">Y {mine.length - FIRST_N} más.</p>}
            </>
          ) : (
            <div className="py-2">
              <p className="font-semibold">Nada asignado</p>
              {next ? (
                <>
                  <p className="mt-0.5 mb-2 text-sm text-muted">Próximo pedido sin asignar</p>
                  <ul className="divide-y divide-line border-y border-line">
                    <TaskRow t={next} first={picking.length === 0 && myBatches.length === 0} />
                  </ul>
                </>
              ) : (
                <p className="mt-0.5 text-sm text-muted">Ningún pedido sin asignar.</p>
              )}
            </div>
          )}
        </Card>

        <Card title="Pedidos abiertos" count={stages.reduce((s, x) => s + x.n, 0)} link={{ href: "/picking", text: "Ver en Picking" }}>
          <StageBar stages={stages.map((s) => ({ ...s, href: s.key === "packed" ? (supervisor ? "/fierro" : "/empaque") : s.href }))} />
        </Card>

        <Card title="Actividad, últimos 7 días" count={days.reduce((s, d) => s + d.received + d.picked + d.shipped, 0)}>
          <ActivityChart days={days} />
        </Card>

        <Card title="Stock esperando en zonas">
          <ZoneBars zones={zones.map((z) => ({ ...z, href: z.type === "missing" || z.type === "damaged" ? (supervisor ? z.href : undefined) : z.href }))} />
        </Card>

        {supervisor && (
          <Card title="Equipo" count={people.length} className="lg:col-span-2">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Asignado</th>
                    <th className="hidden sm:table-cell">Preparando ahora</th>
                    <th className="w-[28%] min-w-32">Unidades movidas hoy</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-muted">
                          <Icon name="account" className="size-4" />
                        </span>
                        <span className="font-medium">Sin asignar</span>
                      </span>
                    </td>
                    <td className={unassigned.length ? "font-medium text-warn" : "text-muted"}>{byKind(unassigned) || "Nada"}</td>
                    <td className="hidden sm:table-cell" />
                    <td />
                  </tr>
                  {[...people]
                    .sort((a, b) => (moved.get(b.id) ?? 0) - (moved.get(a.id) ?? 0) || a.name.localeCompare(b.name))
                    .map((p) => {
                      const theirs = tasks.filter((t) => t.assignedTo === p.id);
                      const now = tasks.find((t) => t.takenBy === p.id);
                      const max = Math.max(0, ...moved.values());
                      return (
                        <tr key={p.id} className={p.id === user.id ? "bg-accent-soft" : ""}>
                          <td>
                            <span className="flex items-center gap-2.5">
                              <Avatar person={p} className="size-7 text-xs" />
                              <span className="min-w-0">
                                <span className="block truncate font-medium">{p.id === user.id ? `${p.name} (tú)` : p.name}</span>
                                <span className="block text-xs text-muted">{ROLE_LABEL[p.role]}</span>
                              </span>
                            </span>
                          </td>
                          <td className={theirs.length ? "" : "text-muted"}>{byKind(theirs) || "—"}</td>
                          <td className="hidden sm:table-cell">
                            {now ? (
                              <Link href={now.href} className="link doc-number">
                                {now.name}
                              </Link>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <Meter value={moved.get(p.id) ?? 0} max={max} label={`${p.name}: ${moved.get(p.id) ?? 0} unidades hoy`} />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
