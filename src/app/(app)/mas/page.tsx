import Link from "next/link";
import { Accounts } from "@/components/Accounts";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/ui";
import { MENU } from "@/lib/menu";
import { can, requireSession } from "@/lib/session";

export const metadata = { title: "Menú" };

export default async function More() {
  const { user, company } = await requireSession();
  return (
    <>
      <PageHeader title="Menú" subtitle={company.name} />
      <section className="mb-9">
        <h2 className="section-title">Tu cuenta</h2>
        <div className="border-y border-line py-1.5">
          <Accounts showCurrent />
        </div>
      </section>
      {MENU.map((g) => {
        const items = g.items.filter((i) => can(user.role, i.minRole ?? "operator"));
        if (items.length === 0) return null;
        return (
          <section key={g.group} className="mb-9">
            <h2 className="section-title">{g.group}</h2>
            <ul className="ruled-list">
              {items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="row py-3">
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
