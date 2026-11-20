"use client";

import { useRouter } from "next/navigation";
import type { Option } from "@/components/Select";
import { SupplierSelect } from "../recepcion/SupplierSelect";

/**
 * "+ Nuevo" on Proveedores: the same search as in Recepción, so an existing supplier is found
 * before a near-copy is created. Choosing one, or creating it, opens its page.
 */
export function NewSupplier({ options }: { options: Option[] }) {
  const router = useRouter();
  return (
    <div>
      <label htmlFor="new-supplier" className="field-label">
        Nombre
      </label>
      <SupplierSelect id="new-supplier" name="" options={options} canCreate placeholder="Busca o escribe el nombre" onChange={(v) => v && router.push(`/proveedores/${v}`)} />
    </div>
  );
}
