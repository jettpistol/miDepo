/** La marca: un tejuelo de tres renglones junto al nombre. */
export function Marca({ grande = false }: { grande?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 font-bold tracking-[-0.02em] ${grande ? "text-2xl" : "text-lg"}`}>
      <svg viewBox="0 0 24 24" className={grande ? "size-8" : "size-6"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="2.5" width="14" height="19" rx="1.5" />
        <path d="M5 9h14M5 15h14" />
      </svg>
      miDepo
    </span>
  );
}
