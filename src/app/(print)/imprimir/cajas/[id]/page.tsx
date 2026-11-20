import { redirect } from "next/navigation";

/** Box labels on A4 (four per sheet) are now a size of the box label print view. */
export default async function BoxLabelsA4({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/etiqueta/${Number((await params).id)}?tamano=a4-4`);
}
