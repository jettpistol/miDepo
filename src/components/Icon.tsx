const PATHS = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10",
  receiving: "M12 3v11m0 0-4-4m4 4 4-4M4 15v4.5h16V15",
  putaway: "M4 5h16M4 12h16M4 19h16M8 5v14M16 5v14",
  picking: "M4 5h2.2l2 10h9.3l2-7H7.2M9.5 19.5h.01M17 19.5h.01",
  packing: "m12 3 8 4.3v9.4L12 21l-8-4.3V7.3L12 3Zm0 9 8-4.5M12 12 4 7.5M12 12v9",
  return: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  count: "M5 4h14v16H5zM9 9h6M9 13h6M9 17h3",
  move: "M4 8h13m0 0-3.5-3.5M17 8l-3.5 3.5M20 16H7m0 0 3.5-3.5M7 16l3.5 3.5",
  stock: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4",
  locations: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.800 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  fierro: "M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.300 2.700-6 6-6s6 2.700 6 6M16 4.500a3.500 3.500 0 0 1 0 6.500M17.500 14.500c2 .700 3.500 2.700 3.500 5.500",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.500-11.500a2.500 2.500 0 1 1 3.500 2.300c-.700.400-1 1-1 1.700M12 17h.01",
  account: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.500 8.500c.700-3.500 3.800-5.500 7.500-5.500s6.800 2 7.500 5.500",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  camera: "M4 8h3l1.500-2.500h7L17 8h3v11H4V8Zm8 8.500a3.250 3.250 0 1 0 0-6.500 3.250 3.250 0 0 0 0 6.500Z",
  print: "M7 8V3.500h10V8M7 17H4V9h16v8h-3M7 14h10v6.500H7V14Z",
  writeoff: "M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  download: "M12 4v11m0 0-4-4m4 4 4-4M5 20h14",
  logout: "M14 4h5v16h-5M10 8l-4 4 4 4M6 12h9",
  arrow: "m9 6 6 6-6 6",
  chevron: "m6 9 6 6 6-6",
  plus: "M12 5v14M5 12h14",
  ok: "m5 12.500 4.500 4.500L19 7.500",
  warn: "M12 4 2.500 20h19L12 4Zm0 6v4.500M12 17.500h.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
