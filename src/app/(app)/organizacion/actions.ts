"use server";

import { action, txt } from "@/lib/action";
import { changeOrganizationCode, renameOrganization, saveBatchSorting, saveControlSettings } from "@/lib/flows/settings";

export const rename = action("admin", async (c, f) => {
  await renameOrganization(c, txt(f, "name"));
  return "Guardado.";
});

export const changeCode = action("admin", async (c, f) => {
  const slug = await changeOrganizationCode(c, txt(f, "slug"));
  return `Guardado. Código: ${slug}.`;
});

export const saveControl = action("admin", (c, f) => saveControlSettings(c, { mode: txt(f, "mode"), minUnits: txt(f, "minUnits"), samePerson: txt(f, "samePerson") === "yes" }));

export const saveSorting = action("supervisor", (c, f) => saveBatchSorting(c, txt(f, "sorting")));
