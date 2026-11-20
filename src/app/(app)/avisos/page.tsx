import Link from "next/link";
import { NoticeRow } from "@/components/Bell";
import { ActionButton } from "@/components/ScanForm";
import { EmptyRow, PageHeader } from "@/components/ui";
import { inbox } from "@/lib/notifications";
import { requireSession } from "@/lib/session";
import { markAllRead } from "./actions";

export const metadata = { title: "Avisos" };

const SHOWN = 100;

export default async function Notices() {
  const { db, user } = await requireSession();
  const { unread, items } = await inbox(db, user.id, SHOWN);

  return (
    <>
      <PageHeader title="Avisos">
        <Link href="/cuenta#avisos" className="btn-soft">
          Elegir avisos
        </Link>
        {unread > 0 && (
          <ActionButton action={markAllRead} className="btn-soft" showOk={false} hotkey="secondary">
            Marcar todo como leído
          </ActionButton>
        )}
      </PageHeader>
      <div className="table-wrap max-w-3xl">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                Aviso {unread > 0 && <span className="font-normal">· {unread} sin leer</span>}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <EmptyRow columns={1} title="Sin avisos" />}
            {items.map((n) => (
              <tr key={n.id}>
                <td className="p-0! [&_.row]:px-2 sm:[&_.row]:px-3">
                  <NoticeRow n={n} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
