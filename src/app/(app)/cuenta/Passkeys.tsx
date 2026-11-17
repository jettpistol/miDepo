"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { Message } from "@/components/ScanForm";
import type { Result } from "@/lib/errors";

/** Registers a passkey on this device: fingerprint, face or the device's own PIN. */
export function AddPasskey() {
  const [status, setStatus] = useState<Result>({});
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function add() {
    setBusy(true);
    setStatus({});
    try {
      const options = await (await fetch("/api/passkeys/register-options", { method: "POST" })).json();
      if (options.error) throw new Error(options.error);
      const reply = await startRegistration({ optionsJSON: options });
      const isPhone = /Android|iPhone|iPad/i.test(navigator.userAgent);
      const r = await fetch("/api/passkeys/register-verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reply, name: isPhone ? "Teléfono" : "Computadora" }) });
      if (!r.ok) throw new Error((await r.json()).error);
      setStatus({ ok: "Listo. La próxima vez podés entrar con huella, rostro o llave." });
      router.refresh();
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      setStatus({
        error:
          name === "NotAllowedError" || name === "AbortError"
            ? "Se canceló el registro."
            : name === "InvalidStateError"
              ? "Este dispositivo ya tiene una llave registrada para tu usuario."
              : e instanceof Error && e.message
                ? e.message
                : "Este dispositivo no permite registrar una llave.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={add} disabled={busy} className="btn-soft">
        {busy ? "Esperando al dispositivo…" : "Registrar este dispositivo"}
      </button>
      <Message status={status} />
    </div>
  );
}
