"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const plain = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Choose who is returning by typing part of the name, instead of scrolling a list of hundreds. */
export function CustomerPicker({ customers }: { customers: { id: number; name: string }[] }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const field = useRef<HTMLInputElement>(null);

  const indexData = useMemo(() => customers.map((c) => ({ ...c, plain: plain(c.name) })), [customers]);
  const chosen = indexData.find((c) => c.name === text);
  const list = useMemo(() => {
    const q = plain(text.trim());
    return q && !chosen ? indexData.filter((c) => c.plain.includes(q)).slice(0, 8) : [];
  }, [indexData, text, chosen]);
  const visible = open && list.length > 0;

  // Without a customer from the list the browser blocks the submit and says why.
  useEffect(() => field.current?.setCustomValidity(chosen ? "" : text.trim() && list.length === 0 ? `Ningún cliente se llama "${text.trim()}".` : "Elegí un cliente de la lista."), [chosen, text, list.length]);

  const choose = (name: string) => {
    setText(name);
    setOpen(false);
  };

  return (
    <div className="relative max-w-md flex-1 basis-64">
      <input type="hidden" name="customerId" value={chosen?.id ?? ""} />
      <input
        ref={field}
        value={text}
        className="field"
        placeholder="¿Quién devuelve?"
        aria-label="Cliente que devuelve"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls="sug-customer"
        aria-activedescendant={visible ? `sug-customer-${active}` : undefined}
        required
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!visible) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (e.key === "ArrowDown" ? (a + 1) % list.length : (a || list.length) - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(list[active].name);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      <ul id="sug-customer" role="listbox" aria-label="Clientes" hidden={!visible} className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-control border border-line-strong bg-surface py-1 shadow-floating">
        {list.map((c, n) => (
          <li
            key={c.id}
            id={`sug-customer-${n}`}
            role="option"
            aria-selected={n === active}
            onMouseDown={(e) => {
              e.preventDefault();
              choose(c.name);
            }}
            onMouseEnter={() => setActive(n)}
            className={`cursor-pointer truncate px-3 py-2 text-sm font-medium ${n === active ? "bg-accent-soft" : ""}`}
          >
            {c.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
