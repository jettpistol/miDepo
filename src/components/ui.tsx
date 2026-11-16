import Link from "next/link";
import type { ReactNode } from "react";
import { Icono } from "./Icono";

export function Encabezado({ titulo, bajada, volver, children }: { titulo: string; bajada?: ReactNode; volver?: { href: string; texto: string }; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {volver && (
          <Link href={volver.href} className="mb-1.5 inline-flex items-center gap-1 text-sm font-semibold text-suave transition-colors duration-150 hover:text-acento-texto">
            <Icono nombre="flecha" className="size-4 rotate-180" />
            {volver.texto}
          </Link>
        )}
        <h1 className="text-[26px] leading-tight font-bold tracking-[-0.02em] lg:text-[28px]">{titulo}</h1>
        {bajada && <p className="mt-1 max-w-[70ch] text-[15px] text-suave">{bajada}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

const TONOS = {
  neutro: "border-borde bg-hundido text-suave",
  acento: "border-acento-texto/30 bg-acento-suave text-acento-texto",
  ok: "border-ok/30 bg-ok-suave text-ok",
  alerta: "border-alerta/30 bg-alerta-suave text-alerta",
  peligro: "border-peligro/30 bg-peligro-suave text-peligro",
} as const;
export type Tono = keyof typeof TONOS;

export function Insignia({ tono = "neutro", children }: { tono?: Tono; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-rotulo border px-1.5 py-0.5 text-xs leading-tight font-semibold whitespace-nowrap ${TONOS[tono]}`}>{children}</span>;
}

/** Estado vacío: dice qué falta y cómo aparece, sin adornos. */
export function Vacio({ titulo, children }: { icono?: unknown; titulo: string; children?: ReactNode }) {
  return (
    <div className="border-y border-borde px-2 py-8 lg:px-3">
      <p className="font-bold">{titulo}</p>
      {children && <div className="mt-1 max-w-[60ch] text-sm text-suave">{children}</div>}
    </div>
  );
}

export function Aviso({ tono = "acento", children }: { tono?: Tono; children: ReactNode }) {
  return <div className={`rounded-control border px-4 py-3 text-sm font-medium ${TONOS[tono]}`}>{children}</div>;
}

/** Barra de avance con el número al lado: "12 de 40". */
export function Avance({ hecho, total, unidad = "" }: { hecho: number; total: number; unidad?: string }) {
  const pct = total === 0 ? 0 : Math.min(100, Math.round((hecho / total) * 100));
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-borde" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={hecho}>
        <div className={`h-full transition-[width] duration-200 ${pct === 100 ? "bg-ok" : "bg-acento-texto"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold whitespace-nowrap tabular-nums">
        {hecho} de {total}
        {unidad && ` ${unidad}`}
      </span>
    </div>
  );
}

const ZONAS: Record<string, string> = { RECEPCION: "recepcion", DEVOLUCIONES: "devoluciones", DANADOS: "danados", SALDOS: "saldos", PREPARACION: "preparacion" };
const NOMBRE_ZONA: Record<string, string> = { RECEPCION: "RECEPCIÓN", DEVOLUCIONES: "DEVOLUCIONES", DANADOS: "DAÑADOS", SALDOS: "SALDOS", PREPARACION: "PREPARACIÓN" };

/**
 * El tejuelo: el código de un estante escrito como la etiqueta del lomo de un libro, con cada
 * tramo (pasillo, estante, nivel) en su casilla. Las zonas llevan una banda de color.
 */
export function Tejuelo({ codigo, tam = "sm", sobreAcento = false, className = "" }: { codigo: string | null | undefined; tam?: "sm" | "md" | "xl"; sobreAcento?: boolean; className?: string }) {
  if (!codigo) return <span className="text-suave">—</span>;
  const zona = ZONAS[codigo];
  const tramos = zona ? [NOMBRE_ZONA[codigo]] : codigo.split(/[^0-9A-Za-zÑñ]+/).filter(Boolean);
  const clases = ["tejuelo", tam === "md" && "tejuelo-md", tam === "xl" && "tejuelo-xl", sobreAcento && "tejuelo-sobre-acento", className].filter(Boolean).join(" ");
  return (
    <span className={clases} data-zona={zona} aria-label={`Ubicación ${codigo}`} title={codigo}>
      {zona && <span className="tejuelo-banda" aria-hidden="true" />}
      {tramos.map((t, i) => (
        <span key={i} aria-hidden="true">
          {t}
        </span>
      ))}
    </span>
  );
}

/** Un código que no es un estante: ISBN, código interno. */
export function Codigo({ children }: { children: ReactNode }) {
  return <span className="codigo">{children}</span>;
}

export const fechaCorta = (d: Date) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(d);
export const plural = (n: number, uno: string, muchos: string) => `${n} ${n === 1 ? uno : muchos}`;
