"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const plano = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Elegir quién devuelve escribiendo parte del nombre, en vez de recorrer una lista de cientos. */
export function ElegirCliente({ clientes }: { clientes: { id: number; nombre: string }[] }) {
  const [texto, setTexto] = useState("");
  const [abierta, setAbierta] = useState(false);
  const [activa, setActiva] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  const indice = useMemo(() => clientes.map((c) => ({ ...c, plano: plano(c.nombre) })), [clientes]);
  const elegido = indice.find((c) => c.nombre === texto);
  const lista = useMemo(() => {
    const q = plano(texto.trim());
    return q && !elegido ? indice.filter((c) => c.plano.includes(q)).slice(0, 8) : [];
  }, [indice, texto, elegido]);
  const visible = abierta && lista.length > 0;

  // Sin un cliente de la lista, el navegador no deja enviar y dice por qué.
  useEffect(() => campo.current?.setCustomValidity(elegido ? "" : texto.trim() && lista.length === 0 ? `Ningún cliente se llama "${texto.trim()}".` : "Elegí un cliente de la lista."), [elegido, texto, lista.length]);

  const elegir = (nombre: string) => {
    setTexto(nombre);
    setAbierta(false);
  };

  return (
    <div className="relative max-w-md flex-1 basis-64">
      <input type="hidden" name="clienteId" value={elegido?.id ?? ""} />
      <input
        ref={campo}
        value={texto}
        className="campo"
        placeholder="¿Quién devuelve?"
        aria-label="Cliente que devuelve"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls="sug-cliente"
        aria-activedescendant={visible ? `sug-cliente-${activa}` : undefined}
        required
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierta(true);
          setActiva(0);
        }}
        onFocus={() => setAbierta(true)}
        onBlur={() => setAbierta(false)}
        onKeyDown={(e) => {
          if (!visible) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActiva((a) => (e.key === "ArrowDown" ? (a + 1) % lista.length : (a || lista.length) - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            elegir(lista[activa].nombre);
          } else if (e.key === "Escape") setAbierta(false);
        }}
      />
      <ul id="sug-cliente" role="listbox" aria-label="Clientes" hidden={!visible} className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-control border border-borde-fuerte bg-superficie py-1 shadow-flotante">
        {lista.map((c, n) => (
          <li
            key={c.id}
            id={`sug-cliente-${n}`}
            role="option"
            aria-selected={n === activa}
            onMouseDown={(e) => {
              e.preventDefault();
              elegir(c.nombre);
            }}
            onMouseEnter={() => setActiva(n)}
            className={`cursor-pointer truncate px-3 py-2 text-sm font-medium ${n === activa ? "bg-acento-suave" : ""}`}
          >
            {c.nombre}
          </li>
        ))}
      </ul>
    </div>
  );
}
