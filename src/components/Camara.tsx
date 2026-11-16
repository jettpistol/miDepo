"use client";

import { useEffect, useRef, useState } from "react";

type Detector = { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> };
const FORMATOS = ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "qr_code"];

async function crearDetector(): Promise<Detector> {
  const nativo = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  if (nativo) return new nativo({ formats: FORMATOS });
  // iPhone y algunos navegadores no traen lector propio: se usa uno incluido en miDepo.
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  prepareZXingModule({ overrides: { locateFile: (ruta: string, prefijo: string) => (ruta.endsWith(".wasm") ? "/zxing_reader.wasm" : prefijo + ruta) } });
  return new BarcodeDetector({ formats: FORMATOS as never }) as unknown as Detector;
}

/** Lector con la cámara del teléfono. Llama a `alLeer` con el primer código que encuentra. */
export function Camara({ alLeer, alCerrar }: { alLeer: (codigo: string) => void; alCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    let flujo: MediaStream | undefined;
    let reloj: ReturnType<typeof setInterval> | undefined;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("sin-camara");
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!activo || !video.current) return flujo.getTracks().forEach((t) => t.stop());
        video.current.srcObject = flujo;
        await video.current.play();
        const detector = await crearDetector();
        reloj = setInterval(async () => {
          if (!video.current || video.current.readyState < 2) return;
          const [hallado] = await detector.detect(video.current).catch(() => []);
          if (hallado && activo) {
            activo = false;
            alLeer(hallado.rawValue);
          }
        }, 180);
      } catch (e) {
        const nombre = e instanceof Error ? e.name : "";
        setError(
          nombre === "NotAllowedError"
            ? "miDepo no tiene permiso para usar la cámara. Habilitalo en los ajustes del navegador y volvé a intentar."
            : "No pude abrir la cámara en este dispositivo. Podés escribir el código a mano.",
        );
      }
    })();
    return () => {
      activo = false;
      clearInterval(reloj);
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, [alLeer]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4" role="dialog" aria-label="Lector con cámara">
      <div className="relative mx-auto flex w-full max-w-lg flex-1 items-center">
        {error ? (
          <p className="w-full rounded-control bg-superficie p-4 text-center text-sm font-medium text-texto">{error}</p>
        ) : (
          <>
            <video ref={video} playsInline muted className="max-h-[70dvh] w-full rounded-control object-cover" />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-control border-2 border-white/90" />
          </>
        )}
      </div>
      <p className="mb-3 text-center text-sm text-white/80">Apuntá al código de barras. Se lee solo.</p>
      <button type="button" onClick={alCerrar} className="boton-suave mx-auto w-full max-w-lg">
        Cerrar cámara
      </button>
    </div>
  );
}
