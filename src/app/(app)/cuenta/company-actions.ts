"use server";

import { action, txt } from "@/lib/action";
import { saveControlSettings } from "@/lib/flows/settings";

export const saveControl = action("admin", (c, f) => saveControlSettings(c, { mode: txt(f, "mode"), minUnits: txt(f, "minUnits"), samePerson: txt(f, "samePerson") === "yes" }));
