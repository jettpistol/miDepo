"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ItemMenu } from "@/lib/menu";
import { Icono } from "./Icono";

const activo = (ruta: string, href: string) => (href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(href + "/"));

/** Franja de secciones bajo la barra azul (computadora). */
export function Secciones({ grupos }: { grupos: { grupo: string; items: ItemMenu[] }[] }) {
  const ruta = usePathname();
  return (
    <nav className="no-imprimir hidden border-b border-borde bg-hundido lg:block" aria-label="Menú principal">
      <div className="mx-auto flex max-w-[1360px] items-stretch overflow-x-auto px-6 xl:px-10">
        {grupos.map((g, n) => (
          <ul key={g.grupo} aria-label={g.grupo} className={`flex items-stretch ${n > 0 ? "ml-3 border-l border-borde pl-3" : "-ml-3"}`}>
            {g.items.map((i) => {
              const on = activo(ruta, i.href);
              return (
                <li key={i.href} className="flex">
                  <Link
                    href={i.href}
                    aria-current={on ? "page" : undefined}
                    title={i.ayuda}
                    className={`relative flex items-center px-3 py-3 text-sm whitespace-nowrap transition-colors duration-150 ${on ? "font-bold text-acento-texto after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-acento-texto" : "font-medium text-suave hover:text-texto"}`}
                  >
                    {i.nombre}
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </nav>
  );
}

const BARRA: ItemMenu[] = [
  { href: "/", nombre: "Inicio", icono: "inicio", ayuda: "" },
  { href: "/picking", nombre: "Picking", icono: "picking", ayuda: "" },
  { href: "/recepcion", nombre: "Recibir", icono: "recepcion", ayuda: "" },
  { href: "/stock", nombre: "Stock", icono: "stock", ayuda: "" },
  { href: "/mas", nombre: "Más", icono: "mas", ayuda: "" },
];

/** Accesos rápidos al pie (teléfono). */
export function BarraInferior() {
  const ruta = usePathname();
  const enBarra = BARRA.slice(0, 4).some((i) => activo(ruta, i.href));
  return (
    <nav className="no-imprimir fixed inset-x-0 bottom-0 z-30 border-t border-borde-fuerte bg-superficie pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Accesos rápidos">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {BARRA.map((i) => {
          const on = i.href === "/mas" ? !enBarra : activo(ruta, i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center gap-0.5 py-2 text-xs ${on ? "font-bold text-acento-texto before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:bg-acento-texto" : "font-medium text-suave"}`}>
                <Icono nombre={i.icono} className="size-6" />
                {i.nombre}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
