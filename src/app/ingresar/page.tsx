import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sesionActual } from "@/lib/sesion";
import { Marca } from "@/components/Marca";
import { Ingreso } from "./Ingreso";

export const metadata: Metadata = { title: "Ingresar" };

export default async function Pagina() {
  if (await sesionActual()) redirect("/");
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="flex flex-col justify-between bg-acento px-6 py-8 text-sobre-acento lg:px-14 lg:py-12">
        <Marca grande />
        <div className="my-8 max-w-md lg:my-0">
          <h1 className="text-3xl leading-tight font-bold tracking-tight text-balance lg:text-5xl">El depósito de libros, ordenado.</h1>
          <p className="mt-4 text-base opacity-80 lg:text-lg">Cada título en su estante, cada pedido en su caja. La oficina sigue trabajando en Fierro como siempre.</p>
        </div>
        <p className="hidden text-sm opacity-60 lg:block">Recepción · Guardado · Picking · Empaque · Devoluciones · Conteos</p>
      </section>
      <section className="flex items-start justify-center px-6 py-10 lg:items-center">
        <div className="w-full max-w-sm">
          <h2 className="mb-5 text-xl font-bold">Ingresar</h2>
          <Ingreso />
        </div>
      </section>
    </div>
  );
}
