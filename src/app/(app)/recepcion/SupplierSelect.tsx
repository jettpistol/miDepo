"use client";

import { Select, type Option } from "@/components/Select";
import { addSupplier } from "./actions";

/**
 * Supplier dropdown: only listed suppliers. Supervisors can also create one on purpose from the
 * search; operators are told who can.
 */
export function SupplierSelect({ options, canCreate, id = "supplier", name = "supplierId", onChange, placeholder = "Elige el proveedor" }: { options: Option[]; canCreate: boolean; id?: string; name?: string; onChange?: (value: string) => void; placeholder?: string }) {
  return (
    <Select
      name={name}
      id={id}
      options={options}
      required
      requiredMessage={canCreate ? "Elige un proveedor de la lista o crea uno." : "Elige un proveedor de la lista."}
      placeholder={placeholder}
      searchPlaceholder="Buscar proveedor…"
      empty={canCreate ? "No hay proveedores con ese nombre." : "No hay proveedores con ese nombre. Solo un supervisor puede crear uno."}
      create={canCreate ? { noun: "proveedor", action: addSupplier } : undefined}
      onChange={onChange}
    />
  );
}
