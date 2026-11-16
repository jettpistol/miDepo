import Link from "next/link";
import { Icono } from "@/components/Icono";
import { Encabezado } from "@/components/ui";
import { MENU } from "@/lib/menu";
import { puede, requerir } from "@/lib/sesion";
import { salir } from "../../ingresar/acciones";

export const metadata = { title: "Menú" };

export default async function Mas() {
  const { usuario, empresa } = await requerir();
  return (
    <>
      <Encabezado titulo="Menú" bajada={`${usuario.nombre} · ${empresa.nombre}`} />
      {MENU.map((g) => {
        const items = g.items.filter((i) => puede(usuario.rol, i.minimo ?? "operario"));
        if (items.length === 0) return null;
        return (
          <section key={g.grupo} className="mb-6">
            <h2 className="mb-2 text-xs font-semibold tracking-widest text-suave uppercase">{g.grupo}</h2>
            <ul className="tarjeta divide-y divide-borde/70">
              {items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-acento-suave text-acento-texto">
                      <Icono nombre={i.icono} />
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold">{i.nombre}</span>
                      <span className="block text-sm text-suave">{i.ayuda}</span>
                    </span>
                    <Icono nombre="flecha" className="size-4 text-suave" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <form action={salir}>
        <button className="boton-suave w-full">
          <Icono nombre="salir" /> Salir
        </button>
      </form>
    </>
  );
}
