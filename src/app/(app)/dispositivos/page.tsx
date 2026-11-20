import Link from "next/link";
import { alias } from "drizzle-orm/pg-core";
import { desc, eq } from "drizzle-orm";
import { printLog, users, workstations } from "@/db/schema";
import { InfoHint } from "@/components/Hint";
import { NewButton } from "@/components/NewButton";
import { RowMenu } from "@/components/RowMenu";
import { ActionButton, ActionForm } from "@/components/ScanForm";
import { Select } from "@/components/Select";
import { Badge, EmptyRow, PageHeader, shortDate } from "@/components/ui";
import { companyPrinters, FAULT_TEXT, sizeProblem, targetFor } from "@/lib/flows/printers";
import { KIND_ORDER, LABEL_KINDS } from "@/lib/labels/kinds";
import { LANGUAGE_NAME, PRINTER_MODELS } from "@/lib/labels/models";
import { SIZES } from "@/lib/labels/sizes";
import { can, requireSession } from "@/lib/session";
import { currentWorkstation } from "@/lib/workstation";
import { deactivate, newPrinter, reactivate, rename } from "./actions";
import { AssignRow } from "./AssignRow";
import { BrowserDevices } from "./BrowserDevices";
import { FaultSelect } from "./FaultSelect";
import { ScannerCheck } from "./ScannerCheck";

export const metadata = { title: "Dispositivos" };

const CONNECTION = { dialog: "Diálogo del sistema", demo: "Demo" } as const;

/** This computer's printers and scanner, what the browser can reach, and the company's printers and computers. */
export default async function Devices() {
  const { db, company, user } = await requireSession();
  const boss = can(user.role, "supervisor");
  const w = await currentWorkstation(db, company.id);
  // Demo printers only while test mode is on.
  const all = (await companyPrinters(db, company.id)).filter((p) => p.connection !== "demo" || p.active);
  const usable = all.filter((p) => p.active);
  const kinds = KIND_ORDER.filter((k) => k !== "test");
  const targets = await Promise.all(kinds.map((k) => targetFor(db, company.id, w?.id ?? null, k)));
  const printerOptions = [
    { value: "dialogo", label: "Diálogo del sistema", thermal: false },
    ...usable.map((p) => ({ value: String(p.id), label: p.name, detail: p.connection === "demo" ? `Demo · ${LANGUAGE_NAME[p.language]}` : (p.model ?? undefined), thermal: p.language !== "page" })),
  ];
  const lastUser = alias(users, "last_user");
  const computers = boss
    ? await db.select({ w: workstations, who: lastUser.name }).from(workstations).leftJoin(lastUser, eq(lastUser.id, workstations.lastUserId)).where(eq(workstations.companyId, company.id)).orderBy(desc(workstations.lastSeenAt)).limit(20)
    : [];
  const lastJobs = await db.select({ printerId: printLog.printerId, at: printLog.createdAt, error: printLog.error }).from(printLog).where(eq(printLog.companyId, company.id)).orderBy(desc(printLog.id)).limit(200);
  const lastOf = (id: number) => lastJobs.find((j) => j.printerId === id);

  const section = "grid gap-x-10 gap-y-4 py-7 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-x-8";

  return (
    <>
      <PageHeader title="Dispositivos" subtitle={w ? `${w.name} · ${w.agent ?? ""}` : "Equipo sin registrar"} />
      <div className="divide-y divide-line border-y border-line">
        <section id="equipo" className={section}>
          <h2 className="section-title flex items-center gap-1 self-start">
            Este equipo
            <InfoHint text="Se registra al imprimir o al guardar una impresora. Cada navegador es un equipo." />
          </h2>
          <div className="max-w-sm">
            {boss ? (
              <ActionForm action={rename} button="Guardar nombre" resetOnOk={false} attached>
                <label htmlFor="ws-name" className="sr-only">
                  Nombre del equipo
                </label>
                <input id="ws-name" name="name" defaultValue={w?.name ?? ""} placeholder="Muelle, Empaque 1…" maxLength={40} className="field" required />
              </ActionForm>
            ) : (
              <p className="text-sm">{w?.name ?? "Sin registrar"}</p>
            )}
          </div>
        </section>

        <section id="etiquetas" className={section}>
          <h2 className="section-title flex items-center gap-1 self-start">
            Impresora por etiqueta
            {boss && <InfoHint text="Se guarda al elegir. El diálogo del sistema imprime con cualquier impresora instalada en Windows o Android." />}
          </h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Etiqueta</th>
                  <th>Impresora</th>
                  <th className="hidden sm:table-cell">Tamaño</th>
                  <th className="hidden w-px sm:table-cell" />
                </tr>
              </thead>
              <tbody>
                {kinds.map((k, i) => (
                  <AssignRow
                    key={k}
                    kind={k}
                    name={LABEL_KINDS[k].name}
                    printers={printerOptions}
                    sizes={SIZES.filter((s) => !sizeProblem(null, k, s.id)).map((s) => ({ value: s.id, label: s.name, sheet: Boolean(s.sheet) }))}
                    printerId={targets[i].printer ? String(targets[i].printer!.id) : "dialogo"}
                    sizeId={targets[i].sizeId}
                    canEdit={boss}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="lector" className={section}>
          <h2 className="section-title flex items-center gap-1 self-start">
            Lector
            <InfoHint text="Un lector USB o Bluetooth escribe como un teclado: el navegador no lo ve como dispositivo. Se reconoce por la velocidad." />
          </h2>
          <ScannerCheck />
        </section>

        <section id="conexiones" className={section}>
          <h2 className="section-title flex items-center gap-1 self-start">
            Conexiones
            <InfoHint text="Impresión directa por USB, serie o Bluetooth: en una próxima versión. Hoy se imprime con el diálogo del sistema o con las impresoras demo." />
          </h2>
          <BrowserDevices />
        </section>

        <section id="impresoras" className={section}>
          <div className="flex items-start justify-between gap-3 lg:block">
            <h2 className="section-title">Impresoras</h2>
            {boss && (
              <div className="lg:mt-3">
                <NewButton title="Nueva impresora">
                  <ActionForm action={newPrinter} button="Agregar">
                    <div>
                      <label htmlFor="printer-name" className="field-label">
                        Nombre
                      </label>
                      <input id="printer-name" name="name" placeholder="Zebra del muelle" maxLength={60} className="field" required />
                    </div>
                    <div>
                      <label htmlFor="printer-model" className="field-label">
                        Modelo
                      </label>
                      <Select id="printer-model" name="model" required options={PRINTER_MODELS.map((m) => ({ value: m.id, label: m.name, detail: m.status === "solo diálogo" ? "Solo diálogo" : LANGUAGE_NAME[m.language] }))} />
                    </div>
                  </ActionForm>
                </NewButton>
              </div>
            )}
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th className="hidden md:table-cell">Modelo</th>
                  <th>Conexión</th>
                  <th className="hidden sm:table-cell">Lenguaje</th>
                  <th>Estado</th>
                  <th className="hidden lg:table-cell">Último trabajo</th>
                  <th className="w-px" />
                </tr>
              </thead>
              <tbody>
                {all.length === 0 && <EmptyRow columns={7} title="Sin impresoras" />}
                {all.map((p) => {
                  const last = lastOf(p.id);
                  return (
                    <tr key={p.id} className={p.active ? "" : "text-muted"}>
                      <td className="font-medium">
                        {p.connection === "demo" ? (
                          <Link href={`/dispositivos/impresora/${p.id}`} className="link">
                            {p.name}
                          </Link>
                        ) : (
                          p.name
                        )}
                      </td>
                      <td className="hidden md:table-cell">{p.model ?? "—"}</td>
                      <td>{CONNECTION[p.connection]}</td>
                      <td className="hidden whitespace-nowrap sm:table-cell">
                        {LANGUAGE_NAME[p.language]}
                        {p.language !== "page" && ` · ${p.dpi} dpi`}
                      </td>
                      <td>
                        {!p.active ? (
                          <Badge>{p.connection === "demo" ? "Modo de prueba desactivado" : "Desactivada"}</Badge>
                        ) : p.connection === "demo" && boss ? (
                          <FaultSelect id={p.id} value={p.fault ?? ""} options={[{ value: "", label: "Lista" }, ...Object.entries(FAULT_TEXT).map(([v, l]) => ({ value: v, label: l }))]} />
                        ) : p.fault ? (
                          <Badge tone="danger">{FAULT_TEXT[p.fault]}</Badge>
                        ) : (
                          <Badge tone="ok">Lista</Badge>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap text-muted lg:table-cell">
                        {last ? (
                          <>
                            {shortDate(last.at)}
                            {last.error && (
                              <>
                                {" "}
                                <Badge tone="danger">Falló</Badge>
                              </>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {boss && p.connection !== "demo" && (
                          <RowMenu label={`Opciones de ${p.name}`}>
                            {p.active ? (
                              <ActionButton action={deactivate} hiddenFields={{ id: p.id }} className="menu-item">
                                Desactivar
                              </ActionButton>
                            ) : (
                              <ActionButton action={reactivate} hiddenFields={{ id: p.id }} className="menu-item">
                                Reactivar
                              </ActionButton>
                            )}
                          </RowMenu>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {boss && (
          <section id="equipos" className={section}>
            <h2 className="section-title">Equipos</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th className="hidden sm:table-cell">Navegador</th>
                    <th className="hidden md:table-cell">Último usuario</th>
                    <th>Última vez</th>
                  </tr>
                </thead>
                <tbody>
                  {computers.length === 0 && <EmptyRow columns={4} title="Sin equipos registrados" />}
                  {computers.map(({ w: x, who }) => (
                    <tr key={x.id}>
                      <td className="font-medium">
                        {x.name}
                        {x.id === w?.id && (
                          <>
                            {" "}
                            <Badge tone="accent">Este</Badge>
                          </>
                        )}
                      </td>
                      <td className="hidden sm:table-cell">{x.agent ?? "—"}</td>
                      <td className="hidden md:table-cell">{who ?? "—"}</td>
                      <td className="whitespace-nowrap text-muted">{shortDate(x.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
