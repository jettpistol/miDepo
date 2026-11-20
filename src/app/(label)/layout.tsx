import type { ReactNode } from "react";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Imprimir etiquetas" };

/** Label print views: a toolbar (not printed) and the labels at their real size. Each page sets its own @page. */
export default async function LabelLayout({ children }: { children: ReactNode }) {
  await requireSession();
  return (
    <div className="min-h-dvh bg-neutral-100 text-black print:bg-white" style={{ colorScheme: "light" }}>
      {children}
    </div>
  );
}
