import Link from "next/link";
import { and, asc, count, eq, like, sql } from "drizzle-orm";
import { ActionForm } from "@/components/ScanForm";
import { Icon } from "@/components/Icon";
import { PageHeader, Badge, ShelfMark } from "@/components/ui";
import { stock, locations } from "@/db/schema";
import { requireSession } from "@/lib/session";
import type { Scheme } from "@/lib/locations";
import { createStandalone, generate } from "./actions";
import { Generator } from "./Generator";

export const metadata = { title: "Ubicaciones" };

export default async function Locations({ searchParams }: { searchParams: Promise<{ prefijo?: string }> }) {
  const { db, company } = await requireSession("supervisor");
  const prefix = ((await searchParams).prefijo ?? "").trim().toUpperCase().replace(/[%_]/g, "");
  const [{ total }] = await db.select({ total: count() }).from(locations).where(and(eq(locations.companyId, company.id), eq(locations.type, "shelf")));
  const list = await db
    .select({ u: locations, titles: sql<number>`count(${stock.productId})`.mapWith(Number), units: sql<number>`coalesce(sum(${stock.quantity}), 0)`.mapWith(Number) })
    .from(locations)
    .leftJoin(stock, eq(stock.locationId, locations.id))
    .where(and(eq(locations.companyId, company.id), eq(locations.type, "shelf"), like(locations.code, `${prefix}%`)))
    .groupBy(locations.id)
    .orderBy(asc(locations.code))
    .limit(120);

  return (
    <>
      <PageHeader title="Ubicaciones" subtitle={`${total.toLocaleString("es-AR")} ubicaciones`}>
        <Link href={`/imprimir/ubicaciones?prefijo=${encodeURIComponent(prefix)}`} target="_blank" className="btn-soft">
          <Icon name="print" /> Imprimir etiquetas{prefix && ` de ${prefix}…`}
        </Link>
        <Link href="/imprimir/productos" target="_blank" className="btn-soft">
          Etiquetas sin ISBN
        </Link>
      </PageHeader>

      <form className="mb-4 flex max-w-md gap-2">
        <input name="prefijo" defaultValue={prefix} className="field font-mono" placeholder="Ver las que empiezan con… (A-01)" aria-label="Filtrar por comienzo del código" autoCapitalize="characters" />
        <button className="btn-soft">Filtrar</button>
      </form>
      {list.length > 0 ? (
        <div className="max-w-3xl table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ubicación</th>
                <th className="text-right">Artículos</th>
                <th className="text-right">Unidades</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {list.map(({ u, titles, units }) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/ubicaciones/${u.id}`}>
                      <ShelfMark code={u.code} size="md" />
                    </Link>
                  </td>
                  <td className={`text-right ${titles === 0 ? "text-muted" : ""}`}>{titles}</td>
                  <td className={`text-right ${units === 0 ? "text-muted" : "font-semibold"}`}>{units}</td>
                  <td>{!u.active ? <Badge tone="warn">Desactivada</Badge> : titles === 0 ? <span className="text-muted">Vacía</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="max-w-3xl border-y border-line px-2 py-6 lg:py-5 text-sm text-muted lg:px-3">{total === 0 ? "Todavía no hay ubicaciones. Créalas con el generador de abajo." : `Ninguna ubicación empieza con "${prefix}".`}</p>
      )}
      {list.length === 120 && <p className="mt-3 text-sm text-muted">Se muestran las primeras 120.</p>}

      <section className="mt-10 lg:mt-8 max-w-5xl">
        <h2 className="section-title">Generador de ubicaciones</h2>
        {company.locationScheme ? (
          <p className="mb-5">
            <Badge tone="accent">Mostrando el esquema que usa {company.name}</Badge>
          </p>
        ) : null}
        <Generator action={generate} initial={(company.locationScheme as Scheme | null) ?? null} />
      </section>

      <section className="mt-10 lg:mt-8">
        <h2 className="section-title">Agregar una ubicación suelta</h2>
        <ActionForm action={createStandalone} button="Agregar" className="flex flex-wrap items-start gap-3">
          <input name="code" className="field max-w-56 font-mono" placeholder="MESA-1" aria-label="Código de la ubicación" autoCapitalize="characters" maxLength={20} pattern="[A-Za-z0-9][A-Za-z0-9._\/\-]{0,19}" title="Letras, números, guiones y puntos. Sin espacios ni Ñ." required />
        </ActionForm>
      </section>
    </>
  );
}
