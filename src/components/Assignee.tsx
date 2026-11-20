import { ROLE_LABEL } from "./Accounts";
import { AssignSelect } from "./AssignSelect";
import type { AssignKind } from "@/lib/flows/assignments";
import { assignablePeople } from "@/lib/work";
import { can, type requireSession } from "@/lib/session";

export type Session = Awaited<ReturnType<typeof requireSession>>;

/**
 * Whose this work is. Supervisors change it in place; operators see the name, or nothing if
 * it is nobody's in particular.
 */
export async function Assignee({ session, kind, id, value, open = true }: { session: Session; kind: AssignKind; id: number; value: number | null; open?: boolean }) {
  const { db, company, user } = session;
  const people = await assignablePeople(db, company.id);
  if (can(user.role, "supervisor") && open) {
    return <AssignSelect kind={kind} id={id} value={value} people={people.map((p) => ({ value: String(p.id), label: p.id === user.id ? `${p.name} (tú)` : p.name, detail: ROLE_LABEL[p.role] }))} />;
  }
  const person = people.find((p) => p.id === value);
  if (!person) return null;
  return (
    <span className="text-sm text-muted">
      Asignado a <strong className="text-ink">{person.id === user.id ? "ti" : person.name}</strong>
    </span>
  );
}
