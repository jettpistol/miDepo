import Link from "next/link";
import { notFound } from "next/navigation";
import { buscar, leerPagina } from "@/lib/wiki";

type Props = { params: Promise<{ pagina?: string[] }>; searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ params, searchParams }: Props) {
  const q = (await searchParams).q?.trim();
  if (q) return { title: `"${q}" en el manual` };
  return { title: `${leerPagina((await params).pagina?.[0] ?? "Home")?.titulo ?? "Manual"} · Manual` };
}

export default async function Ayuda({ params, searchParams }: Props) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  if (q) {
    const hallazgos = buscar(q);
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resultados para “{q}”</h1>
        <p className="mt-1 mb-5 text-suave">{hallazgos.length === 0 ? "No encontré nada con esas palabras." : hallazgos.length === 1 ? "1 página del manual." : `${hallazgos.length} páginas del manual.`}</p>
        {hallazgos.length === 0 ? (
          <div className="tarjeta p-6 text-[15px]">
            <p className="font-semibold">Probá así:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-suave">
              <li>Usá una sola palabra: “faltante”, “PIN”, “etiquetas”.</li>
              <li>Buscá por lo que querés hacer: “guardar”, “contar”, “devolución”.</li>
              <li>
                O empezá por el{" "}
                <Link href="/ayuda" className="enlace">
                  inicio del manual
                </Link>
                .
              </li>
            </ul>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {hallazgos.map((h) => (
              <li key={h.pagina}>
                <Link href={`/ayuda/${h.pagina}`} className="tarjeta block p-4 hover:border-acento-texto/50">
                  <span className="block text-lg font-semibold text-acento-texto">{h.titulo}</span>
                  <span className="mt-1 block text-[15px] leading-relaxed text-suave [&_mark]:rounded [&_mark]:bg-alerta-suave [&_mark]:px-0.5 [&_mark]:font-semibold [&_mark]:text-texto" dangerouslySetInnerHTML={{ __html: h.extractoHtml }} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const pagina = leerPagina((await params).pagina?.[0] ?? "Home");
  if (!pagina) notFound();
  return <article className="manual tarjeta p-5 sm:p-8" dangerouslySetInnerHTML={{ __html: pagina.html }} />;
}
