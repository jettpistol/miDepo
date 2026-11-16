export function Marca({ grande = false }: { grande?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 font-bold tracking-tight ${grande ? "text-xl" : "text-lg"}`}>
      <svg viewBox="0 0 24 24" className={grande ? "size-8" : "size-7"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20V8l8-3.5L20 8v12M8 20v-8h8v8M8 16h8" />
      </svg>
      miDepo
    </span>
  );
}
