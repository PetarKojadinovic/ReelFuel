function toISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayDate(): string {
  return toISO(new Date());
}

const DANI = ["ponedeljak", "utorak", "sreda", "cetvrtak", "petak", "subota", "nedelja"];

function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/č|ć/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/đ/g, "dj");
}

/**
 * Datum (YYYY-MM-DD) za dan u TEKUĆOJ nedelji (pon–ned), npr. "Sreda" → datum ove srede.
 * Vraća null ako naziv dana nije prepoznat.
 */
/** Indeks dana (pon=0 … ned=6) iz naziva ("Četvrtak" → 3), ili -1. */
export function weekdayIndex(danNaziv: string): number {
  return DANI.indexOf(norm(danNaziv));
}

export function dateForWeekday(danNaziv: string): string | null {
  const idx = weekdayIndex(danNaziv);
  if (idx < 0) return null;
  const now = new Date();
  const todayIdx = (now.getDay() + 6) % 7; // JS: 0=nedelja → pon=0
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (idx - todayIdx));
  return toISO(d);
}
