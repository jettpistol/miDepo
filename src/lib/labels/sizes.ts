/**
 * Label sizes: thermal rolls (one label per page) and A4 sticker sheets. Data, not code: a new
 * size is a new line here. See docs/hardware/README.md, "Label sizes".
 */

export type Sheet = { across: number; down: number; top: number; pitchX: number; pitchY: number };
export type LabelSize = { id: string; name: string; w: number; h: number; sheet?: Sheet };

const roll = (w: number, h: number, name = `${w} × ${h} mm`): LabelSize => ({ id: `${w}x${h}`, name, w, h });
const inch = (wIn: number, hIn: number) => roll(Math.round(wIn * 254) / 10, Math.round(hIn * 254) / 10, `${wIn} × ${hIn} in`);
/** A4 sheets with the common Avery-style layouts (the same grids most sheet brands sell). */
const a4 = (id: string, w: number, h: number, across: number, down: number, pitchX: number, pitchY: number, top: number): LabelSize => ({
  id,
  name: `A4 · ${across * down} (${w} × ${h} mm)`,
  w,
  h,
  sheet: { across, down, top, pitchX, pitchY },
});

export const SIZES: LabelSize[] = [
  roll(100, 150),
  roll(100, 100),
  roll(100, 75),
  roll(100, 50),
  roll(80, 50),
  roll(60, 40),
  roll(58, 40),
  roll(57, 32),
  roll(50, 30),
  roll(50, 25),
  roll(40, 30),
  roll(40, 20),
  roll(38, 25),
  roll(32, 25),
  inch(4, 6),
  inch(4, 3),
  inch(4, 2),
  inch(3, 2),
  inch(2.25, 1.25),
  inch(2, 1),
  a4("a4-4", 99.1, 139, 2, 2, 101.6, 139, 9.5),
  a4("a4-8", 99.1, 67.7, 2, 4, 101.6, 67.7, 13.1),
  a4("a4-14", 99.1, 38.1, 2, 7, 101.6, 38.1, 15.15),
  a4("a4-21", 63.5, 38.1, 3, 7, 66.04, 38.1, 15.15),
  a4("a4-24", 63.5, 33.9, 3, 8, 66.04, 33.9, 12.9),
  a4("a4-65", 38.1, 21.2, 5, 13, 40.6, 21.2, 10.7),
];

export const A4 = { w: 210, h: 297 };

export function sizeById(id: string | null | undefined) {
  return SIZES.find((s) => s.id === id) ?? null;
}

/** Left margin that centres a sheet's grid on the page. */
export const sheetLeft = (s: LabelSize) => (A4.w - (s.sheet!.across - 1) * s.sheet!.pitchX - s.w) / 2;

export const perSheet = (s: LabelSize) => (s.sheet ? s.sheet.across * s.sheet.down : 1);
