"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { Message, type Action } from "@/components/ScanForm";

const SIDE = 256;

/** Crops the image to a centred square and shrinks it, so it is light and loads instantly. */
async function prepare(file: File): Promise<string> {
  const image = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIDE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SIDE, SIDE);
  ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, SIDE, SIDE);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function Photo({ action, has }: { action: Action; has: boolean }) {
  const [status, submit, submitting] = useActionState(action, {});
  const [error, setError] = useState<string | null>(null);
  const inputOf = useRef<HTMLInputElement>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const data = new FormData();
      data.set("photo", await prepare(file));
      startTransition(() => submit(data));
    } catch {
      setError("Ese archivo no es una imagen que pueda usar. Probá con una foto JPG o PNG.");
    } finally {
      if (inputOf.current) inputOf.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input ref={inputOf} type="file" accept="image/*" className="sr-only" id="photo-file" onChange={(e) => choose(e.target.files?.[0])} />
      <label htmlFor="photo-file" className={`btn-soft ${submitting ? "pointer-events-none opacity-55" : ""}`}>
        {submitting ? "Guardando…" : has ? "Cambiar foto" : "Subir una foto"}
      </label>
      <Message status={error ? { error } : status} />
    </div>
  );
}
