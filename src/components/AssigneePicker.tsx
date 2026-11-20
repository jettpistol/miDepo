"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { assignAction } from "@/app/(app)/actions";
import type { AssignKind } from "@/lib/flows/assignments";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Select } from "./Select";

export type Person = { id: number; name: string; role: string; accent: string; photoVersion: number | null };

const SIZE = { sm: "size-6 text-[10px]", md: "size-7 text-[11px]" };

/** Grey person in a dashed circle: the work is nobody's. */
export function NobodyIcon({ size = "sm" }: { size?: keyof typeof SIZE }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-muted ${SIZE[size]}`}>
      <Icon name="user" className="size-3.5" />
    </span>
  );
}

const nameOf = (p: Person, me: number) => (p.id === me ? `${p.name} (tú)` : p.name);

/** Whose the work is, as avatar and name; read-only. */
export function AssigneeChip({ person, me, iconOnly = false }: { person: Person | undefined; me: number; iconOnly?: boolean }) {
  const text = person ? nameOf(person, me) : "Sin asignar";
  return (
    <span className="inline-flex max-w-full items-center gap-2" title={iconOnly ? `Asignado a: ${text}` : undefined}>
      {person ? <Avatar person={person} className={SIZE.sm} /> : <NobodyIcon />}
      {iconOnly ? <span className="sr-only">{`Asignado a: ${text}`}</span> : <span className={`min-w-0 truncate ${person ? "" : "text-muted"}`}>{text}</span>}
    </span>
  );
}

/**
 * Assignee like Jira's: avatar and name; supervisors click it to give the work to someone else,
 * and it saves at once. `editable` false shows the same thing without the picker.
 */
export function AssigneePicker({ kind, id, value, people, me, editable, iconOnly = false }: { kind: AssignKind; id: number; value: number | null; people: Person[]; me: number; editable: boolean; iconOnly?: boolean }) {
  const [status, submit, saving] = useActionState(assignAction, {});
  const [chosen, setChosen] = useState(value == null ? "" : String(value));
  const form = useRef<HTMLFormElement>(null);
  const saved = useRef(chosen);
  useEffect(() => {
    setChosen(value == null ? "" : String(value));
    saved.current = value == null ? "" : String(value);
  }, [value]);
  // Sends once the hidden field holds the new choice.
  useEffect(() => {
    if (chosen !== saved.current) {
      saved.current = chosen;
      form.current?.requestSubmit();
    }
  }, [chosen]);

  if (!editable) return <AssigneeChip person={people.find((p) => p.id === value)} me={me} iconOnly={iconOnly} />;
  const options = [
    { value: "", label: "Sin asignar", icon: <NobodyIcon /> },
    ...people.map((p) => ({ value: String(p.id), label: nameOf(p, me), icon: <Avatar person={p} className={SIZE.sm} /> })),
  ];
  return (
    <form ref={form} action={submit} className={`inline-flex max-w-full flex-col items-start ${iconOnly ? "" : "-mx-1.5"} ${saving ? "opacity-60" : ""}`}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <Select name="userId" label="Asignado a" value={chosen} onChange={setChosen} options={options} searchPlaceholder="Buscar persona…" variant={iconOnly ? "icon" : "inline"} />
      {status.error && (
        <span role="alert" className="text-xs font-medium text-danger">
          {status.error}
        </span>
      )}
    </form>
  );
}
