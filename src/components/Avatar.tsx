import { variablesDeAcento } from "@/lib/color";

type Persona = { id: number; nombre: string; acento: string; fotoVersion: number | null };

const iniciales = (nombre: string) => {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes.at(-1)![0] : "")).toUpperCase();
};

/** Foto de perfil; si la persona no tiene, sus iniciales sobre su propio color. */
export function Avatar({ persona, clase = "size-9 text-sm" }: { persona: Persona; clase?: string }) {
  if (persona.fotoVersion) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/foto/${persona.id}?v=${persona.fotoVersion}`} alt="" className={`shrink-0 rounded-full object-cover ${clase}`} />;
  }
  const v = variablesDeAcento(persona.acento);
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-bold ${clase}`} style={{ background: v["--acento"], color: v["--sobre-acento"] }}>
      {iniciales(persona.nombre)}
    </span>
  );
}
