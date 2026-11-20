import { ActionButton } from "@/components/ScanForm";
import { Notice } from "@/components/ui";
import type { orders } from "@/db/schema";
import { can } from "@/lib/session";
import type { Session } from "@/components/Assignee";
import { allowSame } from "@/app/(app)/control/actions";

type Order = Pick<typeof orders.$inferSelect, "id" | "takenBy" | "sameCheckAllowedBy">;

/**
 * When the company asks that someone other than the picker check an order: the supervisor's
 * permission for this one order, shown to everyone once given, and the switch for supervisors.
 */
export function SameCheck({ session, order, picker, allowedBy, what }: { session: Session; order: Order; picker: string | null; allowedBy: string | null; what: "control" | "empaque" }) {
  if (session.company.samePersonChecks || order.takenBy == null) return null;
  const supervisor = can(session.user.role, "supervisor");
  if (order.sameCheckAllowedBy != null)
    return (
      <Notice tone="accent">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {what === "control" ? "Control" : "Empaque"} permitido a {picker ?? "quien preparó"}{allowedBy ? ` por ${allowedBy}` : ""}.
          </span>
          {supervisor && (
            <ActionButton action={allowSame} hiddenFields={{ id: order.id, allow: "no" }} className="btn-sm" showOk={false}>
              Quitar permiso
            </ActionButton>
          )}
        </span>
      </Notice>
    );
  if (!supervisor) return null;
  const self = order.takenBy === session.user.id;
  return (
    <ActionButton action={allowSame} hiddenFields={{ id: order.id, allow: "yes" }} className="btn-soft" reason={self ? "Lo preparaste tú" : undefined}>
      Permitir {what} a {picker ?? "quien preparó"}
    </ActionButton>
  );
}
