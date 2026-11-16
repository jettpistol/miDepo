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
      <div className="max-w-[72ch] text-base">
        <h1 className="text-[26px] leading-tight font-bold tracking-[-0.02em]">Resultados para “{q}”</h1>
        <p className="mt-1 mb-6 text-suave">{hallazgos.length === 0 ? "No encontré nada con esas palabras." : hallazgos.length === 1 ? "1 página del manual." : `${hallazgos.length} páginas del manual.`}</p>
        {hallazgos.length === 0 ? (
          <div className="border-y border-borde py-5 leading-relaxed">
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
          <ul className="lista">
            {hallazgos.map((h) => (
              <li key={h.pagina}>
                <Link href={`/ayuda/${h.pagina}`} className="group block px-2 py-4 transition-colors duration-150 hover:bg-hundido lg:px-3">
                  <span className="block text-lg font-bold text-acento-texto underline decoration-transparent underline-offset-[3px] transition-colors duration-150 group-hover:decoration-acento-texto">{h.titulo}</span>
                  <span className="mt-1 block text-[15px] leading-relaxed text-suave [&_mark]:rounded-rotulo [&_mark]:bg-alerta-suave [&_mark]:px-0.5 [&_mark]:font-semibold [&_mark]:text-texto" dangerouslySetInnerHTML={{ __html: h.extractoHtml }} />
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
  return <article className="manual" dangerouslySetInnerHTML={{ __html: pagina.html }} />;
}
