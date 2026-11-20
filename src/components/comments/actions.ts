"use server";

import { action, num, txt } from "@/lib/action";
import { addComment, deleteComment, editComment } from "@/lib/flows/comments";

export const postComment = action("operator", async (c, f) => {
  await addComment(c, { subjectType: txt(f, "subjectType"), subjectId: num(f, "subjectId"), body: txt(f, "body"), parentId: num(f, "parentId") || null });
  return "Publicado.";
});
export const updateComment = action("operator", async (c, f) => {
  await editComment(c, num(f, "id"), txt(f, "body"));
  return "Guardado.";
});
export const removeComment = action("operator", async (c, f) => {
  await deleteComment(c, num(f, "id"));
  return "Borrado.";
});
