"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, type Option } from "@/components/Select";

/** The movement log's reason filter: choosing one narrows the list at once. */
export function ReasonFilter({ options, value }: { options: Option[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <Select
      label="Motivo"
      options={[{ value: "", label: "Todos los motivos" }, ...options]}
      value={value}
      placeholder="Todos los motivos"
      searchPlaceholder="Buscar motivo…"
      className="w-full sm:w-56"
      onChange={(v) => {
        const next = new URLSearchParams(params.toString());
        next.delete("pagina");
        if (v) next.set("motivo", v);
        else next.delete("motivo");
        const s = next.toString();
        router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
      }}
    />
  );
}
