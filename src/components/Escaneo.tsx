"use client";

import { startTransition, useActionState, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Atajo, Consulta, Estado } from "@/lib/consulta";
import type { Resultado } from "@/lib/errores";
import { Camara } from "./Camara";
import { Icono } from "./Icono";
import { Tejuelo } from "./ui";

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

type Campo = { nombre: string; etiqueta: string; ayuda?: string; valor?: string };

const TONO = { ok: "text-ok", alerta: "text-alerta", peligro: "text-peligro" } as const;

/** Lo que el ensayo dice de un campo: el título del libro, cuánto hay, o por qué no va a funcionar. */
export function Nota({ id, estado }: { id: string; estado?: Estado }) {
  return (
    <p id={id} aria-live="polite" className={`flex items-start gap-1.5 text-sm font-medium ${estado ? `aparece mt-1.5 ${TONO[estado.tono]}` : ""}`}>
      {estado && (
        <>
          <Icono nombre={estado.tono === "ok" ? "ok" : "alerta"} className="mt-0.5 size-4" />
          <span className="min-w-0">{estado.texto}</span>
        </>
      )}
    </p>
  );
}

/**
 * Formulario de escaneo. Funciona igual con lector USB (escribe y manda Enter), con la cámara
 * del teléfono o tipeando. Con Enter se pasa al campo siguiente y en el último se confirma.
 *
 * Con `contexto`, cada cosa que se escribe se ensaya contra el servidor antes de confirmar:
 * el campo sugiere qué poner, dice qué libro o estante es, y avisa si no va a funcionar.
 */
export function Escaneo({
  accion,
  campos,
  ocultos = {},
  cantidad,
  boton = "Confirmar",
  contexto,
  children,
}: {
  accion: Accion;
  campos: Campo[];
  ocultos?: Record<string, string | number>;
  /** Si se pasa, muestra el campo de cantidad con ese valor inicial. */
  cantidad?: number;
  boton?: string;
  /** Qué flujo es (mover, guardar, picking…): define qué se revisa y qué se sugiere. */
  contexto?: string;
  children?: ReactNode;
}) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  const form = useRef<HTMLFormElement>(null);
  const [camaraEn, setCamaraEn] = useState<string | null>(null);
  const [consulta, setConsulta] = useState<(Consulta & { campo: string | null }) | null>(null);
  const [foco, setFoco] = useState<string | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [activa, setActiva] = useState(-1);
  const reloj = useRef<ReturnType<typeof setTimeout>>(undefined);
  const turno = useRef(0);
  /** Los valores para los que se calculó el último ensayo: solo frena el envío si siguen siendo esos. */
  const ensayado = useRef("");

  const entradas = useCallback(() => campos.map((c) => form.current?.elements.namedItem(c.nombre) as HTMLInputElement | null), [campos]);
  const entrada = (nombre: string) => form.current?.elements.namedItem(nombre) as HTMLInputElement | null;

  const huella = useCallback(() => {
    const q = new URLSearchParams();
    if (form.current) for (const [k, v] of new FormData(form.current)) if (typeof v === "string" && v.trim()) q.set(k, v.trim());
    q.sort();
    return q;
  }, []);

  /** Ensaya lo escrito hasta ahora. `enFoco` es el campo para el que se piden sugerencias. */
  const ensayar = useCallback(
    (enFoco: string | null, ya = false) => {
      if (!contexto) return;
      clearTimeout(reloj.current);
      reloj.current = setTimeout(
        async () => {
          const q = huella();
          const clave = q.toString();
          q.set("ctx", contexto);
          if (enFoco) q.set("campo", enFoco);
          const mio = ++turno.current;
          try {
            const r = await fetch(`/api/consulta?${q}`);
            if (!r.ok || mio !== turno.current) return;
            const c = (await r.json()) as Consulta;
            if (mio !== turno.current) return;
            ensayado.current = clave;
            setConsulta({ ...c, campo: enFoco });
            setActiva(-1);
          } catch {
            /* sin red no hay ensayo; la acción valida igual */
          }
        },
        ya ? 0 : 160,
      );
    },
    [contexto, huella],
  );
  useEffect(() => () => clearTimeout(reloj.current), []);

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
      setConsulta(null);
      enfocarPrimeroVacio();
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

  /** Pone un valor elegido (una sugerencia o un atajo) y sigue en el próximo campo vacío, sin confirmar. */
  function poner(nombre: string, valor: string) {
    const e = entrada(nombre);
    if (!e) return;
    e.value = valor;
    setAbierta(false);
    const vacio = entradas().find((x) => x && !x.value);
    const destino = vacio ?? entrada("cantidad") ?? e;
    destino.focus();
    if (destino === e || destino.name === "cantidad") ensayar(null, true);
  }

  const alLeer = useCallback(
    (codigo: string) => {
      const i = campos.findIndex((c) => c.nombre === camaraEn);
      const e = entradas()[i];
      setCamaraEn(null);
      if (!e) return;
      e.value = codigo;
      ensayar(null, true);
      avanzar(i);
    },
    [avanzar, camaraEn, campos, ensayar, entradas],
  );
  const cerrarCamara = useCallback(() => setCamaraEn(null), []);

  const sugerencias = abierta && consulta && consulta.campo === foco ? consulta.sugerencias : [];
  const atajosDe = (nombre: string) => (consulta?.atajos ?? []).filter((a) => a.campo === nombre);

  return (
    <form
      ref={form}
      className="space-y-3.5 rounded-control border border-borde-fuerte bg-superficie p-4"
      autoComplete="off"
      onInput={(e) => {
        const nombre = (e.target as HTMLInputElement).name;
        // Lo que se dijo de este campo ya no vale para lo que se está escribiendo ahora.
        setConsulta((c) => (c && c.estados[nombre] ? { ...c, estados: { ...c.estados, [nombre]: undefined as never } } : c));
        const esCampo = campos.some((c) => c.nombre === nombre);
        if (esCampo) setFoco(nombre);
        setAbierta(true);
        ensayar(esCampo ? nombre : null);
      }}
      onSubmit={(e) => {
        // Se envía a mano para que, si hay un error, lo ya escaneado no se borre.
        e.preventDefault();
        // Si el ensayo ya dijo que esto no va a funcionar, no hace falta ir al servidor a enterarse.
        const malo = consulta && ensayado.current === huella().toString() ? [...campos.map((c) => c.nombre), "cantidad"].find((n) => consulta.estados[n]?.tono === "peligro") : undefined;
        if (malo) {
          sonar("error");
          entrada(malo)?.focus();
          entrada(malo)?.select();
          return;
        }
        const datos = new FormData(e.currentTarget);
        startTransition(() => enviar(datos));
      }}
    >
      {Object.entries(ocultos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {campos.map((c, i) => {
        const nota = consulta?.estados[c.nombre];
        const lista = foco === c.nombre ? sugerencias : [];
        return (
          <div key={c.nombre}>
            <label htmlFor={`esc-${c.nombre}`} className="etiqueta">
              {c.etiqueta}
            </label>
            <div className="relative flex gap-2">
              <input
                id={`esc-${c.nombre}`}
                name={c.nombre}
                defaultValue={c.valor ?? ""}
                className={`campo font-mono font-bold placeholder:font-sans placeholder:font-normal ${nota?.tono === "ok" ? "border-ok" : nota?.tono === "peligro" ? "border-peligro" : ""}`}
                placeholder={c.ayuda ?? "Escaneá o escribí"}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={i === campos.length - 1 ? "done" : "next"}
                required
                role={contexto ? "combobox" : undefined}
                aria-autocomplete={contexto ? "list" : undefined}
                aria-expanded={contexto ? lista.length > 0 : undefined}
                aria-controls={contexto ? `sug-${c.nombre}` : undefined}
                aria-activedescendant={lista.length > 0 && activa >= 0 ? `sug-${c.nombre}-${activa}` : undefined}
                aria-describedby={`nota-${c.nombre}`}
                aria-invalid={nota?.tono === "peligro" || undefined}
                onFocus={() => {
                  setFoco(c.nombre);
                  setAbierta(true);
                  ensayar(c.nombre, true);
                }}
                onBlur={() => setAbierta(false)}
                onKeyDown={(ev) => {
                  if (lista.length > 0 && (ev.key === "ArrowDown" || ev.key === "ArrowUp")) {
                    ev.preventDefault();
                    setActiva((a) => (ev.key === "ArrowDown" ? (a + 1) % lista.length : (a <= 0 ? lista.length : a) - 1));
                    return;
                  }
                  if (ev.key === "Escape" && lista.length > 0) return setAbierta(false);
                  if (ev.key !== "Enter") return;
                  ev.preventDefault();
                  // El lector manda Enter apenas termina: solo se elige una sugerencia si se bajó a ella con las flechas.
                  if (lista.length > 0 && activa >= 0) return poner(c.nombre, lista[activa].valor);
                  if (ev.currentTarget.value.trim()) avanzar(i);
                }}
              />
              <button type="button" className="boton-suave px-3" aria-label={`Leer ${c.etiqueta.toLowerCase()} con la cámara`} onClick={() => setCamaraEn(c.nombre)}>
                <Icono nombre="camara" />
              </button>
              {contexto && (
                <ul id={`sug-${c.nombre}`} role="listbox" aria-label={`Sugerencias para ${c.etiqueta.toLowerCase()}`} hidden={lista.length === 0} className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-control border border-borde-fuerte bg-superficie py-1 shadow-flotante">
                  {lista.map((s, n) => (
                    <li
                      key={s.valor}
                      id={`sug-${c.nombre}-${n}`}
                      role="option"
                      aria-selected={n === activa}
                      // Con mousedown el campo no llega a perder el foco antes de elegir.
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        poner(c.nombre, s.valor);
                      }}
                      onMouseEnter={() => setActiva(n)}
                      className={`flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm ${n === activa ? "bg-acento-suave" : ""}`}
                    >
                      {s.tipo === "ubicacion" ? <Tejuelo codigo={s.titulo} /> : <span className="min-w-0 flex-1 truncate font-semibold">{s.titulo}</span>}
                      {s.detalle && <span className={`shrink-0 text-suave ${s.tipo === "producto" ? "max-w-[45%] truncate font-mono text-[13px] font-bold" : ""}`}>{s.detalle}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Nota id={`nota-${c.nombre}`} estado={nota} />
            <Atajos lista={atajosDe(c.nombre)} poner={poner} />
          </div>
        );
      })}
      {children}
      <div>
        <div className="flex items-end gap-3">
          {cantidad != null && (
            <div className="w-28">
              <label htmlFor="esc-cantidad" className="etiqueta">
                Cantidad
              </label>
              <input
                id="esc-cantidad"
                name="cantidad"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                defaultValue={cantidad}
                key={cantidad}
                className={`campo text-center font-bold ${consulta?.estados.cantidad?.tono === "peligro" ? "border-peligro" : ""}`}
                aria-describedby="nota-cantidad"
                aria-invalid={consulta?.estados.cantidad?.tono === "peligro" || undefined}
                required
              />
            </div>
          )}
          <button className="boton flex-1" disabled={enviando}>
            {enviando ? "Un momento…" : boton}
          </button>
        </div>
        <Nota id="nota-cantidad" estado={consulta?.estados.cantidad} />
        <Atajos lista={atajosDe("cantidad")} poner={poner} />
      </div>
      <Mensaje estado={estado} />
      {camaraEn && <Camara alLeer={alLeer} alCerrar={cerrarCamara} />}
    </form>
  );
}

/** Valores que se ponen con un toque: "Está en A-01-1", "Todas: 60". */
function Atajos({ lista, poner }: { lista: Atajo[]; poner: (campo: string, valor: string) => void }) {
  if (lista.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {lista.map((a) => (
        <button key={a.campo + a.valor} type="button" className="boton-chico" onClick={() => poner(a.campo, a.valor)}>
          {a.texto}
          {a.tejuelo && <Tejuelo codigo={a.valor} />}
          {a.sufijo}
        </button>
      ))}
    </div>
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
  motivo,
}: {
  accion: Accion;
  ocultos?: Record<string, string | number>;
  children: ReactNode;
  clase?: string;
  confirmar?: string;
  mostrarOk?: boolean;
  /** Si la acción no puede funcionar todavía, por qué: el botón queda apagado y lo dice. */
  motivo?: string;
}) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  const id = useId();
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
      <button className={clase} disabled={enviando || Boolean(motivo)} aria-describedby={motivo ? id : undefined}>
        {enviando ? "Un momento…" : children}
      </button>
      {motivo && (
        <p id={id} className="basis-full text-sm text-suave">
          {motivo}
        </p>
      )}
      {(estado.error || (mostrarOk && estado.ok)) && (
        <div className="basis-full">
          <Mensaje estado={estado} />
        </div>
      )}
    </form>
  );
}

/** Formulario común (no de escaneo) que muestra la respuesta de la acción debajo. */
export function Formulario({
  accion,
  children,
  boton,
  clase = "space-y-4",
  reiniciar = true,
  algunoDe,
}: {
  accion: Accion;
  children: ReactNode;
  boton: string;
  clase?: string;
  reiniciar?: boolean;
  /** Campos de los que hay que completar al menos uno; si no, el navegador lo pide antes de enviar. */
  algunoDe?: { campos: string[]; mensaje: string };
}) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok && reiniciar) form.current?.reset();
  }, [estado, reiniciar]);
  return (
    <form
      ref={form}
      action={enviar}
      className={clase}
      onInput={() => algunoDe?.campos.forEach((n) => (form.current?.elements.namedItem(n) as HTMLInputElement | null)?.setCustomValidity(""))}
      onSubmit={(e) => {
        const entradas = (algunoDe?.campos ?? []).map((n) => e.currentTarget.elements.namedItem(n) as HTMLInputElement | null);
        if (entradas.length === 0 || entradas.some((x) => x?.value.trim())) return;
        e.preventDefault();
        entradas[0]?.setCustomValidity(algunoDe!.mensaje);
        entradas[0]?.reportValidity();
      }}
    >
      {children}
      <button className="boton" disabled={enviando}>
        {enviando ? "Un momento…" : boton}
      </button>
      <Mensaje estado={estado} />
    </form>
  );
}
