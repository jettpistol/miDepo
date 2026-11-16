"use client";

import { useActionState, useEffect, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { Mensaje } from "@/components/Escaneo";
import { ingresarConClave, ingresarConPin } from "./acciones";

type Modo = "pin" | "clave";

export function Ingreso() {
  const [modo, setModo] = useState<Modo>("clave");
  const [empresa, setEmpresa] = useState("");
  const [clave, enviarClave, enviandoClave] = useActionState(ingresarConClave, {});
  const [pin, enviarPin, enviandoPin] = useActionState(ingresarConPin, {});
  const [llave, setLlave] = useState<string | null>(null);

  // El teléfono recuerda el código de empresa y que la última vez se entró con PIN.
  useEffect(() => {
    try {
      const guardada = localStorage.getItem("midepo-empresa");
      if (guardada) {
        setEmpresa(guardada);
        setModo("pin");
      }
    } catch {}
  }, []);

  async function conLlave() {
    setLlave(null);
    try {
      const opciones = await (await fetch("/api/llaves/ingreso-opciones", { method: "POST" })).json();
      const respuesta = await startAuthentication({ optionsJSON: opciones });
      const r = await fetch("/api/llaves/ingreso-verificar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(respuesta) });
      if (!r.ok) throw new Error((await r.json()).error);
      window.location.href = "/";
    } catch (e) {
      const cancelado = e instanceof Error && (e.name === "NotAllowedError" || e.name === "AbortError");
      setLlave(cancelado ? "Se canceló el ingreso con huella o llave." : e instanceof Error && e.message ? e.message : "No se pudo entrar con huella o llave.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-5 border-b border-borde" role="tablist">
        {(["clave", "pin"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={modo === m} onClick={() => setModo(m)} className={`-mb-px cursor-pointer border-b-2 px-0.5 py-2 text-sm transition-colors duration-150 ${modo === m ? "border-acento-texto font-bold text-acento-texto" : "border-transparent font-medium text-suave hover:text-texto"}`}>
            {m === "clave" ? "Email y contraseña" : "PIN del depósito"}
          </button>
        ))}
      </div>

      {modo === "clave" ? (
        <form action={enviarClave} className="space-y-4">
          <div>
            <label htmlFor="email" className="etiqueta">Email</label>
            <input id="email" name="email" type="email" autoComplete="username webauthn" className="campo" required />
          </div>
          <div>
            <label htmlFor="clave" className="etiqueta">Contraseña</label>
            <input id="clave" name="clave" type="password" autoComplete="current-password" className="campo" required />
          </div>
          <button className="boton w-full" disabled={enviandoClave}>{enviandoClave ? "Entrando…" : "Entrar"}</button>
          <Mensaje estado={clave} />
        </form>
      ) : (
        <form action={enviarPin} className="space-y-4" onSubmit={(e) => { try { localStorage.setItem("midepo-empresa", String(new FormData(e.currentTarget).get("empresa")).toLowerCase().trim()); } catch {} }}>
          <div>
            <label htmlFor="empresa" className="etiqueta">Código de empresa</label>
            <input id="empresa" name="empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} autoCapitalize="none" autoCorrect="off" className="campo" placeholder="Por ejemplo: ovnipress" required />
          </div>
          <div>
            <label htmlFor="pin" className="etiqueta">Tu PIN</label>
            <input id="pin" name="pin" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="off" className="campo text-center font-mono text-2xl tracking-[0.5em]" placeholder="••••••" required />
          </div>
          <button className="boton w-full" disabled={enviandoPin}>{enviandoPin ? "Entrando…" : "Entrar"}</button>
          <Mensaje estado={pin} />
        </form>
      )}

      <div className="flex items-center gap-3 text-sm text-suave">
        <span className="h-px flex-1 bg-borde" /> o <span className="h-px flex-1 bg-borde" />
      </div>
      <button type="button" onClick={conLlave} className="boton-suave w-full">Entrar con huella, rostro o llave</button>
      {llave && <Mensaje estado={{ error: llave }} />}
    </div>
  );
}
