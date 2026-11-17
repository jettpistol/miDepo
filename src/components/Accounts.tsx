import Link from "next/link";
import { switchAccount, logout, logoutAll } from "@/app/ingresar/actions";
import { openAccounts, MAX_ACCOUNTS } from "@/lib/session";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

export const ROLE_LABEL = { operator: "Operario", supervisor: "Supervisor", admin: "Administrador" } as const;

/**
 * The accounts open on this device: to switch between them without logging in again,
 * add another one or log out. Used in the header menu and on the "Más" screen.
 */
export async function Accounts({ showCurrent = false }: { showCurrent?: boolean }) {
  const accounts = await openAccounts();
  const others = accounts.filter((c) => !c.active);
  const current = accounts.find((c) => c.active);
  const row = "flex w-full cursor-pointer items-center gap-3 rounded-control px-2.5 py-2 text-left text-sm font-medium text-ink transition-colors duration-150 hover:bg-sunken";

  return (
    <div className="space-y-1">
      {current && (
        <Link href="/cuenta" className={`${row} ${showCurrent ? "py-2.5" : ""}`}>
          {showCurrent ? (
            <Avatar person={current.user} className="size-11 lg:size-9 text-base" />
          ) : (
            <span className="grid size-8 place-items-center">
              <Icon name="account" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{showCurrent ? current.user.name : "Mi cuenta"}</span>
            {showCurrent && <span className="block truncate text-xs text-muted">{`${ROLE_LABEL[current.user.role]} · ${current.company.name} · en uso`}</span>}
          </span>
          {showCurrent && <span className="text-sm font-semibold whitespace-nowrap text-accent-text">Mi cuenta</span>}
          <Icon name="arrow" className="size-4 text-muted" />
        </Link>
      )}
      {others.length > 0 && <p className="px-2.5 pt-2 text-[13px] font-bold text-muted">Cambiar a</p>}
      {others.map((c) => (
        <form key={c.user.id} action={switchAccount}>
          <input type="hidden" name="userId" value={c.user.id} />
          <button className={row}>
            <Avatar person={c.user} className="size-8 text-xs" />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{c.user.name}</span>
              <span className="block truncate text-xs text-muted">
                {ROLE_LABEL[c.user.role]}
                {c.company.id !== current?.company.id && ` · ${c.company.name}`}
              </span>
            </span>
          </button>
        </form>
      ))}
      {accounts.length < MAX_ACCOUNTS && (
        <Link href="/ingresar?agregar=1" className={row}>
          <span className="grid size-8 place-items-center">
            <Icon name="users" />
          </span>
          Agregar otra cuenta
        </Link>
      )}
      <form action={logout}>
        <button className={row}>
          <span className="grid size-8 place-items-center">
            <Icon name="logout" />
          </span>
          {others.length > 0 ? `Salir de ${current?.user.name.split(" ")[0] ?? "esta cuenta"}` : "Salir"}
        </button>
      </form>
      {others.length > 0 && (
        <form action={logoutAll}>
          <button className={`${row} text-danger`}>
            <span className="size-8" />
            Salir de todas las cuentas
          </button>
        </form>
      )}
    </div>
  );
}
