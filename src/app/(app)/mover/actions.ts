"use server";

import { action, num, txt } from "@/lib/action";
import { move, undoMove } from "@/lib/flows/move";

export const moveAction = action("operator", (c, f) => move(c, { source: txt(f, "source"), product: txt(f, "product"), destination: txt(f, "destination"), quantity: f.get("quantity") }));
export const undoMoveAction = action("operator", (c, f) => undoMove(c, num(f, "id")));
