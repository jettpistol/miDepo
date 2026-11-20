import { ScanForm } from "@/components/ScanForm";
import { FilterTabs } from "@/components/ListTools";
import { PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { moveAction, moveAllAction } from "./actions";
import { RecentMoves } from "./RecentMoves";

export const metadata = { title: "Mover" };

export default async function Move({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const { db, company, user } = await requireSession();
  const all = (await searchParams).modo === "todo";
  return (
    <>
      <PageHeader title="Mover" />
      <FilterTabs
        base="/mover"
        params={{}}
        name="modo"
        value={all ? "todo" : ""}
        tabs={[
          { value: "", label: "Un artículo" },
          { value: "todo", label: "Toda la ubicación" },
        ]}
      />
      <div className="max-w-md">
        {all ? (
          <ScanForm
            key="all"
            action={moveAllAction}
            context="move-all"
            fields={[
              { name: "source", label: "Origen", help: "Ubicación" },
              { name: "destination", label: "Destino", help: "Ubicación" },
            ]}
            button="Mover todo"
          />
        ) : (
          <ScanForm
            key="one"
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
        )}
      </div>
      <RecentMoves db={db} companyId={company.id} userId={user.id} />
    </>
  );
}
