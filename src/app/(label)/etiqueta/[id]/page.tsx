import { PrintView, type PrintParams } from "../../PrintView";

/** Box labels of an order, read now: carrier, remito and tracking as set in Despacho. */
export default async function BoxLabels({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<PrintParams> }) {
  return <PrintView source={`order:${Number((await params).id)}`} params={await searchParams} />;
}
