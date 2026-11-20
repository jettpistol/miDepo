import type { DB } from "@/db";
import type { CommentSubject } from "@/db/schema";
import { EDIT_WINDOW_MS, threadsOf } from "@/lib/flows/comments";
import { Icon } from "../Icon";
import { CommentThreads, type CommentItem } from "./CommentThreads";

/** The "Comentarios" section of a document: its threads and a box to add one. */
export async function Comments({ db, companyId, userId, subjectType, subjectId }: { db: DB; companyId: number; userId: number; subjectType: CommentSubject; subjectId: number }) {
  const threads = await threadsOf(db, companyId, subjectType, subjectId);
  const now = Date.now();
  const item = <T extends Omit<CommentItem, "editMsLeft">>(c: T) => ({ ...c, editMsLeft: c.author.id === userId ? Math.max(0, EDIT_WINDOW_MS - (now - c.createdAt.getTime())) : 0 });
  const total = threads.reduce((s, t) => s + 1 + t.replies.length, 0);
  return (
    <section id="comentarios" className="max-w-2xl scroll-mt-30">
      <h2 className="section-title">
        Comentarios <small>{total}</small>
      </h2>
      <CommentThreads threads={threads.map((t) => ({ ...item(t), replies: t.replies.map(item) }))} subjectType={subjectType} subjectId={subjectId} />
    </section>
  );
}

/** Speech bubble with the number of comments, beside a document in a list. Nothing when there are none. */
export function CommentCount({ n }: { n: number | undefined }) {
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-1 align-middle text-xs font-semibold text-muted" title={n === 1 ? "1 comentario" : `${n} comentarios`}>
      <Icon name="comment" className="size-3.5" />
      {n}
      <span className="sr-only"> {n === 1 ? "comentario" : "comentarios"}</span>
    </span>
  );
}

/** In a document's header: jumps to its comments, which sit at the end of the page. */
export function CommentsLink({ n }: { n: number }) {
  return (
    <a href="#comentarios" className="btn-soft" title={n === 1 ? "1 comentario" : `${n} comentarios`} aria-label={n === 1 ? "1 comentario" : `${n} comentarios`}>
      <Icon name="comment" /> {n}
    </a>
  );
}
