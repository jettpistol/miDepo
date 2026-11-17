"use server";

import { action, num, txt } from "@/lib/action";
import { closeBox, scanIntoBox, finishPacking, emptyBox } from "@/lib/flows/packing";

export const scan = action("operator", (c, f) => scanIntoBox(c, num(f, "id"), txt(f, "product"), f.get("quantity")));
export const close = action("operator", (c, f) => {
  const kg = Number(txt(f, "kg").replace(",", "."));
  return closeBox(c, num(f, "boxId"), Number.isFinite(kg) && kg > 0 ? kg * 1000 : undefined);
});
export const empty = action("operator", (c, f) => emptyBox(c, num(f, "boxId")));
export const finish = action("operator", (c, f) => finishPacking(c, num(f, "id")));
