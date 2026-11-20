import type { ReactNode } from "react";
import { requireSession } from "@/lib/session";
import { PrintButton } from "../(print)/PrintButton";

export const metadata = { title: "Imprimir etiquetas" };

/** Shipping labels for a thermal printer: one 100 × 150 mm label per page. Black and white. */
export default async function LabelLayout({ children }: { children: ReactNode }) {
  await requireSession();
  return (
    <div className="min-h-dvh bg-white text-black" style={{ colorScheme: "light" }}>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-accent px-4 py-2.5 text-on-accent sm:px-6">
        <p className="text-sm font-medium">Vista previa. Etiqueta de 10 × 15 cm, tamaño real (100 %), sin márgenes ni encabezados.</p>
        <PrintButton />
      </div>
      <div className="flex flex-col items-center gap-[6mm] p-[6mm] print:block print:p-0">{children}</div>
      <style>{`@page { size: 100mm 150mm; margin: 0; }`}</style>
    </div>
  );
}
