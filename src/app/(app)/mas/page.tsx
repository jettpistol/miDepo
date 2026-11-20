import Link from "next/link";
import { Accounts } from "@/components/Accounts";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/ui";
import { menuFor } from "@/lib/menu";
import { can, requireSession } from "@/lib/session";

export const metadata = { title: "Menú" };

export default async function More() {
  const { user, company } = await requireSession();
  return (
    <>
      <PageHeader title="Menú" subtitle={company.name} />
      <section className="mb-8 lg:mb-6">
        <h2 className="section-title">Tu cuenta</h2>
        <div className="border-y border-line py-1.5">
          <Accounts showCurrent />
        </div>
      </section>
      {menuFor(user.role, company, can).map((g) => {
        // Ajustes is already the first row of "Tu cuenta".
        const items = g.items.filter((i) => i.href !== "/cuenta");
        if (items.length === 0) return null;
        return (
          <section key={g.group} className="mb-8 lg:mb-6">
            <h2 className="section-title">{g.group}</h2>
            <ul className="ruled-list">
              {items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="row py-3 lg:py-2">
                    <Icon name={i.icon} className="size-6 text-accent-text" />
                    <span className="min-w-0 flex-1 font-semibold">{i.name}</span>
                    <Icon name="arrow" className="size-4 text-muted" />
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
