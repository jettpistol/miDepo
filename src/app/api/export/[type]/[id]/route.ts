import { getDb } from "@/db";
import { UserError, withCode } from "@/lib/errors";
import { fileFor, type ExportType } from "@/lib/flows/exports";
import { can, currentSession } from "@/lib/session";

/** Downloads the CSV of a warehouse document so it can be loaded into Fierro. */
export async function GET(_: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  const s = await currentSession();
  if (!s || !can(s.user.role, "supervisor")) return new Response(withCode("No autorizado", "EXP-10"), { status: 401 });
  const { type, id } = await params;
  if (!["order", "receiving", "return", "count"].includes(type)) return new Response(withCode("No existe", "EXP-11"), { status: 404 });
  try {
    const file = await fileFor(await getDb(), s.company.id, type as ExportType, Number(id));
    return new Response(file.contents, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${file.name}"` } });
  } catch (e) {
    if (e instanceof UserError) return new Response(withCode(e.message, e.code), { status: 404 });
    throw e;
  }
}
