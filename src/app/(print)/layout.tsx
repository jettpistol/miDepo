import type { ReactNode } from "react";
import { requireSession } from "@/lib/session";
import { PrintButton } from "./PrintButton";

export const metadata = { title: "Imprimir" };

/** Pages meant for A4 paper on an ordinary printer. Always black and white. */
export default async function PrintLayout({ children }: { children: ReactNode }) {
  await requireSession();
  return (
    <div className="min-h-dvh bg-white text-black" style={{ colorScheme: "light" }}>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-accent px-4 py-2.5 text-on-accent sm:px-6">
        <p className="text-sm font-medium">Vista previa. Imprime en hoja A4, tamaño real (100 %), sin encabezados del navegador.</p>
        <PrintButton />
      </div>
      <div className="mx-auto max-w-[210mm] p-[8mm] print:max-w-none print:p-0">{children}</div>
      <style>{`@page { size: A4; margin: 8mm; }`}</style>
    </div>
  );
}
