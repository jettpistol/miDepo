import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ActionButton } from "@/components/ScanForm";
import { Icon } from "@/components/Icon";
import { Code, PageHeader, Badge, ShelfMark } from "@/components/ui";
import { products, stock, locations } from "@/db/schema";
import { can, requireSession } from "@/lib/session";
import { locationName } from "@/lib/stock";
import { Cover, ProductCards, ViewSwitch } from "@/components/ProductCards";
import { CodeWithCopy } from "@/components/CopyButton";
import { ColumnHandle, ResizableTable } from "@/components/ResizableTable";
import { toggle } from "../actions";
import { articleName } from "@/lib/article";

export default async function LocationDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, company, user } = await requireSession();
  const [u] = await db.select().from(locations).where(and(eq(locations.id, id), eq(locations.companyId, company.id)));
  if (!u) notFound();
  const contents = await db.select({ s: stock, p: products }).from(stock).innerJoin(products, eq(products.id, stock.productId)).where(eq(stock.locationId, id)).orderBy(asc(products.title)).limit(500);
  const isShelf = u.type === "shelf";
  const supervisor = can(user.role, "supervisor");

  return (
    <>
      <PageHeader title={isShelf ? <ShelfMark code={u.code} size="md" className="text-[22px] lg:text-2xl" /> : locationName(u)} back={supervisor && isShelf ? { href: "/ubicaciones", text: "Ubicaciones" } : { href: "/stock", text: "Stock" }} subtitle={`${contents.length} artículos · ${contents.reduce((s, c) => s + c.s.quantity, 0)} unidades`}>
        {!isShelf && <ShelfMark code={u.code} size="md" />}
        {!u.active && <Badge tone="warn">Desactivada</Badge>}
        {isShelf && (
          <Link href={`/imprimir/ubicaciones?prefijo=${encodeURIComponent(u.code)}&exacta=1`} target="_blank" className="btn-soft">
            <Icon name="print" /> Etiqueta
          </Link>
        )}
        {isShelf && supervisor && (
          <ActionButton action={toggle} hiddenFields={{ id }} className="btn-soft" reason={u.active && contents.length > 0 ? "Para desactivarla, primero mueve los artículos." : undefined}>
            {u.active ? "Desactivar" : "Reactivar"}
          </ActionButton>
        )}
      </PageHeader>
      {contents.length === 0 ? (
        <p className="border-y border-line px-2 py-8 text-sm text-muted lg:px-3">Vacía.</p>
      ) : (
        <>
          <div className="mb-2 flex justify-end">
            <ViewSwitch view={user.listView} />
          </div>
          {user.listView === "cards" ? (
            <ProductCards items={contents.map(({ s, p }) => ({ product: p, quantity: s.quantity }))} />
          ) : (
            <ResizableTable id="location" className="max-w-5xl table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-0">
                      <span className="sr-only">Portada</span>
                    </th>
                    <th>
                      Artículo
                      <ColumnHandle />
                    </th>
                    <th className="hidden sm:table-cell">
                      SKU
                      <ColumnHandle />
                    </th>
                    <th className="hidden md:table-cell">
                      ISBN
                      <ColumnHandle />
                    </th>
                    <th className="text-right">Unidades</th>
                  </tr>
                </thead>
                <tbody>
                  {contents.map(({ s, p }) => (
                    <tr key={p.id}>
                      <td className="w-0 py-1.5! pr-0!">
                        <Cover productId={p.id} version={p.thumbVersion} className="h-14 w-10" />
                      </td>
                      <td>
                        <Link href={`/stock/${p.id}`} className="link">
                          {articleName(p.title)}
                        </Link>
                        <span className="mt-0.5 block sm:hidden">
                          <Code>{p.internalCode}</Code>
                        </span>
                      </td>
                      <td className="hidden sm:table-cell">
                        <CodeWithCopy value={p.internalCode} what="SKU" />
                      </td>
                      <td className="hidden md:table-cell">{p.isbn ? <CodeWithCopy value={p.isbn} what="ISBN" /> : <span className="text-muted">—</span>}</td>
                      <td className="text-right text-base font-bold tabular-nums">{s.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResizableTable>
          )}
        </>
      )}
    </>
  );
}
