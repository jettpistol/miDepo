"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { Mensaje } from "@/components/Escaneo";
import type { Resultado } from "@/lib/errores";

/** Registra en este dispositivo una llave de acceso: huella, rostro o PIN del equipo. */
export function AgregarLlave() {
  const [estado, setEstado] = useState<Resultado>({});
  const [ocupado, setOcupado] = useState(false);
  const router = useRouter();

  async function agregar() {
    setOcupado(true);
    setEstado({});
    try {
      const opciones = await (await fetch("/api/llaves/registro-opciones", { method: "POST" })).json();
      if (opciones.error) throw new Error(opciones.error);
      const respuesta = await startRegistration({ optionsJSON: opciones });
      const esTelefono = /Android|iPhone|iPad/i.test(navigator.userAgent);
      const r = await fetch("/api/llaves/registro-verificar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ respuesta, nombre: esTelefono ? "Teléfono" : "Computadora" }) });
      if (!r.ok) throw new Error((await r.json()).error);
      setEstado({ ok: "Listo. La próxima vez podés entrar con huella, rostro o llave." });
      router.refresh();
    } catch (e) {
      const nombre = e instanceof Error ? e.name : "";
      setEstado({
        error:
          nombre === "NotAllowedError" || nombre === "AbortError"
            ? "Se canceló el registro."
            : nombre === "InvalidStateError"
              ? "Este dispositivo ya tiene una llave registrada para tu usuario."
              : e instanceof Error && e.message
                ? e.message
                : "Este dispositivo no permite registrar una llave.",
      });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={agregar} disabled={ocupado} className="boton-suave">
        {ocupado ? "Esperando al dispositivo…" : "Registrar este dispositivo"}
      </button>
      <Mensaje estado={estado} />
    </div>
  );
}
