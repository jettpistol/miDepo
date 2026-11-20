import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { Code } from "./ui";
import { articleName } from "@/lib/article";
import { setListView } from "@/app/(app)/stock/actions";

export type ListView = "cards" | "table";

/** List-size cover, made beforehand (src/lib/covers.ts). Without one, an empty frame of the same size. */
export function Cover({ productId, version, className = "h-20 w-14" }: { productId: number; version: number | null; className?: string }) {
  if (!version) return <span aria-hidden="true" className={`block shrink-0 rounded-label border border-line bg-sunken ${className}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/cover/${productId}?v=${version}`} alt="" width={56} height={80} loading="lazy" decoding="async" className={`block max-w-none shrink-0 rounded-label border border-line bg-sunken object-cover ${className}`} />;
}

/** Underlined tabs that switch every product list between cards and table, for this person. */
export function ViewSwitch({ view }: { view: ListView }) {
  const tab = (v: ListView, icon: "cards" | "bullets", label: string) => (
    <button
      name="view"
      value={v}
      aria-pressed={view === v}
      className={`-mb-px inline-flex min-h-11 cursor-pointer items-center gap-1.5 border-b-2 px-0.5 text-sm transition-colors duration-150 lg:min-h-8 ${view === v ? "border-accent-text font-bold text-accent-text" : "border-transparent font-medium text-muted hover:text-ink"}`}
    >
      <Icon name={icon} className="size-4" /> {label}
    </button>
  );
  return (
    <form action={setListView} aria-label="Vista" className="flex gap-4">
      {tab("cards", "cards", "Tarjetas")}
      {tab("table", "bullets", "Lista")}
    </form>
  );
}

export type CardItem = {
  product: { id: number; title: string; author: string | null; barcode: string; thumbVersion: number | null };
  quantity: number;
  /** Badges after the title (type of product). */
  extra?: ReactNode;
};

/** Products as cards with their cover: a ruled grid, flat like the tables. */
export function ProductCards({ items, empty }: { items: CardItem[]; empty?: ReactNode }) {
  return (
    <ul className="grid grid-cols-1 border-t border-line sm:grid-cols-2 sm:border-l xl:grid-cols-3 2xl:grid-cols-4">
      {items.length === 0 && <li className="col-span-full border-b border-line px-3 py-8 text-center sm:border-r lg:py-6">{empty}</li>}
      {items.map(({ product: p, quantity, extra }) => (
        <li key={p.id} className="relative flex gap-3 border-b border-line px-2 py-2 transition-colors duration-150 hover:bg-sunken/60 sm:border-r sm:px-3">
          <Cover productId={p.id} version={p.thumbVersion} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Link href={`/stock/${p.id}`} className="link line-clamp-2 font-semibold after:absolute after:inset-0">
              {articleName(p.title)}
            </Link>
            {p.author && <span className="truncate text-sm text-muted lg:text-xs">{p.author}</span>}
            <span className="mt-auto flex items-end justify-between gap-2 pt-1">
              <span className="flex min-w-0 flex-wrap items-center gap-1">
                <Code>{p.barcode}</Code>
                {extra}
              </span>
              <span className={`text-base leading-none font-bold tabular-nums ${quantity ? "" : "text-muted/60"}`} >
                {quantity}
                <span className="sr-only"> unidades</span>
              </span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
