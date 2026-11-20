"use server";

import { action, num, txt } from "@/lib/action";
import { move, moveAll, undoMove, undoMoveAll } from "@/lib/flows/move";

export const moveAction = action("operator", (c, f) => move(c, { source: txt(f, "source"), product: txt(f, "product"), destination: txt(f, "destination"), quantity: f.get("quantity") }));
export const undoMoveAction = action("operator", (c, f) => undoMove(c, num(f, "id")));
export const moveAllAction = action("operator", (c, f) => moveAll(c, { source: txt(f, "source"), destination: txt(f, "destination") }));
export const undoMoveAllAction = action("operator", (c, f) => undoMoveAll(c, txt(f, "reference")));
