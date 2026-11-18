import { and, asc, eq, like } from "drizzle-orm";
import { locations } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { Labels } from "../../Labels";

export default async function LocationLabels({ searchParams }: { searchParams: Promise<{ prefijo?: string; exacta?: string }> }) {
  const { db, company } = await requireSession();
  const sp = await searchParams;
  const prefix = (sp.prefijo ?? "").trim().toUpperCase().replace(/[%_]/g, "");
  const rows = await db
    .select({ code: locations.code })
    .from(locations)
    .where(and(eq(locations.companyId, company.id), eq(locations.type, "shelf"), eq(locations.active, true), sp.exacta ? eq(locations.code, prefix) : like(locations.code, `${prefix}%`)))
    .orderBy(asc(locations.code))
    .limit(960);
  return (
    <>
      <p className="no-print mb-4 text-sm text-neutral-700">
        {rows.length} etiquetas{prefix ? ` que empiezan con ${prefix}` : ""} ({Math.ceil(rows.length / 24)} hojas). {rows.length === 960 && "Se imprimen como máximo 960 por vez: filtrá por pasillo."}
      </p>
      <Labels items={rows} />
    </>
  );
}
