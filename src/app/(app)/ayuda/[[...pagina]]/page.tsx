import { notFound } from "next/navigation";
import { requerir } from "@/lib/sesion";
import { leerIndice, leerPagina } from "@/lib/wiki";

export async function generateMetadata({ params }: { params: Promise<{ pagina?: string[] }> }) {
  return { title: leerPagina((await params).pagina?.[0] ?? "Home")?.titulo ?? "Ayuda" };
}

export default async function Ayuda({ params }: { params: Promise<{ pagina?: string[] }> }) {
  await requerir();
  const pagina = leerPagina((await params).pagina?.[0] ?? "Home");
  if (!pagina) notFound();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_15rem] lg:items-start">
      <article className="manual tarjeta min-w-0 p-5 sm:p-8" dangerouslySetInnerHTML={{ __html: pagina.html }} />
      <aside className="manual manual-indice tarjeta p-4 text-sm lg:sticky lg:top-6" aria-label="Índice del manual" dangerouslySetInnerHTML={{ __html: leerIndice() }} />
    </div>
  );
}
