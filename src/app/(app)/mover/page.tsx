import { ScanForm } from "@/components/ScanForm";
import { PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { moveAction } from "./actions";

export const metadata = { title: "Mover" };

export default async function Move() {
  await requireSession();
  return (
    <>
      <PageHeader title="Mover" />
      <div className="max-w-md">
        <ScanForm
          action={moveAction}
          context="move"
          fields={[
            { name: "source", label: "Desde", help: "Estante o zona" },
            { name: "product", label: "Libro", help: "Código, título o autor" },
            { name: "destination", label: "Hacia", help: "Estante o zona" },
          ]}
          quantity={1}
          button="Mover"
        />
      </div>
    </>
  );
}
