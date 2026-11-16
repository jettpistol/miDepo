import Link from "next/link";
import type { ReactNode } from "react";
import { Icono, type NombreIcono } from "./Icono";

export function Encabezado({ titulo, bajada, volver, children }: { titulo: string; bajada?: ReactNode; volver?: { href: string; texto: string }; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {volver && (
          <Link href={volver.href} className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-suave hover:text-texto">
            <Icono nombre="flecha" className="size-4 rotate-180" />
            {volver.texto}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-balance">{titulo}</h1>
        {bajada && <p className="mt-1 text-[15px] text-suave">{bajada}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

const TONOS = {
  neutro: "bg-hundido text-suave",
  acento: "bg-acento-suave text-acento-texto",
  ok: "bg-ok-suave text-ok",
  alerta: "bg-alerta-suave text-alerta",
  peligro: "bg-peligro-suave text-peligro",
} as const;
export type Tono = keyof typeof TONOS;

export function Insignia({ tono = "neutro", children }: { tono?: Tono; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONOS[tono]}`}>{children}</span>;
}

export function Vacio({ icono = "ok", titulo, children }: { icono?: NombreIcono; titulo: string; children?: ReactNode }) {
  return (
    <div className="tarjeta flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-acento-suave text-acento-texto">
        <Icono nombre={icono} />
      </span>
      <p className="font-semibold">{titulo}</p>
      {children && <div className="max-w-md text-sm text-suave">{children}</div>}
    </div>
  );
}

export function Aviso({ tono = "acento", children }: { tono?: Tono; children: ReactNode }) {
  return <div className={`rounded-xl px-4 py-3 text-sm font-medium ${TONOS[tono]}`}>{children}</div>;
}

/** Barra de avance con el número al lado: "12 de 40". */
export function Avance({ hecho, total, unidad = "" }: { hecho: number; total: number; unidad?: string }) {
  const pct = total === 0 ? 0 : Math.min(100, Math.round((hecho / total) * 100));
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-hundido">
        <div className="h-full rounded-full bg-acento transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold whitespace-nowrap tabular-nums">
        {hecho} de {total}
        {unidad && ` ${unidad}`}
      </span>
    </div>
  );
}

export function Codigo({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-hundido px-1.5 py-0.5 font-mono text-[13px] font-semibold">{children}</span>;
}

export const fechaCorta = (d: Date) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(d);
export const plural = (n: number, uno: string, muchos: string) => `${n} ${n === 1 ? uno : muchos}`;
