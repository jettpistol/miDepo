import { PrintView, type PrintParams } from "../../PrintView";

/** Test label: size, printer, a ruler and a barcode, to check a printer before using it. */
export default async function TestLabel({ searchParams }: { searchParams: Promise<PrintParams> }) {
  return <PrintView source="test" params={await searchParams} />;
}
