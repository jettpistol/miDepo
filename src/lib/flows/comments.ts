import { and, asc, count, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import { comments, orders, users, type CommentSubject } from "@/db/schema";
import { UserError } from "../errors";
import type { Ctx } from "./common";

/** How long the author can still edit or delete a comment: enough to fix a slip, not to rewrite the record. */
export const EDIT_WINDOW_MS = 5 * 60 * 1000;
export const MAX_LENGTH = 2000;

/** Each kind of document comments can hang from, and how to check one exists in the company. */
const SUBJECTS: Record<CommentSubject, (db: DB, companyId: number, id: number) => Promise<boolean>> = {
  order: async (db, companyId, id) => (await db.select({ id: orders.id }).from(orders).where(and(eq(orders.id, id), eq(orders.companyId, companyId)))).length > 0,
};

export const isSubject = (v: string): v is CommentSubject => Object.hasOwn(SUBJECTS, v);

function cleanBody(v: string) {
  const body = v.replace(/\r\n/g, "\n").trim();
  if (!body) throw new UserError("CMT-01", "Escribe el comentario.");
  if (body.length > MAX_LENGTH) throw new UserError("CMT-02", `El comentario es demasiado largo: el máximo es ${MAX_LENGTH} caracteres.`);
  return body;
}

export const stillEditable = (createdAt: Date, now = Date.now()) => now - createdAt.getTime() < EDIT_WINDOW_MS;

/** Leaves a comment. With `parentId`, it answers that thread; answering a reply answers its thread. */
export async function addComment(c: Ctx, input: { subjectType: string; subjectId: number; body: string; parentId?: number | null }) {
  const { subjectType, subjectId } = input;
  if (!isSubject(subjectType) || !Number.isInteger(subjectId) || !(await SUBJECTS[subjectType](c.db, c.companyId, subjectId))) {
    throw new UserError("CMT-03", "No se encontró dónde dejar el comentario.");
  }
  const body = cleanBody(input.body);
  let parentId: number | null = null;
  if (input.parentId) {
    const [parent] = await c.db.select().from(comments).where(and(eq(comments.id, input.parentId), eq(comments.companyId, c.companyId), eq(comments.subjectType, subjectType), eq(comments.subjectId, subjectId)));
    if (!parent) throw new UserError("CMT-04", "No se encontró ese comentario. Puede que lo hayan borrado.");
    parentId = parent.parentId ?? parent.id;
  }
  const [row] = await c.db.insert(comments).values({ companyId: c.companyId, subjectType, subjectId, parentId, authorId: c.userId, body }).returning();
  return row;
}

/** A comment the current user may still change: their own, within the edit window. */
async function ownRecent(c: Ctx, id: number) {
  const [row] = await c.db.select().from(comments).where(and(eq(comments.id, id), eq(comments.companyId, c.companyId)));
  if (!row) throw new UserError("CMT-04", "No se encontró ese comentario. Puede que lo hayan borrado.");
  if (row.authorId !== c.userId) throw new UserError("CMT-05", "Solo quien escribió el comentario puede cambiarlo.");
  if (!stillEditable(row.createdAt)) throw new UserError("CMT-06", "Pasaron más de 5 minutos: el comentario ya no se puede cambiar. Puedes responderlo con la corrección.");
  return row;
}

export async function editComment(c: Ctx, id: number, body: string) {
  await ownRecent(c, id);
  const clean = cleanBody(body);
  await c.db.update(comments).set({ body: clean, editedAt: new Date() }).where(eq(comments.id, id));
}

export async function deleteComment(c: Ctx, id: number) {
  const row = await ownRecent(c, id);
  const [{ n }] = await c.db.select({ n: count() }).from(comments).where(eq(comments.parentId, row.id));
  if (n > 0) throw new UserError("CMT-07", "Ese comentario ya tiene respuestas: no se puede borrar. Puedes editarlo.");
  await c.db.delete(comments).where(eq(comments.id, id));
}

export type CommentView = {
  id: number;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  author: { id: number; name: string; accent: string; photoVersion: number | null };
};
export type Thread = CommentView & { replies: CommentView[] };

/** Every thread on a document, oldest first, each with its replies oldest first. */
export async function threadsOf(db: DB, companyId: number, subjectType: CommentSubject, subjectId: number): Promise<Thread[]> {
  const rows = await db
    .select({ c: comments, author: { id: users.id, name: users.name, accent: users.accent, photoVersion: users.photoVersion } })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(and(eq(comments.companyId, companyId), eq(comments.subjectType, subjectType), eq(comments.subjectId, subjectId)))
    .orderBy(asc(comments.createdAt), asc(comments.id));
  const view = ({ c, author }: (typeof rows)[number]): CommentView => ({ id: c.id, body: c.body, createdAt: c.createdAt, editedAt: c.editedAt, author });
  const threads = rows.filter((r) => r.c.parentId === null).map((r) => ({ ...view(r), replies: [] as CommentView[] }));
  const byId = new Map(threads.map((t) => [t.id, t]));
  for (const r of rows) if (r.c.parentId !== null) byId.get(r.c.parentId)?.replies.push(view(r));
  return threads;
}

/** How many comments (replies included) each document has, for the count beside it in lists. */
export async function commentCounts(db: DB, companyId: number, subjectType: CommentSubject, ids: number[]) {
  if (ids.length === 0) return new Map<number, number>();
  const rows = await db
    .select({ id: comments.subjectId, n: count() })
    .from(comments)
    .where(and(eq(comments.companyId, companyId), eq(comments.subjectType, subjectType), inArray(comments.subjectId, ids)))
    .groupBy(comments.subjectId);
  return new Map(rows.map((r) => [r.id, r.n]));
}
