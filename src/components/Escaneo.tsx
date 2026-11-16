"use client";

import { startTransition, useActionState, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Resultado } from "@/lib/errores";
import { Camara } from "./Camara";
import { Icono } from "./Icono";

export type Accion = (previo: Resultado, datos: FormData) => Promise<Resultado>;

function sonar(tipo: "ok" | "error") {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audio = new Ctx();
    const osc = audio.createOscillator();
    const gan = audio.createGain();
    osc.frequency.value = tipo === "ok" ? 880 : 200;
    osc.type = tipo === "ok" ? "sine" : "square";
    gan.gain.value = 0.08;
    osc.connect(gan).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + (tipo === "ok" ? 0.09 : 0.3));
    osc.onended = () => audio.close();
    navigator.vibrate?.(tipo === "ok" ? 40 : [90, 60, 90]);
  } catch {
    /* sin sonido no pasa nada */
  }
}

export function Mensaje({ estado }: { estado: Resultado }) {
  if (!estado.ok && !estado.error) return null;
  const mal = Boolean(estado.error);
  return (
    <p role="status" aria-live="polite" className={`aparece flex items-start gap-2 rounded-control border px-3 py-2.5 text-[15px] font-semibold ${mal ? "border-peligro/30 bg-peligro-suave text-peligro" : "border-ok/30 bg-ok-suave text-ok"}`}>
      <Icono nombre={mal ? "alerta" : "ok"} className="mt-0.5 size-5" />
      <span>{estado.error ?? estado.ok}</span>
    </p>
  );
}

/** `espera`: el código que debería leerse en ese campo; cuando coincide, el campo lo marca. */
type Campo = { nombre: string; etiqueta: string; ayuda?: string; valor?: string; espera?: string | null };

/**
 * Formulario de escaneo. Funciona igual con lector USB (escribe y manda Enter), con la cámara
 * del teléfono o tipeando. Con Enter se pasa al campo siguiente y en el último se confirma.
 */
export function Escaneo({
  accion,
  campos,
  ocultos = {},
  cantidad,
  boton = "Confirmar",
  children,
}: {
  accion: Accion;
  campos: Campo[];
  ocultos?: Record<string, string | number>;
  /** Si se pasa, muestra el campo de cantidad con ese valor inicial. */
  cantidad?: number;
  boton?: string;
  children?: ReactNode;
}) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  const form = useRef<HTMLFormElement>(null);
  const [camaraEn, setCamaraEn] = useState<string | null>(null);
  const [coincide, setCoincide] = useState<Record<string, boolean>>({});
  const revisar = useCallback(() => {
    const dato = form.current ? new FormData(form.current) : null;
    setCoincide(Object.fromEntries(campos.map((c) => [c.nombre, Boolean(c.espera) && String(dato?.get(c.nombre) ?? "").trim().toUpperCase() === c.espera!.toUpperCase()])));
  }, [campos]);

  const entradas = useCallback(() => campos.map((c) => form.current?.elements.namedItem(c.nombre) as HTMLInputElement | null), [campos]);

  const enfocarPrimeroVacio = useCallback(() => {
    const es = entradas();
    (es.find((e) => e && !e.value) ?? es[0])?.focus();
  }, [entradas]);

  useEffect(() => {
    if (!estado.ok && !estado.error) return enfocarPrimeroVacio();
    sonar(estado.error ? "error" : "ok");
    const es = entradas();
    if (estado.ok) {
      es.forEach((e, i) => e && (e.value = campos[i].valor ?? ""));
      const cant = form.current?.elements.namedItem("cantidad") as HTMLInputElement | null;
      if (cant && cantidad != null) cant.value = String(cantidad);
      enfocarPrimeroVacio();
      revisar();
    } else {
      const primero = es.find((e) => e && !campos[es.indexOf(e)].valor) ?? es[0];
      primero?.focus();
      primero?.select();
    }
    // Solo interesa reaccionar a una respuesta nueva del servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  /** Avanza al próximo campo vacío o, si no queda ninguno, confirma. */
  const avanzar = useCallback(
    (desde: number) => {
      const siguiente = entradas().find((e, i) => i > desde && e && !e.value);
      if (siguiente) siguiente.focus();
      else form.current?.requestSubmit();
    },
    [entradas],
  );

  const alLeer = useCallback(
    (codigo: string) => {
      const i = campos.findIndex((c) => c.nombre === camaraEn);
      const e = entradas()[i];
      setCamaraEn(null);
      if (!e) return;
      e.value = codigo;
      revisar();
      avanzar(i);
    },
    [avanzar, camaraEn, campos, entradas, revisar],
  );
  const cerrarCamara = useCallback(() => setCamaraEn(null), []);

  return (
    <form
      ref={form}
      className="space-y-3.5 rounded-control border border-borde-fuerte bg-superficie p-4"
      autoComplete="off"
      onInput={revisar}
      onSubmit={(e) => {
        // Se envía a mano para que, si hay un error, lo ya escaneado no se borre.
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => enviar(datos));
      }}
    >
      {Object.entries(ocultos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {campos.map((c, i) => (
        <div key={c.nombre}>
          <label htmlFor={`esc-${c.nombre}`} className="etiqueta flex items-center justify-between gap-2">
            {c.etiqueta}
            {coincide[c.nombre] && (
              <span className="aparece flex items-center gap-1 text-[13px] text-ok">
                <Icono nombre="ok" className="size-4" /> Coincide
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <input
              id={`esc-${c.nombre}`}
              name={c.nombre}
              defaultValue={c.valor ?? ""}
              className={`campo font-mono font-bold placeholder:font-sans placeholder:font-normal ${coincide[c.nombre] ? "border-ok" : ""}`}
              placeholder={c.ayuda ?? "Escaneá o escribí"}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint={i === campos.length - 1 ? "done" : "next"}
              required
              onKeyDown={(ev) => {
                if (ev.key !== "Enter") return;
                ev.preventDefault();
                if (ev.currentTarget.value.trim()) avanzar(i);
              }}
            />
            <button type="button" className="boton-suave px-3" aria-label={`Leer ${c.etiqueta.toLowerCase()} con la cámara`} onClick={() => setCamaraEn(c.nombre)}>
              <Icono nombre="camara" />
            </button>
          </div>
        </div>
      ))}
      {children}
      <div className="flex items-end gap-3">
        {cantidad != null && (
          <div className="w-28">
            <label htmlFor="esc-cantidad" className="etiqueta">
              Cantidad
            </label>
            <input id="esc-cantidad" name="cantidad" type="number" min={1} step={1} inputMode="numeric" defaultValue={cantidad} key={cantidad} className="campo text-center font-bold" required />
          </div>
        )}
        <button className="boton flex-1" disabled={enviando}>
          {enviando ? "Un momento…" : boton}
        </button>
      </div>
      <Mensaje estado={estado} />
      {camaraEn && <Camara alLeer={alLeer} alCerrar={cerrarCamara} />}
    </form>
  );
}

/** Botón que ejecuta una acción y muestra su respuesta. Con `confirmar`, pregunta antes. */
export function BotonAccion({
  accion,
  ocultos = {},
  children,
  clase = "boton",
  confirmar,
  mostrarOk = true,
}: {
  accion: Accion;
  ocultos?: Record<string, string | number>;
  children: ReactNode;
  clase?: string;
  confirmar?: string;
  mostrarOk?: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  return (
    <form
      action={enviar}
      className="contents"
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {Object.entries(ocultos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button className={clase} disabled={enviando}>
        {enviando ? "Un momento…" : children}
      </button>
      {(estado.error || (mostrarOk && estado.ok)) && (
        <div className="basis-full">
          <Mensaje estado={estado} />
        </div>
      )}
    </form>
  );
}

/** Formulario común (no de escaneo) que muestra la respuesta de la acción debajo. */
export function Formulario({ accion, children, boton, clase = "space-y-4", reiniciar = true }: { accion: Accion; children: ReactNode; boton: string; clase?: string; reiniciar?: boolean }) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok && reiniciar) form.current?.reset();
  }, [estado, reiniciar]);
  return (
    <form ref={form} action={enviar} className={clase}>
      {children}
      <button className="boton" disabled={enviando}>
        {enviando ? "Un momento…" : boton}
      </button>
      <Mensaje estado={estado} />
    </form>
  );
}
