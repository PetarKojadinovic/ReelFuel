// Web zamena: kalendar telefona ne postoji u browseru.
export type TipPlana = "teretana" | "street_workout";
export type KalendarPodesavanja = {
  ukljuceno: boolean;
  vreme: string;
  trajanjeMin: number;
  tip: TipPlana;
  kalendarId?: string;
};
export type KalendarOpcija = { id: string; naziv: string; nalog: string; google: boolean };

export const DEFAULT_KALENDAR: KalendarPodesavanja = { ukljuceno: false, vreme: "18:00", trajanjeMin: 60, tip: "teretana" };
export const NOVA_VERZIJA_PORUKA = "Kalendar radi samo u aplikaciji na telefonu.";

export function kalendarDostupan(): boolean {
  return false;
}
export async function getKalendarPodesavanja(): Promise<KalendarPodesavanja> {
  return DEFAULT_KALENDAR;
}
export async function setKalendarPodesavanja(_p: KalendarPodesavanja) {}
export async function listaKalendara(): Promise<KalendarOpcija[]> {
  return [];
}
export async function opisKalendara(_p: KalendarPodesavanja): Promise<string | null> {
  return null;
}
export async function upisiTreninge(_plan: any, _p: KalendarPodesavanja): Promise<{ broj: number; kalendar: string }> {
  throw new Error(NOVA_VERZIJA_PORUKA);
}
export async function ukloniTreninge(_p: KalendarPodesavanja): Promise<void> {}
