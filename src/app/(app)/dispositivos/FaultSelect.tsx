"use client";

import { useState } from "react";
import { Select, type Option } from "@/components/Select";
import { toast } from "@/components/Toast";
import { fault } from "./actions";

/** A demo printer's simulated state, saved on change. */
export function FaultSelect({ id, value, options }: { id: number; value: string; options: Option[] }) {
  const [v, setV] = useState(value);
  return (
    <div className="w-40">
      <Select
        label="Estado simulado"
        options={options}
        value={v}
        onChange={async (next) => {
          setV(next);
          const r = await fault(id, next);
          if (r.error) toast(r.error, true);
        }}
      />
    </div>
  );
}
