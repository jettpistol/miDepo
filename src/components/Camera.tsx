"use client";

import { useEffect, useRef, useState } from "react";

import { withCode } from "@/lib/errors";

const NO_PERMISSION = withCode("miDepo no tiene permiso para usar la cámara. Habilítalo en los ajustes del navegador y vuelve a intentar.", "CAM-01");
const NO_CAMERA = withCode("No pude abrir la cámara en este dispositivo. Puedes escribir el código a mano.", "CAM-02");

type Detector = { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> };
const FORMATS = ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "qr_code"];

async function createDetector(): Promise<Detector> {
  const native = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  if (native) return new native({ formats: FORMATS });
  // iPhones and some browsers have no built-in barcode reader: one bundled with miDepo is used instead.
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  prepareZXingModule({ overrides: { locateFile: (pathname: string, prefix: string) => (pathname.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + pathname) } });
  return new BarcodeDetector({ formats: FORMATS as never }) as unknown as Detector;
}

/** Scanner using the phone camera. Calls `onRead` with the first code it finds. */
export function Camera({ onRead, onClose }: { onRead: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return setError(NO_CAMERA);
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!active || !video.current) return stream.getTracks().forEach((t) => t.stop());
        video.current.srcObject = stream;
        await video.current.play();
        const detector = await createDetector();
        timer = setInterval(async () => {
          if (!video.current || video.current.readyState < 2) return;
          const [hit] = await detector.detect(video.current).catch(() => []);
          if (hit && active) {
            active = false;
            onRead(hit.rawValue);
          }
        }, 180);
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        setError(name === "NotAllowedError" ? NO_PERMISSION : NO_CAMERA);
      }
    })();
    return () => {
      active = false;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onRead]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4" role="dialog" aria-label="Lector con cámara">
      <div className="relative mx-auto flex w-full max-w-lg flex-1 items-center">
        {error ? (
          <p className="w-full rounded-control bg-surface p-4 text-center text-sm font-medium text-ink">{error}</p>
        ) : (
          <>
            <video ref={video} playsInline muted className="max-h-[70dvh] w-full rounded-control object-cover" />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-control border-2 border-white/90" />
          </>
        )}
      </div>
      <p className="mb-3 text-center text-sm text-white/80">Apunta al código de barras. Se lee solo.</p>
      <button type="button" onClick={onClose} className="btn-soft mx-auto w-full max-w-lg">
        Cerrar cámara
      </button>
    </div>
  );
}
