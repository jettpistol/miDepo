import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { ROLE_LABEL } from "@/components/Accounts";
import { openAccounts, MAX_ACCOUNTS, currentSession } from "@/lib/session";
import { switchAccount } from "./actions";
import { Brand } from "@/components/Brand";
import { ShelfMark } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Ingresar" };

export default async function Page({ searchParams }: { searchParams: Promise<{ agregar?: string }> }) {
  const adding = Boolean((await searchParams).agregar);
  const accounts = await openAccounts();
  // With an account in use, you only get here to add another one.
  if ((await currentSession()) && !adding) redirect("/");
  const full = accounts.length >= MAX_ACCOUNTS;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="flex flex-col justify-between bg-accent px-6 py-8 text-on-accent lg:px-14 lg:py-12">
        <Brand large />
        <div className="my-8 max-w-md lg:my-0">
          <ShelfMark code="A-01-1" size="md" onAccent className="mb-4 lg:hidden" />
          <ShelfMark code="A-01-1" size="xl" onAccent className="mb-7 max-lg:hidden" />
          <h1 className="text-3xl leading-[1.1] font-bold tracking-[-0.025em] lg:text-[2.75rem]">El depósito de libros, ordenado.</h1>
          <p className="mt-4 text-base opacity-85 lg:text-lg">Cada título en su estante, cada pedido en su caja. La oficina sigue trabajando en Fierro como siempre.</p>
        </div>
        <p className="hidden text-sm opacity-80 lg:block">Recepción · Guardado · Picking · Empaque · Devoluciones · Conteos</p>
      </section>
      <section className="flex items-start justify-center bg-page px-6 py-10 lg:items-center">
        <div className="w-full max-w-sm">
          {accounts.length > 0 && (
            <div className="mb-9">
              <h2 className="section-title">
                Cuentas abiertas en este dispositivo <small>{accounts.length}</small>
              </h2>
              <ul className="ruled-list">
                {accounts.map((c) => (
                  <li key={c.user.id}>
                    <form action={switchAccount}>
                      <input type="hidden" name="userId" value={c.user.id} />
                      <button className="row w-full gap-x-3 text-left">
                        <Avatar person={c.user} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{c.user.name}</span>
                          <span className="block truncate text-sm text-muted">
                            {ROLE_LABEL[c.user.role]} · {c.company.name}
                          </span>
                        </span>
                        <span className="text-sm font-semibold text-accent-text">{c.active ? "Volver" : "Seguir"}</span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <h2 className="mb-1 text-xl font-bold tracking-[-0.02em]">{accounts.length > 0 ? "Agregar otra cuenta" : "Ingresar"}</h2>
          {full && <p className="mb-4 text-sm text-muted">{`Este dispositivo ya tiene ${MAX_ACCOUNTS} cuentas abiertas. Si entrás con otra, se cierra la que hace más tiempo no se usa.`}</p>}
          <div className={accounts.length > 0 ? "" : "mt-4"}>
            <LoginForm />
          </div>
        </div>
      </section>
    </div>
  );
}
