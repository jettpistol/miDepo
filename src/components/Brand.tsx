/** The brand: a three-row shelf mark next to the name. */
export function Brand({ large = false }: { large?: boolean }) {
  return (
    <span className={`flex items-center gap-2 font-bold tracking-[-0.02em] ${large ? "text-2xl" : "text-base"}`}>
      <svg viewBox="0 0 24 24" className={large ? "size-8" : "size-5"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="2.5" width="14" height="19" rx="1.5" />
        <path d="M5 9h14M5 15h14" />
      </svg>
      miDepo
    </span>
  );
}
