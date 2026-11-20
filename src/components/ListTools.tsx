import Link from "next/link";
import { Icon } from "./Icon";

/** Query parameters of a list screen. Empty values are dropped so links stay short. */
export type Params = Record<string, string | undefined>;

export const PAGE_SIZE = 50;
const fmt = (n: number) => n.toLocaleString("es-AR");

/** `/pedidos?estado=…&pagina=2`, leaving out empty values and page 1. */
export function listHref(base: string, params: Params, changes: Params = {}) {
  const merged = { ...params, ...changes };
  const q = new URLSearchParams(Object.entries(merged).filter((e): e is [string, string] => !!e[1] && !(e[0] === "pagina" && e[1] === "1")));
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

/** The page asked for in `?pagina=`: 1 or more. Past the last page the list is simply empty. */
export const requestedPage = (raw: string | undefined) => Math.max(1, Math.floor(Number(raw)) || 1);
export const paging = (page: number, size = PAGE_SIZE) => ({ limit: size, offset: (page - 1) * size });

/** "51–100 de 340" with Anterior / Siguiente. Shown only when there is more than one page. */
export function Pager({ base, params, page, total, size = PAGE_SIZE }: { base: string; params: Params; page: number; total: number; size?: number }) {
  if (total <= size) return null;
  const pages = Math.ceil(total / size);
  const step = (to: number, label: string, back: boolean) => {
    const inner = back ? (
      <>
        <Icon name="arrow" className="size-4 rotate-180" /> {label}
      </>
    ) : (
      <>
        {label} <Icon name="arrow" className="size-4" />
      </>
    );
    return to >= 1 && to <= pages ? (
      <Link href={listHref(base, params, { pagina: String(to) })} className="btn-sm" scroll={false}>
        {inner}
      </Link>
    ) : (
      <span className="btn-sm pointer-events-none opacity-55" aria-disabled="true">
        {inner}
      </span>
    );
  };
  return (
    <nav aria-label="Páginas" className="mt-3 flex items-center justify-between gap-3 text-sm text-muted">
      <span>
        {fmt((page - 1) * size + 1)}–{fmt(Math.min(page * size, total))} de {fmt(total)}
      </span>
      <span className="flex gap-2">
        {step(page - 1, "Anterior", true)}
        {step(page + 1, "Siguiente", false)}
      </span>
    </nav>
  );
}

/** Underlined tabs that filter a list through the address: Todos · Por preparar 4 · … */
export function FilterTabs({ base, params, name, value, tabs }: { base: string; params: Params; name: string; value: string; tabs: { value: string; label: string; count?: number }[] }) {
  return (
    <nav aria-label="Filtro" className="mb-3 flex gap-x-4 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <Link
            key={t.value}
            href={listHref(base, params, { [name]: t.value, pagina: undefined })}
            aria-current={on ? "page" : undefined}
            scroll={false}
            className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-0.5 text-sm whitespace-nowrap transition-colors duration-150 lg:min-h-8 ${on ? "border-accent-text font-bold text-accent-text" : "border-transparent font-medium text-muted hover:text-ink"}`}
          >
            {t.label}
            {t.count !== undefined && <span className="text-xs font-semibold tabular-nums">{fmt(t.count)}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
