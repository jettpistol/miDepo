"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { printNow } from "./actions";

/** One click to this computer's printer. The reply is shown before the list refreshes, since the row then leaves it. */
export function PrintNow({ id, verb }: { id: number; verb: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-sm"
      disabled={busy}
      onClick={() =>
        start(async () => {
          const r = await printNow(id);
          if (r.error) toast(r.error, true);
          else if (r.ok) toast(r.ok, false);
          router.refresh();
        })
      }
    >
      <Icon name="print" /> <span className="sr-only sm:not-sr-only">{busy ? "Un momento…" : verb}</span>
    </button>
  );
}
