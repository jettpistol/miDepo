"use client";

import { useActionState, useEffect, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { Message } from "@/components/ScanForm";
import { withCode } from "@/lib/errors";
import { loginWithPassword, loginWithPin } from "./actions";

type Mode = "pin" | "password";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("password");
  const [company, setCompany] = useState("");
  const [password, submitPassword, submittingPassword] = useActionState(loginWithPassword, {});
  const [pin, submitPin, submittingPin] = useActionState(loginWithPin, {});
  const [passkey, setPasskey] = useState<string | null>(null);

  // The phone remembers the company code and that the last login was by PIN.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("midepo-company");
      if (saved) {
        setCompany(saved);
        setMode("pin");
      }
    } catch {}
  }, []);

  async function withPasskey() {
    setPasskey(null);
    try {
      const options = await (await fetch("/api/passkeys/login-options", { method: "POST" })).json();
      const reply = await startAuthentication({ optionsJSON: options });
      const r = await fetch("/api/passkeys/login-verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(reply) });
      if (!r.ok) throw new Error((await r.json()).error);
      window.location.href = "/";
    } catch (e) {
      const cancelled = e instanceof Error && (e.name === "NotAllowedError" || e.name === "AbortError");
      setPasskey(cancelled ? withCode("Se canceló el inicio de sesión con huella o llave.", "PKEY-10") : e instanceof Error && e.message ? e.message : withCode("No se pudo iniciar sesión con huella o llave.", "PKEY-11"));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-5 border-b border-line" role="tablist">
        {(["password", "pin"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`-mb-px cursor-pointer border-b-2 px-0.5 py-2 text-sm transition-colors duration-150 ${mode === m ? "border-accent-text font-bold text-accent-text" : "border-transparent font-medium text-muted hover:text-ink"}`}>
            {m === "password" ? "Email y contraseña" : "PIN del depósito"}
          </button>
        ))}
      </div>

      {mode === "password" ? (
        <form action={submitPassword} className="space-y-4">
          <div>
            <label htmlFor="email" className="field-label">Email</label>
            <input id="email" name="email" type="email" autoComplete="username webauthn" className="field" required />
          </div>
          <div>
            <label htmlFor="password" className="field-label">Contraseña</label>
            <input id="password" name="password" type="password" autoComplete="current-password" className="field" required />
          </div>
          <button className="btn w-full" disabled={submittingPassword}>{submittingPassword ? "Un momento…" : "Iniciar sesión"}</button>
          <Message status={password} />
        </form>
      ) : (
        <form action={submitPin} className="space-y-4" onSubmit={(e) => { try { localStorage.setItem("midepo-company", String(new FormData(e.currentTarget).get("company")).toLowerCase().trim()); } catch {} }}>
          <div>
            <label htmlFor="company" className="field-label">Código de empresa</label>
            <input id="company" name="company" value={company} onChange={(e) => setCompany(e.target.value)} autoCapitalize="none" autoCorrect="off" className="field" placeholder="Por ejemplo: ovnipress" required />
          </div>
          <div>
            <label htmlFor="pin" className="field-label">Tu PIN</label>
            <input id="pin" name="pin" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="off" className="field text-center font-mono text-2xl tracking-[0.5em]" placeholder="••••••" required />
          </div>
          <button className="btn w-full" disabled={submittingPin}>{submittingPin ? "Un momento…" : "Iniciar sesión"}</button>
          <Message status={pin} />
        </form>
      )}

      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="h-px flex-1 bg-line" /> o <span className="h-px flex-1 bg-line" />
      </div>
      <button type="button" onClick={withPasskey} className="btn-soft w-full">Iniciar sesión con huella, rostro o llave</button>
      {passkey && <Message status={{ error: passkey }} />}
    </div>
  );
}
