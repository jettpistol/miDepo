"use client";

import { Select, type Option } from "@/components/Select";
import { addDestination } from "./actions";

/** Outside locations: fair stands, bookstores with consignment. Supervisors can create one from the search. */
export function DestinationSelect({ options, canCreate }: { options: Option[]; canCreate: boolean }) {
  return (
    <Select
      name="locationId"
      id="destination"
      options={options}
      required
      requiredMessage="Elige el destino de la lista."
      placeholder="Elige el destino"
      searchPlaceholder="Buscar destino…"
      empty={canCreate ? "Ningún destino con ese nombre." : "Ningún destino con ese nombre. Solo un supervisor puede crear uno."}
      create={canCreate ? { noun: "destino", action: addDestination } : undefined}
    />
  );
}
