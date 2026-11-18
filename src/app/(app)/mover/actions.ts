"use server";

import { action, txt } from "@/lib/action";
import { move } from "@/lib/flows/move";

export const moveAction = action("operator", (c, f) => move(c, { source: txt(f, "source"), product: txt(f, "product"), destination: txt(f, "destination"), quantity: f.get("quantity") }));
