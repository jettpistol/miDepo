"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ItemMenu } from "@/lib/menu";
import { Icono } from "./Icono";

const activo = (ruta: string, href: string) => (href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(href + "/"));

export function Lateral({ grupos }: { grupos: { grupo: string; items: ItemMenu[] }[] }) {
  const ruta = usePathname();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Menú principal">
      {grupos.map((g) => (
        <div key={g.grupo}>
          <p className="mb-1 px-3 text-[11px] font-semibold tracking-widest uppercase opacity-60">{g.grupo}</p>
          <ul>
            {g.items.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={activo(ruta, i.href) ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-medium transition ${activo(ruta, i.href) ? "bg-sobre-acento/20 font-semibold" : "opacity-85 hover:bg-sobre-acento/10 hover:opacity-100"}`}
                >
                  <Icono nombre={i.icono} />
                  {i.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
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

export function BarraInferior() {
  const ruta = usePathname();
  const enBarra = BARRA.slice(0, 4).some((i) => activo(ruta, i.href));
  return (
    <nav className="no-imprimir fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-superficie pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Accesos rápidos">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {BARRA.map((i) => {
          const on = i.href === "/mas" ? !enBarra : activo(ruta, i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={on ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${on ? "text-acento-texto" : "text-suave"}`}>
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
