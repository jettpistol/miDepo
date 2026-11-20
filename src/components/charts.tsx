import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { ShelfMark } from "./ui";

/** A card on the home page: a title, an optional count and link, and its content. */
export function Card({ title, count, link, children, className = "" }: { title: string; count?: number; link?: { href: string; text: string }; children: ReactNode; className?: string }) {
  return (
    <section className={`panel min-w-0 p-4 ${className}`}>
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="flex items-baseline gap-2 text-sm font-semibold">
          {title}
          {count != null && <span className="text-xs font-medium text-muted tabular-nums">{count}</span>}
        </h2>
        {link && (
          <Link href={link.href} className="link text-[13px] whitespace-nowrap">
            {link.text}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/** A headline number: what it counts, and where to go to act on it. */
export function StatTile({ icon, value, label, href, tone = "neutral" }: { icon: IconName; value: number; label: string; href?: string; tone?: "neutral" | "accent" | "warn" }) {
  const box = { neutral: "bg-sunken text-muted", accent: "bg-accent-soft text-accent-text", warn: "bg-warn-soft text-warn" }[tone];
  const body = (
    <>
      <span className={`hidden size-10 shrink-0 place-items-center rounded-control sm:grid ${box}`}>
        <Icon name={icon} className="size-5" />
      </span>
      <span className="min-w-0">
        <span className={`block text-xl leading-tight font-semibold tabular-nums ${value === 0 ? "text-muted" : ""}`}>{value.toLocaleString("es-AR")}</span>
        <span className="block text-[13px] leading-snug text-muted">{label}</span>
      </span>
    </>
  );
  const cls = "panel flex items-center gap-3 px-4 py-3";
  return href ? (
    <Link href={href} className={`${cls} transition-colors duration-150 hover:border-accent-text/50 hover:bg-accent-soft/40`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * Orders by stage as one segmented bar: stages are in order, so one hue from light to dark.
 * The legend below names each stage with its count and links to its screen.
 */
export function StageBar({ stages }: { stages: { key: string; label: string; n: number; href?: string }[] }) {
  const total = stages.reduce((s, x) => s + x.n, 0);
  const shade = (i: number) => `color-mix(in oklab, var(--accent-text) ${Math.round(35 + (65 * i) / Math.max(1, stages.length - 1))}%, var(--surface))`;
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-sunken" role="img" aria-label={stages.map((s) => `${s.label}: ${s.n}`).join(", ")}>
        {stages.map((s, i) => s.n > 0 && <span key={s.key} title={`${s.label}: ${s.n}`} className="h-full first:rounded-l-full last:rounded-r-full" style={{ flexGrow: s.n, flexBasis: 0, minWidth: 4, background: shade(i) }} />)}
      </div>
      <ul className="mt-3 space-y-px">
        {stages.map((s, i) => {
          const row = (
            <>
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[2px]" style={{ background: shade(i) }} />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className={`font-semibold tabular-nums ${s.n === 0 ? "text-muted" : ""}`}>{s.n}</span>
              <span className="w-10 text-right text-xs text-muted tabular-nums">{total ? `${Math.round((s.n / total) * 100)}%` : "—"}</span>
            </>
          );
          return (
            <li key={s.key}>
              {s.href ? (
                <Link href={s.href} className="-mx-2 flex h-8 items-center gap-2.5 rounded-control px-2 text-sm transition-colors duration-150 hover:bg-sunken">
                  {row}
                </Link>
              ) : (
                <span className="-mx-2 flex h-8 items-center gap-2.5 px-2 text-sm">{row}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SERIES = [
  { key: "received", label: "Recibidas", color: "var(--series-1)" },
  { key: "picked", label: "Preparadas", color: "var(--series-2)" },
  { key: "shipped", label: "Despachadas", color: "var(--series-3)" },
] as const;

type Day = { key: string; label: string; received: number; picked: number; shipped: number };

/** Rounds the top of the axis up to a readable number: 10, 20, 50, 100, 200… */
const niceMax = (n: number) => {
  if (n <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(n));
  return ([1, 2, 5, 10].find((m) => m * p >= n) ?? 10) * p;
};

/**
 * Units per day, three series side by side. Hovering or focusing a day shows its numbers;
 * a table with the same numbers is there for screen readers.
 */
export function ActivityChart({ days }: { days: Day[] }) {
  const max = niceMax(Math.max(...days.flatMap((d) => [d.received, d.picked, d.shipped])));
  const empty = days.every((d) => d.received + d.picked + d.shipped === 0);
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-[2px]" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="relative grid grid-cols-[auto_1fr] gap-x-2" aria-hidden="true">
        <div className="flex h-36 flex-col justify-between text-right text-xs text-muted tabular-nums">
          <span className="-translate-y-1/2">{max.toLocaleString("es-AR")}</span>
          <span>{(max / 2).toLocaleString("es-AR")}</span>
          <span className="translate-y-1/2">0</span>
        </div>
        <div className="relative h-36 border-b border-line-strong">
          <span className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
          <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
          {empty && <p className="absolute inset-0 grid place-items-center"><span className="bg-surface px-2 text-sm text-muted">Sin movimientos en estos 7 días</span></p>}
          <div className="absolute inset-0 grid grid-cols-7">
            {days.map((d, i) => (
              <div key={d.key} tabIndex={0} className="group relative flex items-end justify-center gap-0.5 rounded-t-control outline-none hover:bg-sunken/70 focus-visible:bg-sunken">
                {SERIES.map((s) => {
                  const v = d[s.key];
                  return <span key={s.key} className="w-[clamp(4px,22%,12px)] rounded-t-[3px]" style={{ height: v ? `max(2px, ${(v / max) * 100}%)` : 0, background: s.color }} />;
                })}
                <div className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden w-36 rounded-control border border-line bg-surface p-2 text-xs shadow-floating group-hover:block group-focus-visible:block ${i > 4 ? "right-0" : i < 2 ? "left-0" : "left-1/2 -translate-x-1/2"}`}>
                  <p className="mb-1 font-semibold text-ink">{d.label}</p>
                  {SERIES.map((s) => (
                    <p key={s.key} className="flex items-center gap-1.5 text-muted">
                      <span className="size-2 rounded-[2px]" style={{ background: s.color }} />
                      <span className="flex-1">{s.label}</span>
                      <span className="font-semibold text-ink tabular-nums">{d[s.key].toLocaleString("es-AR")}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <span />
        <div className="grid grid-cols-7 pt-1 text-center text-xs text-muted">
          {days.map((d, i) => (
            <span key={d.key} className={`truncate ${i === 6 ? "font-semibold text-ink" : ""}`}>
              {/* On a phone only the day number fits: "13" instead of "vie 13". */}
              {i === 6 ? d.label : <><span className="hidden sm:inline">{d.label.split(" ")[0]} </span>{d.label.split(" ").at(-1)}</>}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Unidades por día, últimos 7 días</caption>
        <thead>
          <tr>
            <th>Día</th>
            {SERIES.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.key}>
              <td>{d.label}</td>
              {SERIES.map((s) => (
                <td key={s.key}>{d[s.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ZONE_COLOR: Record<string, string> = { receiving: "var(--zone-receiving)", returns: "var(--zone-returns)", damaged: "var(--zone-damaged)", missing: "var(--line-strong)" };
const ZONE_JOB: Record<string, string> = { receiving: "por reponer", returns: "por reponer", missing: "sin encontrar", damaged: "por dar de baja" };

/** Units waiting in each zone, as bars in the zone's own colour, beside its shelf mark. */
export function ZoneBars({ zones }: { zones: { code: string; type: string; units: number; href?: string }[] }) {
  const max = Math.max(1, ...zones.map((z) => z.units));
  return (
    <ul className="space-y-px">
      {zones.map((z) => {
        const row = (
          <>
            <span className="w-32 shrink-0">
              <ShelfMark code={z.code} />
            </span>
            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-sunken">
              <span className="block h-full rounded-full" style={{ width: z.units ? `max(4px, ${(z.units / max) * 100}%)` : 0, background: ZONE_COLOR[z.type] }} />
            </span>
            <span className="w-28 shrink-0 text-right text-sm">
              <strong className={`tabular-nums ${z.units === 0 ? "font-semibold text-muted" : ""}`}>{z.units.toLocaleString("es-AR")}</strong> <span className="text-xs text-muted">{ZONE_JOB[z.type]}</span>
            </span>
          </>
        );
        return (
          <li key={z.code}>
            {z.href ? (
              <Link href={z.href} className="-mx-2 flex h-9 items-center gap-3 rounded-control px-2 transition-colors duration-150 hover:bg-sunken">
                {row}
              </Link>
            ) : (
              <span className="-mx-2 flex h-9 items-center gap-3 px-2">{row}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A plain horizontal bar for one number among others (single series: no legend). */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 min-w-12 flex-1 overflow-hidden rounded-full bg-sunken" role="img" aria-label={label}>
        <span className="block h-full rounded-full bg-accent-text" style={{ width: value ? `max(4px, ${(value / Math.max(1, max)) * 100}%)` : 0 }} />
      </span>
      <span className={`w-12 text-right text-sm font-semibold tabular-nums ${value === 0 ? "text-muted" : ""}`}>{value.toLocaleString("es-AR")}</span>
    </span>
  );
}
