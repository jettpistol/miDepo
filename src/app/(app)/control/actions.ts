"use server";

import { action, num, txt } from "@/lib/action";
import { allowSameCheck, checkUnit, finishControl, reportMissing, restartControl } from "@/lib/flows/control";

export const scan = action("operator", (c, f) => checkUnit(c, num(f, "id"), txt(f, "product"), f.get("quantity")));
export const missing = action("operator", (c, f) => reportMissing(c, num(f, "id"), num(f, "lineId")));
export const restart = action("operator", (c, f) => restartControl(c, num(f, "id")));
export const finish = action("operator", (c, f) => finishControl(c, num(f, "id")));
export const allowSame = action("supervisor", (c, f) => allowSameCheck(c, num(f, "id"), txt(f, "allow") === "yes"));
