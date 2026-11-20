import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { MAX_PAGE_LENGTH, pageTitles, readPage } from "@/lib/wiki";
import { Editor } from "./Editor";
import { restorePage, savePage } from "./actions";

type Props = { params: Promise<{ page: string }> };

export async function generateMetadata({ params }: Props) {
  return { title: `Editar ${(await params).page.replace(/-/g, " ")} · Manual` };
}

/** Administrators rewrite a manual page for their company. */
export default async function EditPage({ params }: Props) {
  const { company } = await requireSession("admin");
  const page = await readPage((await params).page, company.id);
  if (!page) notFound();
  return (
    <div className="max-w-none">
      <nav aria-label="Ruta" className="mb-1 flex items-center gap-1.5 text-sm text-muted">
        <Link href={`/ayuda/${page.name}`} className="transition-colors duration-150 hover:text-accent-text hover:underline">
          {page.title}
        </Link>
        <span aria-hidden="true">/</span>
      </nav>
      <h1 className="mb-4 text-[22px] leading-tight font-bold tracking-[-0.01em] lg:text-2xl lg:font-semibold">Editar página</h1>
      <Editor
        page={page.name}
        markdown={page.markdown}
        original={page.original}
        edited={Boolean(page.edit)}
        outdated={Boolean(page.edit?.outdated)}
        pages={await pageTitles(company.id)}
        maxLength={MAX_PAGE_LENGTH}
        save={savePage}
        restore={restorePage}
      />
    </div>
  );
}
