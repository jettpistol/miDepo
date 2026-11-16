"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { Mensaje, type Accion } from "@/components/Escaneo";

const LADO = 256;

/** Recorta la imagen al centro, en cuadrado, y la achica: así pesa poco y carga al instante. */
async function preparar(archivo: File): Promise<string> {
  const imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  const lado = Math.min(imagen.width, imagen.height);
  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = LADO;
  const ctx = lienzo.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LADO, LADO);
  ctx.drawImage(imagen, (imagen.width - lado) / 2, (imagen.height - lado) / 2, lado, lado, 0, 0, LADO, LADO);
  return lienzo.toDataURL("image/jpeg", 0.85);
}

export function Foto({ accion, tiene }: { accion: Accion; tiene: boolean }) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  const [error, setError] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  async function elegir(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    try {
      const datos = new FormData();
      datos.set("foto", await preparar(archivo));
      startTransition(() => enviar(datos));
    } catch {
      setError("Ese archivo no es una imagen que pueda usar. Probá con una foto JPG o PNG.");
    } finally {
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input ref={entrada} type="file" accept="image/*" className="sr-only" id="foto-archivo" onChange={(e) => elegir(e.target.files?.[0])} />
      <label htmlFor="foto-archivo" className={`boton ${enviando ? "pointer-events-none opacity-50" : ""}`}>
        {enviando ? "Guardando…" : tiene ? "Cambiar foto" : "Subir una foto"}
      </label>
      <Mensaje estado={error ? { error } : estado} />
    </div>
  );
}
