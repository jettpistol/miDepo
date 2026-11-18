"use server";

import { action, num, txt } from "@/lib/action";
import { writeOff } from "@/lib/flows/adjustments";

export const writeOffAction = action("supervisor", (c, f) => writeOff(c, { locationId: num(f, "locationId"), productId: num(f, "productId"), quantity: f.get("quantity"), cause: txt(f, "cause") }));
