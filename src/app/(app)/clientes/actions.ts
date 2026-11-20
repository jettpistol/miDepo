"use server";

import { action, num, txt } from "@/lib/action";
import { setCustomerControl } from "@/lib/flows/control";

export const customerControl = action("admin", (c, f) => setCustomerControl(c, num(f, "id"), txt(f, "always") === "yes"));
