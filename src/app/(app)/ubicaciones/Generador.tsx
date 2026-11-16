"use client";

import { useMemo, useState } from "react";
import { Formulario, type Accion } from "@/components/Escaneo";
import { Tejuelo } from "@/components/ui";
import { generarCodigos, MODELOS, totalUbicaciones, validarEsquema, type Esquema, type Tramo } from "@/lib/ubicaciones";

const copiar = (e: Esquema): Esquema => ({ ...e, tramos: e.tramos.map((t) => ({ ...t })) });

/** Elegir un modelo de nombres, ajustarlo y ver cómo quedan los códigos antes de crearlos. */
export function Generador({ accion, inicial }: { accion: Accion; inicial: Esquema | null }) {
  const [esquema, setEsquema] = useState<Esquema>(copiar(inicial ?? MODELOS[0].esquema));
  const problema = validarEsquema(esquema);
  const total = totalUbicaciones(esquema);
  const muestra = useMemo(() => (problema ? [] : generarCodigos(esquema, 5)), [esquema, problema]);
  const ultimo = useMemo(() => (problema ? "" : (generarCodigos(esquema).at(-1) ?? "")), [esquema, problema]);

  const cambiar = (i: number, cambio: Partial<Tramo>) => setEsquema((e) => ({ ...e, id: "propio", tramos: e.tramos.map((t, j) => (j === i ? { ...t, ...cambio } : t)) }));

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="etiqueta">1. Elegí el modelo que más se parece a tu depósito</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODELOS.map((m) => (
            <button key={m.id} type="button" onClick={() => setEsquema(copiar(m.esquema))} aria-pressed={esquema.id === m.id} className={`cursor-pointer rounded-control border p-3.5 text-left transition-colors duration-150 ${esquema.id === m.id ? "border-acento-texto bg-acento-suave" : "border-borde hover:border-borde-fuerte hover:bg-hundido"}`}>
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{m.nombre}</span>
                <Tejuelo codigo={generarCodigos(m.esquema, 1)[0]} />
              </span>
              <span className="mt-1 block text-sm text-suave">{m.descripcion}</span>
              <span className="mt-1 block text-sm">{m.paraQuien}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="etiqueta">2. Ajustalo a tus medidas</legend>
        <div className="border-y border-borde">
          {esquema.tramos.map((t, i) => (
            <div key={i} className={`grid grid-cols-2 gap-2 py-3 sm:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.8fr_auto] sm:items-end ${i > 0 ? "border-t border-borde" : ""}`}>
              <label className="text-[13px] font-semibold text-suave">
                Qué es
                <input value={t.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} className="campo mt-1" />
              </label>
              <label className="text-[13px] font-semibold text-suave">
                Se nombra con
                <select value={t.tipo} onChange={(e) => cambiar(i, { tipo: e.target.value as Tramo["tipo"] })} className="campo mt-1">
                  <option value="letras">Letras (A, B, C…)</option>
                  <option value="numeros">Números (1, 2, 3…)</option>
                </select>
              </label>
              <label className="text-[13px] font-semibold text-suave">
                Cuántos hay
                <input type="number" min={1} max={999} value={t.cantidad} onChange={(e) => cambiar(i, { cantidad: Number(e.target.value) })} className="campo mt-1" />
              </label>
              <label className="text-[13px] font-semibold text-suave">
                Dígitos
                <input type="number" min={1} max={4} disabled={t.tipo === "letras"} value={t.tipo === "letras" ? "" : (t.digitos ?? 1)} onChange={(e) => cambiar(i, { digitos: Number(e.target.value) })} className="campo mt-1" />
              </label>
              <label className="text-[13px] font-semibold text-suave">
                Prefijo
                <input value={t.prefijo ?? ""} maxLength={4} onChange={(e) => cambiar(i, { prefijo: e.target.value.toUpperCase() })} className="campo mt-1 font-mono" placeholder="—" />
              </label>
              <button type="button" disabled={esquema.tramos.length === 1} onClick={() => setEsquema((e) => ({ ...e, id: "propio", tramos: e.tramos.filter((_, j) => j !== i) }))} className="boton-suave">
                Quitar
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
          <button type="button" disabled={esquema.tramos.length >= 5} onClick={() => setEsquema((e) => ({ ...e, id: "propio", tramos: [...e.tramos, { nombre: "Posición", tipo: "numeros", cantidad: 4, digitos: 1 }] }))} className="boton-suave">
            Agregar un tramo
          </button>
          <label className="flex items-center gap-2 text-sm font-semibold">
            Separador
            <select value={esquema.separador} onChange={(e) => setEsquema((x) => ({ ...x, id: "propio", separador: e.target.value }))} className="campo w-auto font-mono">
              <option value="-">Guion ( - )</option>
              <option value=".">Punto ( . )</option>
              <option value="/">Barra ( / )</option>
              <option value="">Ninguno</option>
            </select>
          </label>
        </div>
      </fieldset>

      <div>
        <p className="etiqueta">3. Así van a quedar</p>
        {problema ? (
          <p className="text-sm font-semibold text-peligro">{problema}</p>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-2">
              {muestra.map((c) => (
                <Tejuelo key={c} codigo={c} tam="md" />
              ))}
              <span className="font-bold text-suave">…</span>
              <Tejuelo codigo={ultimo} tam="md" />
            </p>
            <p className="mt-3 text-sm text-suave">
              Son <strong className="text-texto">{total.toLocaleString("es-AR")} ubicaciones</strong> ({esquema.tramos.map((t) => `${t.cantidad} × ${t.nombre.toLowerCase()}`).join(", ")}). Las que ya existan no se tocan.
            </p>
          </>
        )}
      </div>

      <Formulario accion={accion} boton="Crear estas ubicaciones" reiniciar={false}>
        <input type="hidden" name="esquema" value={JSON.stringify(esquema)} />
      </Formulario>
    </div>
  );
}
