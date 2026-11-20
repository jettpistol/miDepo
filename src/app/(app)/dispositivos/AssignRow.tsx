"use client";

import { useState } from "react";
import Link from "next/link";
import { Select } from "@/components/Select";
import { toast } from "@/components/Toast";
import { assign } from "./actions";

export type PrinterOption = { value: string; label: string; detail?: string; thermal: boolean };
export type SizeOption = { value: string; label: string; sheet: boolean };

/** One kind of label: this computer's printer and size, saved on change. */
export function AssignRow({ kind, name, printers, sizes, printerId, sizeId, canEdit }: { kind: string; name: string; printers: PrinterOption[]; sizes: SizeOption[]; printerId: string; sizeId: string; canEdit: boolean }) {
  const [printer, setPrinter] = useState(printerId);
  const [size, setSize] = useState(sizeId);
  const thermal = printers.find((p) => p.value === printer)?.thermal ?? false;
  const allowed = sizes.filter((s) => !(thermal && s.sheet));

  const save = async (p: string, s: string) => {
    const r = await assign(kind, p === "dialogo" ? null : Number(p), s);
    if (r.error) toast(r.error, true);
    else toast(r.ok ?? "Guardado.", false);
  };

  const printerName = printers.find((p) => p.value === printer)?.label;
  const sizeName = sizes.find((s) => s.value === size)?.label;
  const sizeSelect = (
    <Select
      label={`Tamaño para ${name.toLowerCase()}`}
      options={allowed}
      value={size}
      onChange={(v) => {
        setSize(v);
        save(printer, v);
      }}
    />
  );
  return (
    <tr>
      <td className="font-medium">{name}</td>
      <td className="w-full sm:w-auto sm:min-w-52">
        {canEdit ? (
          <div className="space-y-1.5">
            <Select
              label={`Impresora para ${name.toLowerCase()}`}
              options={printers}
              value={printer}
              onChange={(v) => {
                const nowThermal = printers.find((p) => p.value === v)?.thermal ?? false;
                const s = nowThermal && sizes.find((x) => x.value === size)?.sheet ? (sizes.find((x) => !x.sheet)?.value ?? size) : size;
                setPrinter(v);
                setSize(s);
                save(v, s);
              }}
            />
            {/* On a phone the size goes under the printer: the table has no room for a third control. */}
            <div className="sm:hidden">{sizeSelect}</div>
          </div>
        ) : (
          <>
            {printerName}
            <span className="block text-muted sm:hidden">{sizeName}</span>
          </>
        )}
      </td>
      <td className="hidden min-w-44 sm:table-cell">{canEdit ? sizeSelect : sizeName}</td>
      <td className="hidden text-right sm:table-cell">
        <Link href={`/etiquetas/prueba?impresora=${printer}&tamano=${size}`} target="_blank" className="btn-sm">
          Prueba
        </Link>
      </td>
    </tr>
  );
}
