import { barras } from "@/lib/barras";

/** Plancha de etiquetas: 3 columnas por 8 filas en una hoja A4 (24 por hoja). */
export function Etiquetas({ items }: { items: { codigo: string; titulo?: string }[] }) {
  if (items.length === 0) return <p className="py-10 text-center">No hay etiquetas para imprimir con ese filtro.</p>;
  return (
    <div className="grid grid-cols-3 gap-[2mm]">
      {items.map((i) => (
        <div key={i.codigo} className="flex h-[33mm] break-inside-avoid flex-col items-center justify-center overflow-hidden rounded-[2mm] border border-dashed border-neutral-400 px-[2mm] text-center">
          <p className={`font-mono leading-none font-bold tracking-tight ${i.titulo ? "text-[11pt]" : "text-[20pt]"}`}>{i.codigo}</p>
          {i.titulo && <p className="mt-[0.5mm] line-clamp-1 w-full text-[7pt] leading-tight">{i.titulo}</p>}
          <div className="mt-[1.5mm] h-[12mm] w-full [&>svg]:mx-auto [&>svg]:h-full [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: barras(i.codigo) }} />
        </div>
      ))}
    </div>
  );
}
