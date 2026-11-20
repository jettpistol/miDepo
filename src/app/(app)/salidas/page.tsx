import Link from "next/link";
import { NewButton } from "@/components/NewButton";
import { ActionForm } from "@/components/ScanForm";
import { Badge, EmptyRow, PageHeader, shortDate } from "@/components/ui";
import { TRANSFER_STATE } from "./state";
import { listTransfers, outsideLocations } from "@/lib/flows/transfers";
import { can, requireSession } from "@/lib/session";
import { DestinationSelect } from "./DestinationSelect";
import { create } from "./actions";

export const metadata = { title: "Salidas" };

export default async function Transfers() {
  const { db, company, user } = await requireSession();
  const [rows, places] = await Promise.all([listTransfers(db, company.id), outsideLocations(db, company.id)]);
  return (
    <>
      <PageHeader title="Salidas">
        <NewButton title="Nueva salida">
          <ActionForm action={create} button="Empezar" className="space-y-3 [&>button]:w-full">
            <div>
              <label htmlFor="destination" className="field-label">
                Destino
              </label>
              <DestinationSelect options={places.map((l) => ({ value: String(l.id), label: l.name ?? l.code }))} canCreate={can(user.role, "supervisor")} />
            </div>
          </ActionForm>
        </NewButton>
      </PageHeader>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Salida</th>
              <th>Destino</th>
              <th className="hidden text-right sm:table-cell">Salieron</th>
              <th className="hidden text-right sm:table-cell">Volvieron</th>
              <th className="hidden text-right md:table-cell">Vendidas</th>
              <th className="hidden md:table-cell">Salió</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow columns={7} title="Sin salidas" />}
            {rows.map(({ t, code, name, sent, returned, sold }) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/salidas/${t.id}`} className="link doc-number">
                    {t.number}
                  </Link>
                </td>
                <td>
                  <span className="font-medium">{name ?? code}</span>
                  <span className="block font-mono text-xs text-muted">{code}</span>
                </td>
                <td className="hidden text-right tabular-nums sm:table-cell">{sent}</td>
                <td className="hidden text-right tabular-nums sm:table-cell">{returned}</td>
                <td className="hidden text-right tabular-nums md:table-cell">{sold || "—"}</td>
                <td className="hidden whitespace-nowrap text-muted md:table-cell">{t.sentAt ? shortDate(t.sentAt) : "—"}</td>
                <td className="w-px">
                  <Badge tone={TRANSFER_STATE[t.status].tone}>{TRANSFER_STATE[t.status].label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
