import { accentVariables, DEFAULT_ACCENT, PALETTE } from "@/lib/color";

type Person = { id: number; name: string; accent: string; photoVersion: number | null };

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
};

/**
 * Background of the initials: the person's accent if they chose one; with the default accent,
 * a palette colour picked by their id, so people without a photo do not all look alike.
 */
export const initialsColor = (person: Pick<Person, "id" | "accent">) => (person.accent.toUpperCase() === DEFAULT_ACCENT ? PALETTE[person.id % PALETTE.length].hex : person.accent);

/** Profile photo; if the person has none, their initials on their own colour. */
export function Avatar({ person, className = "size-9 text-sm" }: { person: Person; className?: string }) {
  if (person.photoVersion) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/photo/${person.id}?v=${person.photoVersion}`} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />;
  }
  const v = accentVariables(initialsColor(person));
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-bold ${className}`} style={{ background: v["--accent"], color: v["--on-accent"] }}>
      {initials(person.name)}
    </span>
  );
}
