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

const DANI_PRIKAZ = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"];

/** "2026-11-09" → Date u lokalnom vremenu (bez pomeranja zbog UTC-a). */
function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "2026-11-09" → "Ponedeljak, 9. 11." */
export function formatDanDatum(iso: string): string {
  const d = fromISO(iso);
  return `${DANI_PRIKAZ[(d.getDay() + 6) % 7]}, ${d.getDate()}. ${d.getMonth() + 1}.`;
}

/** "2026-11-09" → "9. 11." */
export function formatDatumKratko(iso: string): string {
  const d = fromISO(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}.`;
}

const MESECI = ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"];
const DANI_KRATKO = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

/** "2026-11-02" → "Ponedeljak, 2. novembar" */
export function formatDugiDatum(iso: string): string {
  const d = fromISO(iso);
  return `${DANI_PRIKAZ[(d.getDay() + 6) % 7]}, ${d.getDate()}. ${MESECI[d.getMonth()]}`;
}

/** Pomeri ISO datum za n dana. */
export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Broj dana od a do b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
}

/** 7 dana nedelje (pon–ned) u kojoj je `iso`, sa kratkim nazivom i brojem dana. */
export function weekDays(iso: string): { datum: string; kratko: string; broj: number; ime: string }[] {
  const d = fromISO(iso);
  const pon = addDays(iso, -((d.getDay() + 6) % 7));
  return DANI_KRATKO.map((kratko, i) => {
    const datum = addDays(pon, i);
    return { datum, kratko, broj: fromISO(datum).getDate(), ime: DANI_PRIKAZ[i] };
  });
}
