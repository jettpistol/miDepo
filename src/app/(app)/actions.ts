"use server";

import { action, num, txt } from "@/lib/action";
import { assign } from "@/lib/flows/assignments";

/** Shared by every screen with an "Asignado a" control. An empty person takes the assignment back. */
export const assignAction = action("supervisor", (c, f) => assign(c, txt(f, "kind"), num(f, "id"), txt(f, "userId") ? num(f, "userId") : null));
