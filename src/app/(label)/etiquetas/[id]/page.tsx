import { PrintView, type PrintParams } from "../../PrintView";

/** A prepared label job (Etiquetas). `?auto=1` prints on opening: the one click from the list. */
export default async function JobLabels({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<PrintParams> }) {
  return <PrintView source={`job:${Number((await params).id)}`} params={await searchParams} />;
}
