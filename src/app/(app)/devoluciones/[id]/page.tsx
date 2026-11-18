import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ActionButton, ScanForm } from "@/components/ScanForm";
import { Notice, Code, PageHeader, Badge, type Tone } from "@/components/ui";
import { customers, returnLines, returns, products } from "@/db/schema";
import { BOOK_CONDITIONS } from "@/lib/flows/returns";
import { requireSession } from "@/lib/session";
import { close, scan, remove } from "../actions";
import { hotkey } from "@/lib/hotkeys";

const TONE_CLASS: Record<string, Tone> = { sellable: "ok", damaged: "danger", clearance: "warn" };

export default async function ReturnDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { db, company } = await requireSession();
  const [row] = await db.select({ d: returns, customer: customers.name }).from(returns).innerJoin(customers, eq(customers.id, returns.customerId)).where(and(eq(returns.id, id), eq(returns.companyId, company.id)));
  if (!row) notFound();
  const { d, customer } = row;
  const lines = await db.select({ l: returnLines, title: products.title, code: products.barcode }).from(returnLines).innerJoin(products, eq(products.id, returnLines.productId)).where(eq(returnLines.returnId, id)).orderBy(asc(products.title));
  const open = d.status === "in_progress";
  const total = (e: string) => lines.filter((x) => x.l.bookCondition === e).reduce((s, x) => s + x.l.quantity, 0);

  return (
    <>
      <PageHeader title={`Devolución ${d.number}`} subtitle={customer} back={{ href: "/devoluciones", text: "Devoluciones" }} />
      {!open && (
        <div className="mb-6">
          <Notice tone="ok">
            Devolución cerrada. Los vendibles esperan en Devoluciones su{" "}
            <Link href="/reposicion?zona=devoluciones" className="font-semibold underline underline-offset-[3px]" {...hotkey("primary", "Ir a reposición")}>
              reposición
            </Link>
            ; los dañados y los saldos ya están en su zona.
          </Notice>
        </div>
      )}
      <div className={`grid gap-5 lg:items-start lg:gap-8 ${open ? "lg:grid-cols-[minmax(0,22rem)_1fr]" : ""}`}>
        {open && (
          <div className="space-y-3 lg:sticky lg:top-30">
            <ScanForm action={scan} context="return" hiddenFields={{ id }} fields={[{ name: "product", label: "Libro", help: "Código, título o autor" }]} quantity={1} button="Sumar">
              <fieldset {...hotkey("option", "Cambiar el estado del libro")} data-hotkey-cycle>
                <legend className="field-label">¿En qué estado está?</legend>
                <div className="space-y-2">
                  {BOOK_CONDITIONS.map((e, i) => (
                    <label key={e.id} className="flex cursor-pointer items-start gap-3 rounded-control border border-line-strong px-3 py-2.5 transition-colors duration-150 hover:bg-sunken has-checked:border-accent-text has-checked:bg-accent-soft">
                      <input type="radio" name="bookCondition" value={e.id} defaultChecked={i === 0} className="mt-1 size-4 accent-(--accent-text)" />
                      <span>
                        <span className="block font-semibold">{e.name}</span>
                        <span className="block text-sm text-muted">{e.help}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </ScanForm>
            <ActionButton action={close} hotkey="finish" hiddenFields={{ id }} className="btn w-full" reason={lines.length === 0 ? "Todavía no escaneaste ningún libro." : undefined} confirm="¿Cerrar la devolución? Los libros entran al stock y ya no se puede corregir.">
              Cerrar devolución
            </ActionButton>
          </div>
        )}
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-2">
            {BOOK_CONDITIONS.map((e) => (
              <Badge key={e.id} tone={TONE_CLASS[e.id]}>
                {e.name}: {total(e.id)}
              </Badge>
            ))}
          </div>
          {lines.length === 0 ? (
            <p className="border-y border-line px-2 py-8 text-sm text-muted lg:px-3">Todavía no hay libros. Escaneá el primero.</p>
          ) : (
            <ul className="ruled-list framed">
              {lines.map(({ l, title, code }) => (
                <li key={`${l.productId}-${l.bookCondition}`} className="row flex-wrap">
                  <span className="min-w-0 flex-1 basis-48">
                    <span className="block font-medium">{title}</span>
                    <Code>{code}</Code>
                  </span>
                  <Badge tone={TONE_CLASS[l.bookCondition]}>{BOOK_CONDITIONS.find((e) => e.id === l.bookCondition)?.name}</Badge>
                  <span className="w-10 text-right font-bold whitespace-nowrap">× {l.quantity}</span>
                  {open && (
                    <ActionButton action={remove} hiddenFields={{ id, productId: l.productId, bookCondition: l.bookCondition }} className="btn-sm border-danger/50 text-danger hover:border-danger hover:bg-danger-soft hover:text-danger" showOk={false}>
                      Quitar
                    </ActionButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
