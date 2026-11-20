import { AssigneePicker } from "./AssigneePicker";
import type { AssignKind } from "@/lib/flows/assignments";
import { assignablePeople } from "@/lib/work";
import { can, type requireSession } from "@/lib/session";

export type Session = Awaited<ReturnType<typeof requireSession>>;

/** Who can be given work, who is looking, and whether they may change it. Load once per page. */
export async function assignees(session: Session) {
  const people = await assignablePeople(session.db, session.company.id);
  return { people, me: session.user.id, canAssign: can(session.user.role, "supervisor") };
}
export type Assignees = Awaited<ReturnType<typeof assignees>>;

/**
 * Whose this work is, as avatar and name. Supervisors change it in place while there is work
 * left (`open`); everyone else sees it.
 */
export async function Assignee({ session, kind, id, value, open = true, iconOnly = false }: { session: Session; kind: AssignKind; id: number; value: number | null; open?: boolean; iconOnly?: boolean }) {
  const a = await assignees(session);
  return <AssigneeCell a={a} kind={kind} id={id} value={value} open={open} iconOnly={iconOnly} />;
}

/** The same, with people already loaded: for a table with one per row. */
export function AssigneeCell({ a, kind, id, value, open = true, iconOnly = false }: { a: Assignees; kind: AssignKind; id: number; value: number | null; open?: boolean; iconOnly?: boolean }) {
  return <AssigneePicker kind={kind} id={id} value={value} people={a.people} me={a.me} editable={a.canAssign && open} iconOnly={iconOnly} />;
}
