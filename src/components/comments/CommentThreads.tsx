"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { CommentSubject } from "@/db/schema";
import type { Result } from "@/lib/errors";
import { Avatar } from "../Avatar";
import { Message } from "../ScanForm";
import { shortDate } from "../ui";
import { postComment, removeComment, updateComment } from "./actions";

/** Kept in step with MAX_LENGTH in src/lib/flows/comments.ts (the server checks it too). */
const MAX_LENGTH = 2000;

export type CommentItem = {
  id: number;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  author: { id: number; name: string; accent: string; photoVersion: number | null };
  /** For the viewer's own comments: milliseconds left to edit or delete it (0 = no longer). */
  editMsLeft: number;
};
export type ThreadItem = CommentItem & { replies: CommentItem[] };

/** Small text button with a full touch target on phones. */
const QUIET = "inline-flex min-h-11 cursor-pointer items-center rounded-control px-1.5 text-sm font-semibold text-muted transition-colors duration-150 hover:text-accent-text lg:min-h-6 lg:text-[13px]";

function LengthNote({ length }: { length: number }) {
  const left = MAX_LENGTH - length;
  if (left >= 200) return null;
  return <span className={`text-sm ${left < 0 ? "font-semibold text-danger" : "text-muted"}`}>{left < 0 ? `Sobran ${-left}` : `Quedan ${left}`}</span>;
}

/** Textarea that sends with Ctrl+Enter (⌘+Enter on a Mac); the button stays off while it is empty or too long. */
function Composer({
  action,
  fields,
  initial = "",
  button,
  placeholder,
  autoFocus = false,
  onDone,
  onCancel,
}: {
  action: (prev: Result, data: FormData) => Promise<Result>;
  fields: Record<string, string | number>;
  initial?: string;
  button: string;
  placeholder?: string;
  autoFocus?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const [status, submit, submitting] = useActionState(action, {});
  const [text, setText] = useState(initial);
  const form = useRef<HTMLFormElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const handled = useRef<Result | null>(null);

  useEffect(() => {
    if (!status.ok || handled.current === status) return;
    handled.current = status;
    setText(initial);
    onDone?.();
  }, [status, initial, onDone]);

  useEffect(() => {
    if (!autoFocus || !area.current) return;
    area.current.focus();
    area.current.setSelectionRange(area.current.value.length, area.current.value.length);
  }, [autoFocus]);

  const empty = text.trim().length === 0;
  const tooLong = text.trim().length > MAX_LENGTH;
  return (
    <form ref={form} action={submit} className="space-y-1.5">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <textarea
        ref={area}
        name="body"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !empty && !tooLong) {
            e.preventDefault();
            form.current?.requestSubmit();
          }
          if (e.key === "Escape" && onCancel) {
            e.preventDefault();
            onCancel();
          }
        }}
        rows={2}
        placeholder={placeholder}
        aria-label={placeholder ?? "Comentario"}
        className="field block min-h-20 resize-y lg:min-h-14"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-sm" disabled={submitting || empty || tooLong}>
          {submitting ? "Un momento…" : button}
        </button>
        {onCancel && (
          <button type="button" className={QUIET} onClick={onCancel}>
            Cancelar
          </button>
        )}
        <LengthNote length={text.trim().length} />
      </div>
      {status.error && <Message status={status} />}
    </form>
  );
}

/** True while the author can still change the comment; turns false when the time runs out. */
function useStillEditable(msLeft: number) {
  const [editable, setEditable] = useState(msLeft > 0);
  useEffect(() => {
    setEditable(msLeft > 0);
    if (msLeft <= 0) return;
    const t = setTimeout(() => setEditable(false), msLeft);
    return () => clearTimeout(t);
  }, [msLeft]);
  return editable;
}

function DeleteButton({ id }: { id: number }) {
  const [status, submit, submitting] = useActionState(removeComment, {});
  return (
    <form action={submit} className="contents" onSubmit={(e) => !window.confirm("¿Borrar el comentario?") && e.preventDefault()}>
      <input type="hidden" name="id" value={id} />
      <button className={`${QUIET} hover:text-danger`} disabled={submitting}>
        Borrar
      </button>
      {status.error && (
        <div className="basis-full">
          <Message status={status} />
        </div>
      )}
    </form>
  );
}

function Comment({ c, canDelete, onReply }: { c: CommentItem; canDelete: boolean; onReply?: () => void }) {
  const editable = useStillEditable(c.editMsLeft);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editable) setEditing(false);
  }, [editable]);

  return (
    <article className="flex gap-2.5">
      <Avatar person={c.author} className="mt-0.5 size-7 text-[11px]" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold">{c.author.name}</span>
          <time dateTime={c.createdAt.toISOString()} className="text-muted">
            {shortDate(c.createdAt)}
          </time>
          {c.editedAt && <span className="text-muted">(editado)</span>}
        </p>
        {editing ? (
          <div className="mt-1">
            <Composer action={updateComment} fields={{ id: c.id }} initial={c.body} button="Guardar" autoFocus onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
          </div>
        ) : (
          <>
            <p className="mt-0.5 text-[15px] break-words whitespace-pre-wrap lg:text-sm">{c.body}</p>
            {(onReply || editable) && (
              <div className="-ml-1.5 flex flex-wrap items-center">
                {onReply && (
                  <button type="button" className={QUIET} onClick={onReply}>
                    Responder
                  </button>
                )}
                {editable && (
                  <>
                    <button type="button" className={QUIET} onClick={() => setEditing(true)}>
                      Editar
                    </button>
                    {canDelete && <DeleteButton id={c.id} />}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function Thread({ t, subject }: { t: ThreadItem; subject: { subjectType: CommentSubject; subjectId: number } }) {
  const [replying, setReplying] = useState(false);
  return (
    <li className="space-y-2 px-2 py-3 lg:px-3 lg:py-2.5">
      <Comment c={t} canDelete={t.replies.length === 0} onReply={() => setReplying(true)} />
      {(t.replies.length > 0 || replying) && (
        <div className="ml-3.5 space-y-2 border-l-2 border-line pl-4">
          {t.replies.map((r) => (
            <Comment key={r.id} c={r} canDelete onReply={() => setReplying(true)} />
          ))}
          {replying && <Composer action={postComment} fields={{ ...subject, parentId: t.id }} button="Responder" placeholder="Respuesta" autoFocus onDone={() => setReplying(false)} onCancel={() => setReplying(false)} />}
        </div>
      )}
    </li>
  );
}

/** The threads of a document and a box to start a new one. */
export function CommentThreads({ threads, subjectType, subjectId }: { threads: ThreadItem[]; subjectType: CommentSubject; subjectId: number }) {
  const subject = { subjectType, subjectId };
  return (
    <div className="space-y-3">
      {threads.length > 0 && (
        <ul className="ruled-list framed">
          {threads.map((t) => (
            <Thread key={t.id} t={t} subject={subject} />
          ))}
        </ul>
      )}
      <Composer action={postComment} fields={subject} button="Comentar" placeholder="Comentario" />
    </div>
  );
}
