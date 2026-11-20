import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { hotkey } from "@/lib/hotkeys";
import { InfoHint } from "./Hint";

/** `meta` sits on the subtitle's line: facts about the record, such as its assignee. */
export function PageHeader({ title, subtitle, meta, back, children }: { title: ReactNode; subtitle?: ReactNode; meta?: ReactNode; back?: { href: string; text: string }; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 lg:mb-5">
      <div className="min-w-0">
        {back && (
          <nav aria-label="Ruta" className="mb-1 flex items-center gap-1.5 text-sm text-muted">
            <Link href={back.href} {...hotkey("back", `Volver a ${back.text}`)} className="transition-colors duration-150 hover:text-accent-text hover:underline">
              {back.text}
            </Link>
            <span aria-hidden="true">/</span>
          </nav>
        )}
        <h1 className="text-[22px] leading-tight font-bold tracking-[-0.01em] lg:text-2xl lg:font-semibold">{title}</h1>
        {(subtitle || meta) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-muted lg:text-sm">
            {subtitle && <p className="max-w-[70ch]">{subtitle}</p>}
            {meta && <div className="text-ink">{meta}</div>}
          </div>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

const TONES = {
  neutral: "border-line bg-sunken text-muted",
  accent: "border-accent-text/30 bg-accent-soft text-accent-text",
  ok: "border-ok/30 bg-ok-soft text-ok",
  warn: "border-warn/30 bg-warn-soft text-warn",
  danger: "border-danger/30 bg-danger-soft text-danger",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-label border px-1.5 py-0.5 text-xs leading-tight font-semibold whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
}

/** Empty state: says what is missing and how it will appear, without decoration. */
export function EmptyState({ title, children }: { icon?: unknown; title: string; children?: ReactNode }) {
  return (
    <div className="border-y border-line px-2 py-8 lg:rounded-control lg:border lg:px-4 lg:py-6">
      <p className="flex items-center gap-1.5 font-bold">
        {title}
        {children && <InfoHint text={children} />}
      </p>
    </div>
  );
}

/** The single row of an empty table: the table keeps its columns, and says what is missing. */
export function EmptyRow({ columns, title, children }: { columns: number; title: string; children?: ReactNode }) {
  return (
    <tr className="hover:bg-transparent!">
      <td colSpan={columns} className="px-3 py-8 text-center lg:py-6">
        <p className="inline-flex items-center gap-1.5 font-semibold">
          {title}
          {children && <InfoHint text={children} />}
        </p>
      </td>
    </tr>
  );
}

export function Notice({ tone = "accent", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={`rounded-control border px-4 py-3 text-sm font-medium ${TONES[tone]}`}>{children}</div>;
}

/** Progress bar with the number beside it: "12 de 40". */
export function Progress({ done, total, unit = "" }: { done: number; total: number; unit?: string }) {
  const pct = total === 0 ? 0 : Math.min(100, Math.round((done / total) * 100));
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className={`h-full transition-[width] duration-200 ${pct === 100 ? "bg-ok" : "bg-accent-text"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="min-w-[9ch] text-right text-sm font-semibold whitespace-nowrap tabular-nums">
        {done} de {total}
        {unit && ` ${unit}`}
      </span>
    </div>
  );
}

const ZONES: Record<string, string> = { RECEPCION: "receiving", DEVOLUCIONES: "returns", FALTANTES: "missing", DANADOS: "damaged", SALDOS: "clearance", PREPARACION: "staging" };
const ZONE_NAME: Record<string, string> = { RECEPCION: "RECEPCIÓN", DEVOLUCIONES: "DEVOLUCIONES", FALTANTES: "FALTANTES", DANADOS: "DAÑADOS", SALDOS: "SALDOS", PREPARACION: "PREPARACIÓN" };

/**
 * The shelf mark (tejuelo): a shelf's code written like the label on a book's spine, with each
 * segment (aisle, shelf, level) in its own cell. Zones carry a colour band.
 */
export function ShelfMark({ code, size = "sm", onAccent = false, className = "" }: { code: string | null | undefined; size?: "sm" | "md" | "xl"; onAccent?: boolean; className?: string }) {
  if (!code) return <span className="text-muted">—</span>;
  const zone = ZONES[code];
  const segments = zone ? [ZONE_NAME[code]] : code.split(/[^0-9A-Za-zÑñ]+/).filter(Boolean);
  const classes = ["shelfmark", size === "md" && "shelfmark-md", size === "xl" && "shelfmark-xl", onAccent && "shelfmark-on-accent", className].filter(Boolean).join(" ");
  return (
    <span className={classes} data-zone={zone} aria-label={`Ubicación ${code}`} title={code}>
      {zone && <span className="shelfmark-band" aria-hidden="true" />}
      {segments.map((t, i) => (
        <span key={i} aria-hidden="true">
          {t}
        </span>
      ))}
    </span>
  );
}

/** A code that is not a shelf: ISBN, internal code. */
export function Code({ children }: { children: ReactNode }) {
  return <span className="code-chip">{children}</span>;
}

export const shortDate = (d: Date) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(d);
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
