import Link from "next/link";
import { Cuentas } from "@/components/Cuentas";
import { Icono } from "@/components/Icono";
import { Encabezado } from "@/components/ui";
import { MENU } from "@/lib/menu";
import { puede, requerir } from "@/lib/sesion";

export const metadata = { title: "Menú" };

export default async function Mas() {
  const { usuario, empresa } = await requerir();
  return (
    <>
      <Encabezado titulo="Menú" bajada={empresa.nombre} />
      <section className="mb-9">
        <h2 className="titulo-seccion">Tu cuenta</h2>
        <div className="border-y border-borde py-1.5">
          <Cuentas mostrarActual />
        </div>
      </section>
      {MENU.map((g) => {
        const items = g.items.filter((i) => puede(usuario.rol, i.minimo ?? "operario"));
        if (items.length === 0) return null;
        return (
          <section key={g.grupo} className="mb-9">
            <h2 className="titulo-seccion">{g.grupo}</h2>
            <ul className="lista">
              {items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="fila py-3">
                    <Icono nombre={i.icono} className="size-6 text-acento-texto" />
                    <span className="min-w-0 flex-1 font-semibold">{i.nombre}</span>
                    <Icono nombre="flecha" className="size-4 text-suave" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
