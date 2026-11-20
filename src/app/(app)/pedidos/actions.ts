"use server";

import { action, num, txt } from "@/lib/action";
import { setUrgent } from "@/lib/flows/orders";

export const urgency = action("supervisor", (c, f) => setUrgent(c, num(f, "id"), txt(f, "urgent") === "1"));
