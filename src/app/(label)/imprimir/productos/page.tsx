import { Icon } from "@/components/Icon";
import { PrintView, type PrintParams } from "../../PrintView";

/**
 * Item labels. With `recepcion`, one per unit received there, ISBN or not (covers the scanner
 * cannot read, reprints that share an ISBN). With `q`, articles without ISBN by name (grapas, packs).
 */
export default async function ProductLabels({ searchParams }: { searchParams: Promise<PrintParams & { q?: string; recepcion?: string }> }) {
  const sp = await searchParams;
  const receivingId = Number(sp.recepcion);
  if (Number.isInteger(receivingId) && receivingId > 0) return <PrintView source={`receiving:${receivingId}`} params={sp} />;
  const q = (sp.q ?? "").trim();
  return (
    <PrintView source={`products:${q}`} params={sp}>
      <form className="field-group search-box mx-4 mt-4 max-w-xl" role="search">
        <input name="q" defaultValue={q} placeholder="Artículos sin ISBN, por nombre" aria-label="Buscar por nombre" className="field" />
        <button className="btn" aria-label="Buscar">
          <Icon name="stock" />
        </button>
      </form>
    </PrintView>
  );
}
