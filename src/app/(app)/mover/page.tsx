import { ScanForm } from "@/components/ScanForm";
import { PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { moveAction } from "./actions";
import { RecentMoves } from "./RecentMoves";

export const metadata = { title: "Mover" };

export default async function Move() {
  const { db, company, user } = await requireSession();
  return (
    <>
      <PageHeader title="Mover" />
      <div className="max-w-md">
        <ScanForm
          action={moveAction}
          context="move"
          fields={[
            { name: "source", label: "Origen", help: "Ubicación" },
            { name: "product", label: "Artículo", help: "Código, nombre o autor" },
            { name: "destination", label: "Destino", help: "Ubicación" },
          ]}
          quantity={1}
          button="Mover"
        />
      </div>
      <RecentMoves db={db} companyId={company.id} userId={user.id} />
    </>
  );
}
