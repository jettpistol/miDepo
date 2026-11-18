"use client";

import { Select, type Option } from "@/components/Select";
import { addSupplier } from "./actions";

/** Supplier dropdown: only listed suppliers, or one created on purpose from the search. */
export function SupplierSelect({ options }: { options: Option[] }) {
  return (
    <Select
      name="supplierId"
      id="supplier"
      options={options}
      required
      requiredMessage="Elige un proveedor de la lista o crea uno."
      placeholder="Elige el proveedor"
      searchPlaceholder="Buscar proveedor…"
      empty="No hay proveedores con ese nombre."
      create={{ noun: "proveedor", action: addSupplier }}
    />
  );
}
