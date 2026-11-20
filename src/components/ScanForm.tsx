"use client";

import { startTransition, useActionState, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Shortcut, Lookup, FieldStatus } from "@/lib/lookup";
import { DisabledReason } from "./Hint";
import type { Result } from "@/lib/errors";
import { Camera } from "./Camera";
import { Icon } from "./Icon";
import { ShelfMark } from "./ui";
import { hotkey, type HotkeyName } from "@/lib/hotkeys";

export type Action = (prev: Result, data: FormData) => Promise<Result>;

function beep(type: "ok" | "error") {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audio = new Ctx();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = type === "ok" ? 880 : 200;
    osc.type = type === "ok" ? "sine" : "square";
    gain.gain.value = 0.08;
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + (type === "ok" ? 0.09 : 0.3));
    osc.onended = () => audio.close();
    navigator.vibrate?.(type === "ok" ? 40 : [90, 60, 90]);
  } catch {
    /* sin sonido no pasa nada */
  }
}

export function Message({ status }: { status: Result }) {
  if (!status.ok && !status.error) return null;
  const bad = Boolean(status.error);
  return (
    <p role="status" aria-live="polite" className={`fade-in flex items-start gap-2 rounded-control border px-3 py-2.5 text-[15px] font-semibold ${bad ? "border-danger/30 bg-danger-soft text-danger" : "border-ok/30 bg-ok-soft text-ok"}`}>
      <Icon name={bad ? "warn" : "ok"} className="mt-0.5 size-5" />
      <span>{status.error ?? status.ok}</span>
    </p>
  );
}

type Field = { name: string; label: string; help?: string; value?: string };

const TONE_CLASS = { ok: "text-ok", warn: "text-warn", danger: "text-danger" } as const;

/** What the rehearsal says about a field: the book's title, how much there is, or why it will not work. */
export function Note({ id, status }: { id: string; status?: FieldStatus }) {
  return (
    <p id={id} aria-live="polite" className={`flex items-start gap-1.5 text-sm font-medium ${status ? `fade-in mt-1.5 ${TONE_CLASS[status.tone]}` : ""}`}>
      {status && (
        <>
          <Icon name={status.tone === "ok" ? "ok" : "warn"} className="mt-0.5 size-4" />
          <span className="min-w-0">{status.text}</span>
        </>
      )}
    </p>
  );
}

/**
 * Scan form. Works the same with a USB scanner (types and sends Enter), with the phone
 * camera or by typing. Enter moves to the next field, and on the last one it confirms.
 *
 * With `context`, everything typed is rehearsed against the server before confirming:
 * the field suggests what to enter, says which book or shelf it is, and warns if it will not work.
 */
export function ScanForm({
  action,
  fields,
  hiddenFields = {},
  quantity,
  button = "Confirmar",
  context,
  children,
}: {
  action: Action;
  fields: Field[];
  hiddenFields?: Record<string, string | number>;
  /** If given, shows the quantity field with this initial value. */
  quantity?: number;
  button?: string;
  /** Which flow this is (move, putaway, picking…): decides what is checked and what is suggested. */
  context?: string;
  children?: ReactNode;
}) {
  const [status, submit, submitting] = useActionState(action, {});
  const form = useRef<HTMLFormElement>(null);
  const [cameraFor, setCameraFor] = useState<string | null>(null);
  const [lookup, setLookup] = useState<(Lookup & { field: string | null }) | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const turn = useRef(0);
  /** The values the last rehearsal was computed for: it only blocks the submit if they are still the same. */
  const rehearsed = useRef("");

  const inputs = useCallback(() => fields.map((c) => form.current?.elements.namedItem(c.name) as HTMLInputElement | null), [fields]);
  const inputOf = (name: string) => form.current?.elements.namedItem(name) as HTMLInputElement | null;

  const fingerprint = useCallback(() => {
    const q = new URLSearchParams();
    if (form.current) for (const [k, v] of new FormData(form.current)) if (typeof v === "string" && v.trim()) q.set(k, v.trim());
    q.sort();
    return q;
  }, []);

  /** Rehearses what has been typed so far. `focused` is the field suggestions are requested for. */
  const rehearse = useCallback(
    (focused: string | null, immediate = false) => {
      if (!context) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(
        async () => {
          const q = fingerprint();
          const key = q.toString();
          q.set("ctx", context);
          if (focused) q.set("field", focused);
          const mine = ++turn.current;
          try {
            const r = await fetch(`/api/lookup?${q}`);
            if (!r.ok || mine !== turn.current) return;
            const c = (await r.json()) as Lookup;
            if (mine !== turn.current) return;
            rehearsed.current = key;
            setLookup({ ...c, field: focused });
            setActive(-1);
          } catch {
            /* sin red no hay ensayo; la acción valida igual */
          }
        },
        immediate ? 0 : 160,
      );
    },
    [context, fingerprint],
  );
  useEffect(() => () => clearTimeout(timer.current), []);

  const focusFirstEmpty = useCallback(() => {
    const els = inputs();
    (els.find((e) => e && !e.value) ?? els[0])?.focus();
  }, [inputs]);

  useEffect(() => {
    if (!status.ok && !status.error) return focusFirstEmpty();
    beep(status.error ? "error" : "ok");
    const els = inputs();
    if (status.ok) {
      els.forEach((e, i) => e && (e.value = fields[i].value ?? ""));
      const qty = form.current?.elements.namedItem("quantity") as HTMLInputElement | null;
      if (qty && quantity != null) qty.value = String(quantity);
      setLookup(null);
      focusFirstEmpty();
    } else {
      const first = els.find((e) => e && !fields[els.indexOf(e)].value) ?? els[0];
      first?.focus();
      first?.select();
    }
    // Solo interesa reaccionar a una respuesta nueva del servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  /** Moves to the next empty field or, if none is left, confirms. */
  const advance = useCallback(
    (fromLoc: number) => {
      const nextOne = inputs().find((e, i) => i > fromLoc && e && !e.value);
      if (nextOne) nextOne.focus();
      else form.current?.requestSubmit();
    },
    [inputs],
  );

  /** Sets a chosen value (a suggestion or a shortcut) and carries on at the next empty field, without confirming. */
  function setValue(name: string, value: string) {
    const e = inputOf(name);
    if (!e) return;
    e.value = value;
    setOpen(false);
    const emptyOne = inputs().find((x) => x && !x.value);
    const destination = emptyOne ?? inputOf("quantity") ?? e;
    destination.focus();
    if (destination === e || destination.name === "quantity") rehearse(null, true);
  }

  const onRead = useCallback(
    (code: string) => {
      const i = fields.findIndex((c) => c.name === cameraFor);
      const e = inputs()[i];
      setCameraFor(null);
      if (!e) return;
      e.value = code;
      rehearse(null, true);
      advance(i);
    },
    [advance, cameraFor, fields, rehearse, inputs],
  );
  const closeCamera = useCallback(() => setCameraFor(null), []);

  const suggestions = open && lookup && lookup.field === focusedField ? lookup.suggestions : [];
  const shortcutsFor = (name: string) => (lookup?.shortcuts ?? []).filter((a) => a.field === name);
  // F7 fills a suggested shelf: the first one for the field being filled, or else the first one there is.
  const shelves = (lookup?.shortcuts ?? []).filter((a) => a.shelfMark);
  const shelfKey = shelves.find((a) => a.field === focusedField) ?? shelves[0];

  /** Esc: starts the scan over, keeping the fields that came filled in. */
  function clear() {
    inputs().forEach((e, i) => e && (e.value = fields[i].value ?? ""));
    const qty = inputOf("quantity");
    if (qty && quantity != null) qty.value = String(quantity);
    setLookup(null);
    setOpen(false);
    focusFirstEmpty();
  }

  return (
    <form
      ref={form}
      className="space-y-3.5 rounded-control border border-line-strong bg-surface p-4 lg:p-3"
      autoComplete="off"
      onInput={(e) => {
        const name = (e.target as HTMLInputElement).name;
        // What was said about this field no longer holds for what is being typed now.
        setLookup((c) => (c && c.statuses[name] ? { ...c, statuses: { ...c.statuses, [name]: undefined as never } } : c));
        const isField = fields.some((c) => c.name === name);
        if (isField) setFocusedField(name);
        setOpen(true);
        rehearse(isField ? name : null);
      }}
      onSubmit={(e) => {
        // Submitted by hand so that, on an error, what was already scanned is not cleared.
        e.preventDefault();
        // If the rehearsal already said this will not work, there is no need to ask the server to find out.
        const badField = lookup && rehearsed.current === fingerprint().toString() ? [...fields.map((c) => c.name), "quantity"].find((n) => lookup.statuses[n]?.tone === "danger") : undefined;
        if (badField) {
          beep("error");
          inputOf(badField)?.focus();
          inputOf(badField)?.select();
          return;
        }
        const data = new FormData(e.currentTarget);
        startTransition(() => submit(data));
      }}
    >
      {Object.entries(hiddenFields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {fields.map((c, i) => {
        const note = lookup?.statuses[c.name];
        const list = focusedField === c.name ? suggestions : [];
        return (
          <div key={c.name}>
            <label htmlFor={`scan-${c.name}`} className="field-label">
              {c.label}
            </label>
            <div className="relative flex gap-2">
              <input
                id={`scan-${c.name}`}
                name={c.name}
                data-scan-field
                defaultValue={c.value ?? ""}
                className={`field font-mono font-bold placeholder-shown:font-sans placeholder-shown:font-normal ${note?.tone === "ok" ? "border-ok" : note?.tone === "danger" ? "border-danger" : ""}`}
                placeholder={c.help ?? "Escanea o escribe"}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={i === fields.length - 1 ? "done" : "next"}
                required
                role={context ? "combobox" : undefined}
                aria-autocomplete={context ? "list" : undefined}
                aria-expanded={context ? list.length > 0 : undefined}
                aria-controls={context ? `sug-${c.name}` : undefined}
                aria-activedescendant={list.length > 0 && active >= 0 ? `sug-${c.name}-${active}` : undefined}
                aria-describedby={`note-${c.name}`}
                aria-invalid={note?.tone === "danger" || undefined}
                onFocus={() => {
                  setFocusedField(c.name);
                  setOpen(true);
                  rehearse(c.name, true);
                }}
                onBlur={() => setOpen(false)}
                onKeyDown={(ev) => {
                  if (list.length > 0 && (ev.key === "ArrowDown" || ev.key === "ArrowUp")) {
                    ev.preventDefault();
                    setActive((a) => (ev.key === "ArrowDown" ? (a + 1) % list.length : (a <= 0 ? list.length : a) - 1));
                    return;
                  }
                  if (ev.key === "Escape") {
                    ev.preventDefault();
                    return list.length > 0 ? setOpen(false) : clear();
                  }
                  if (ev.key !== "Enter") return;
                  ev.preventDefault();
                  // The scanner sends Enter the moment it finishes: a suggestion is only chosen if you arrowed down to it.
                  if (list.length > 0 && active >= 0) return setValue(c.name, list[active].value);
                  if (ev.currentTarget.value.trim()) advance(i);
                }}
              />
              <button type="button" className="btn-soft px-3" aria-label={`Leer ${c.label.toLowerCase()} con la cámara`} onClick={() => setCameraFor(c.name)}>
                <Icon name="camera" />
              </button>
              {context && (
                <ul id={`sug-${c.name}`} role="listbox" aria-label={`Sugerencias para ${c.label.toLowerCase()}`} hidden={list.length === 0} className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-control border border-line-strong bg-surface py-1 shadow-floating">
                  {list.map((s, n) => (
                    <li
                      key={s.value}
                      id={`sug-${c.name}-${n}`}
                      role="option"
                      aria-selected={n === active}
                      // With mousedown the field does not lose focus before the choice is made.
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        setValue(c.name, s.value);
                      }}
                      onMouseEnter={() => setActive(n)}
                      className={`flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm ${n === active ? "bg-accent-soft" : ""}`}
                    >
                      {s.type === "location" ? <ShelfMark code={s.title} /> : <span className="min-w-0 flex-1 truncate font-semibold">{s.title}</span>}
                      {s.detail && <span className={`shrink-0 text-muted ${s.type === "product" ? "max-w-[45%] truncate font-mono text-[13px] font-bold" : ""}`}>{s.detail}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Note id={`note-${c.name}`} status={note} />
            <Shortcuts list={shortcutsFor(c.name)} setValue={setValue} shelfKey={shelfKey} />
          </div>
        );
      })}
      {children}
      <div>
        <div className="flex items-end gap-3">
          {quantity != null && (
            <div className="w-28">
              <label htmlFor="scan-quantity" className="field-label">
                Cantidad
              </label>
              <input
                id="scan-quantity"
                name="quantity"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                defaultValue={quantity}
                key={quantity}
                className={`field text-center font-bold ${lookup?.statuses.quantity?.tone === "danger" ? "border-danger" : ""}`}
                aria-describedby="note-quantity"
                aria-invalid={lookup?.statuses.quantity?.tone === "danger" || undefined}
                required
              />
            </div>
          )}
          <button className="btn flex-1" disabled={submitting} {...hotkey("primary", button)}>
            {submitting ? "Un momento…" : button}
          </button>
        </div>
        <Note id="note-quantity" status={lookup?.statuses.quantity} />
        <Shortcuts list={shortcutsFor("quantity")} setValue={setValue} shelfKey={shelfKey} />
      </div>
      <Message status={status} />
      {cameraFor && <Camera onRead={onRead} onClose={closeCamera} />}
    </form>
  );
}

/** Values set with one tap: "Está en A-01-1", "Todas: 60". */
function Shortcuts({ list, setValue, shelfKey }: { list: Shortcut[]; setValue: (field: string, value: string) => void; shelfKey?: Shortcut }) {
  if (list.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {list.map((a, i) => (
        <button
          key={a.field + a.value}
          type="button"
          className="btn-sm"
          onClick={() => setValue(a.field, a.value)}
          // On the keyboard, the suggested quantity is F4 and the suggested shelf F7.
          {...(a === shelfKey ? hotkey("shelf", `${a.text} ${a.value}`) : a.field === "quantity" && i === 0 ? hotkey("quantity") : {})}
        >
          {a.text}
          {a.shelfMark && <ShelfMark code={a.value} />}
          {a.suffix}
        </button>
      ))}
    </div>
  );
}

/** Button that runs an action and shows its reply. With `confirm`, it asks first. */
export function ActionButton({
  action,
  hiddenFields = {},
  children,
  className = "btn",
  confirm,
  showOk = true,
  reason,
  hotkey: key,
}: {
  action: Action;
  hiddenFields?: Record<string, string | number>;
  children: ReactNode;
  className?: string;
  confirm?: string;
  showOk?: boolean;
  /** If the action cannot work yet, why: the button is disabled and says so. */
  reason?: string;
  /** The F-key that presses it (see src/lib/hotkeys.ts). */
  hotkey?: HotkeyName;
}) {
  const [status, submit, submitting] = useActionState(action, {});
  return (
    <form
      action={submit}
      className="contents"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(hiddenFields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <DisabledReason reason={reason} className={/\bw-full\b/.test(className) ? "flex w-full" : "inline-flex"}>
        <button className={className} disabled={submitting || Boolean(reason)} {...(key ? hotkey(key, typeof children === "string" ? children : undefined) : {})}>
          {submitting ? "Un momento…" : children}
        </button>
      </DisabledReason>
      {(status.error || (showOk && status.ok)) && (
        <div className="basis-full">
          <Message status={status} />
        </div>
      )}
    </form>
  );
}

/** Plain form (not a scan form) that shows the action's reply underneath. */
export function ActionForm({
  action,
  children,
  button,
  className = "space-y-4",
  resetOnOk = true,
  anyOf,
  hotkey: key,
  confirm,
  reason,
  buttonClassName = "btn",
}: {
  action: Action;
  children: ReactNode;
  button: string;
  className?: string;
  resetOnOk?: boolean;
  /** Fields of which at least one must be filled in; otherwise the browser asks before submitting. */
  anyOf?: { fields: string[]; message: string };
  /** The F-key that submits it (see src/lib/hotkeys.ts). */
  hotkey?: HotkeyName;
  /** Asked before sending. */
  confirm?: string;
  /** If the form cannot be sent yet, why: the button is disabled and says so. */
  reason?: string;
  buttonClassName?: string;
}) {
  const [status, submit, submitting] = useActionState(action, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (status.ok && resetOnOk) form.current?.reset();
  }, [status, resetOnOk]);
  return (
    <form
      ref={form}
      action={submit}
      className={className}
      onInput={() => anyOf?.fields.forEach((n) => (form.current?.elements.namedItem(n) as HTMLInputElement | null)?.setCustomValidity(""))}
      onSubmit={(e) => {
        const inputs = (anyOf?.fields ?? []).map((n) => e.currentTarget.elements.namedItem(n) as HTMLInputElement | null);
        if (inputs.length === 0 || inputs.some((x) => x?.value.trim())) {
          if (confirm && !window.confirm(confirm)) e.preventDefault();
          return;
        }
        e.preventDefault();
        inputs[0]?.setCustomValidity(anyOf!.message);
        inputs[0]?.reportValidity();
      }}
    >
      {children}
      <DisabledReason reason={reason} className={/\bw-full\b/.test(buttonClassName) ? "flex w-full" : "inline-flex"}>
        <button className={buttonClassName} disabled={submitting || Boolean(reason)} {...(key ? hotkey(key, button) : {})}>
          {submitting ? "Un momento…" : button}
        </button>
      </DisabledReason>
      <Message status={status} />
    </form>
  );
}
