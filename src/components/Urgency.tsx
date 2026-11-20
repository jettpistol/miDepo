import { ActionButton } from "@/components/ScanForm";
import { Badge } from "@/components/ui";
import type { orders } from "@/db/schema";
import { can } from "@/lib/session";
import type { Session } from "@/components/Assignee";
import { urgency } from "@/app/(app)/pedidos/actions";

type Order = Pick<typeof orders.$inferSelect, "id" | "urgent" | "status">;

/** The "Urgente" badge, and for supervisors the switch, while the order still has work in it. */
export function Urgency({ session, order }: { session: Session; order: Order }) {
  const open = ["pending", "in_picking", "picked"].includes(order.status);
  return (
    <>
      {order.urgent && <Badge tone="danger">Urgente</Badge>}
      {open && can(session.user.role, "supervisor") && (
        <ActionButton action={urgency} hiddenFields={{ id: order.id, urgent: order.urgent ? "0" : "1" }} className="btn-soft">
          {order.urgent ? "Quitar urgencia" : "Marcar urgente"}
        </ActionButton>
      )}
    </>
  );
}
