"use client";

import { Select, type Option } from "@/components/Select";
import { addCarrier } from "./actions";

/** Carrier dropdown: only listed carriers; supervisors can create one from the search. */
export function CarrierSelect({ options, canCreate, value }: { options: Option[]; canCreate: boolean; value?: string }) {
  return (
    <Select
      name="carrierId"
      id="carrier"
      options={options}
      defaultValue={value}
      required
      requiredMessage="Elige el transporte de la lista."
      placeholder="Elige el transporte"
      searchPlaceholder="Buscar transporte…"
      empty={canCreate ? "Ningún transporte con ese nombre." : "Ningún transporte con ese nombre. Solo un supervisor puede crear uno."}
      create={canCreate ? { noun: "transporte", action: addCarrier } : undefined}
    />
  );
}
