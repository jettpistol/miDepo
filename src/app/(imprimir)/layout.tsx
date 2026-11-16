import type { ReactNode } from "react";
import { requerir } from "@/lib/sesion";
import { BotonImprimir } from "./BotonImprimir";

export const metadata = { title: "Imprimir" };

/** Páginas pensadas para hoja A4 en una impresora común. Siempre en blanco y negro. */
export default async function Imprimir({ children }: { children: ReactNode }) {
  await requerir();
  return (
    <div className="min-h-dvh bg-white text-black" style={{ colorScheme: "light" }}>
      <div className="no-imprimir sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-acento px-4 py-2.5 text-sobre-acento sm:px-6">
        <p className="text-sm font-medium">Vista previa. Imprimí en hoja A4, tamaño real (100 %), sin encabezados del navegador.</p>
        <BotonImprimir />
      </div>
      <div className="mx-auto max-w-[210mm] p-[8mm] print:max-w-none print:p-0">{children}</div>
      <style>{`@page { size: A4; margin: 8mm; }`}</style>
    </div>
  );
}
