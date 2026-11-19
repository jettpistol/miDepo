import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { shortDate } from "@/components/ui";
import { currentSession } from "@/lib/session";
import { search, readPage } from "@/lib/wiki";

type Props = { params: Promise<{ page?: string[] }>; searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ params, searchParams }: Props) {
  const q = (await searchParams).q?.trim();
  if (q) return { title: `"${q}" en el manual` };
  const s = await currentSession();
  return { title: `${(await readPage((await params).page?.[0] ?? "Home", s?.company.id))?.title ?? "Manual"} · Manual` };
}

export default async function Help({ params, searchParams }: Props) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const s = await currentSession();
  if (q) {
    const hits = await search(q, s?.company.id);
    return (
      <div className="max-w-[72ch] text-base">
        <h1 className="text-[22px] leading-tight font-bold tracking-[-0.01em] lg:text-2xl lg:font-semibold">Resultados para “{q}”</h1>
        <p className="mt-1 mb-6 text-muted">{hits.length === 0 ? "No hay resultados para esas palabras." : hits.length === 1 ? "1 página del manual." : `${hits.length} páginas del manual.`}</p>
        {hits.length === 0 ? (
          <div className="border-y border-line py-5 leading-relaxed">
            <p className="font-semibold">Prueba así:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              <li>Usa una sola palabra: “faltante”, “PIN”, “etiquetas”.</li>
              <li>Busca por lo que quieres hacer: “guardar”, “contar”, “devolución”.</li>
              <li>
                O empieza por el{" "}
                <Link href="/ayuda" className="link">
                  inicio del manual
                </Link>
                .
              </li>
            </ul>
          </div>
        ) : (
          <ul className="ruled-list">
            {hits.map((h) => (
              <li key={h.page}>
                <Link href={`/ayuda/${h.page}`} className="group block px-2 py-4 transition-colors duration-150 hover:bg-sunken lg:px-3">
                  <span className="block text-lg font-bold text-accent-text underline decoration-transparent underline-offset-[3px] transition-colors duration-150 group-hover:decoration-accent-text">{h.title}</span>
                  <span className="mt-1 block text-[15px] leading-relaxed text-muted [&_mark]:rounded-label [&_mark]:bg-warn-soft [&_mark]:px-0.5 [&_mark]:font-semibold [&_mark]:text-ink" dangerouslySetInnerHTML={{ __html: h.excerptHtml }} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const page = await readPage((await params).page?.[0] ?? "Home", s?.company.id);
  if (!page) notFound();
  const admin = s?.user.role === "admin";
  return (
    <>
      {(admin || page.edit) && (
        <div className="no-print mb-4 flex max-w-[72ch] flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm text-muted">
          {page.edit && <span className="mr-auto">{`Versión de ${s!.company.name} · editada por ${page.edit.by} el ${shortDate(page.edit.at)}`}</span>}
          {admin && (
            <Link href={`/ayuda/editar/${page.name}`} className="btn-soft">
              <Icon name="edit" className="size-4" />
              Editar
            </Link>
          )}
        </div>
      )}
      <article className="manual" dangerouslySetInnerHTML={{ __html: page.html }} />
    </>
  );
}
