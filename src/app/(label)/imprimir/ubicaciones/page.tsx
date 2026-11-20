import { PrintView, type PrintParams } from "../../PrintView";

/** Location labels: active shelves starting with `prefijo`, or exactly that code with `exacta`. */
export default async function LocationLabels({ searchParams }: { searchParams: Promise<PrintParams & { prefijo?: string; exacta?: string }> }) {
  const sp = await searchParams;
  return <PrintView source={`${sp.exacta ? "location" : "locations"}:${sp.prefijo ?? ""}`} params={sp} />;
}
