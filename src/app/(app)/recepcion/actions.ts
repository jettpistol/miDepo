"use server";

import { redirect } from "next/navigation";
import { action, num, txt } from "@/lib/action";
import { closeReceiving, createUnannouncedReceiving, scanReceiving, setReceived } from "@/lib/flows/receiving";

export const create = action("operator", async (c, f) => {
  const id = await createUnannouncedReceiving(c, txt(f, "supplier"));
  redirect(`/recepcion/${id}`);
});
export const scan = action("operator", (c, f) => scanReceiving(c, num(f, "id"), txt(f, "product"), f.get("quantity")));
export const correct = action("operator", (c, f) => setReceived(c, num(f, "id"), num(f, "productId"), f.get("received")));
export const close = action("operator", (c, f) => closeReceiving(c, num(f, "id")));
