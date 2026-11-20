import { barcodes } from "@/lib/barcodes";
import { articleName } from "@/lib/article";

/** Sheet of labels: 3 columns by 8 rows on an A4 page (24 per sheet). */
export function Labels({ items }: { items: { code: string; title?: string }[] }) {
  if (items.length === 0) return <p className="py-10 text-center">No hay etiquetas para imprimir con ese filtro.</p>;
  return (
    <div className="grid grid-cols-3 gap-[2mm]">
      {items.map((i) => (
        <div key={i.code} className="flex h-[33mm] break-inside-avoid flex-col items-center justify-center overflow-hidden rounded-[2mm] border border-dashed border-neutral-400 px-[2mm] text-center">
          <p className={`font-mono leading-none font-bold tracking-tight ${i.title ? "text-[11pt]" : "text-[20pt]"}`}>{i.code}</p>
          {i.title && <p className="mt-[0.5mm] line-clamp-1 w-full text-[7pt] leading-tight">{articleName(i.title)}</p>}
          <div className="mt-[1.5mm] h-[12mm] w-full [&>svg]:mx-auto [&>svg]:h-full [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: barcodes(i.code) }} />
        </div>
      ))}
    </div>
  );
}
