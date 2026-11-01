/**
 * Upis treninga iz plana u kalendar na telefonu (podrazumevano: glavni Google kalendar).
 *
 * Android aplikacija ne može da napravi novi Google pod-kalendar, a lokalni kalendar
 * Google Calendar aplikacija ne prikazuje. Zato upisujemo u izabrani (Google) kalendar
 * i svaki naš događaj obeležavamo oznakom OZNAKA — brišemo/menjamo SAMO takve događaje,
 * korisnikove ostale obaveze se nikad ne diraju.
 * Obroci se namerno NE upisuju (nisu vezani za tačno vreme svakog dana).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import type * as CalendarT from "expo-calendar";
import { weekdayIndex } from "../utils/date";
import { isValidHM } from "./mealTimes";

export type TipPlana = "teretana" | "street_workout";
export type KalendarPodesavanja = {
  ukljuceno: boolean; // da li se kalendar automatski osvežava kad se generiše novi plan
  vreme: string; // HH:MM
  trajanjeMin: number;
  tip: TipPlana;
  kalendarId?: string; // izabrani kalendar; prazno = glavni Google kalendar
};
export type KalendarOpcija = { id: string; naziv: string; nalog: string; google: boolean };

const KEY_PODESAVANJA = "reelfuel_kalendar";
const OZNAKA = "#ReelFuel";
const DANA_UNAPRED = 7;
const PODSETNIK_MIN = 30;
const GOOGLE = "com.google";

export const DEFAULT_KALENDAR: KalendarPodesavanja = { ukljuceno: false, vreme: "18:00", trajanjeMin: 60, tip: "teretana" };

export const NOVA_VERZIJA_PORUKA =
  "Za kalendar treba nova verzija aplikacije (novi development build). Instaliraj novi APK pa probaj ponovo.";

export async function getKalendarPodesavanja(): Promise<KalendarPodesavanja> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PODESAVANJA);
    if (raw) {
      const p = { ...DEFAULT_KALENDAR, ...JSON.parse(raw) };
      if (isValidHM(p.vreme)) return p;
    }
  } catch {}
  return DEFAULT_KALENDAR;
}

export async function setKalendarPodesavanja(p: KalendarPodesavanja) {
  await AsyncStorage.setItem(KEY_PODESAVANJA, JSON.stringify(p));
}

/** Da li instalirana verzija aplikacije ima native modul za kalendar. */
export function kalendarDostupan(): boolean {
  return Platform.OS !== "web" && !!requireOptionalNativeModule("ExpoCalendar");
}

/**
 * Biblioteku učitavamo tek kad zatreba: stari build bez native modula bi inače
 * pukao već pri pokretanju (Expo Router u dev režimu učita sve ekrane).
 */
function lib(): typeof CalendarT {
  if (!kalendarDostupan()) throw new Error(NOVA_VERZIJA_PORUKA);
  return require("expo-calendar");
}

async function dozvola(): Promise<void> {
  const res = await lib().requestCalendarPermissions();
  if (!res.granted) throw new Error("Bez dozvole za kalendar ne mogu da upišem treninge.");
}

async function upisiviKalendari(): Promise<CalendarT.ExpoCalendar[]> {
  const Calendar = lib();
  const svi = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  return svi.filter((c) => c.allowsModifications);
}

function jeGoogle(c: CalendarT.ExpoCalendar) {
  return c.source?.type === GOOGLE;
}

/** Glavni Google kalendar = onaj čiji je vlasnik sam nalog (npr. ime@gmail.com). */
function glavniGoogle(lista: CalendarT.ExpoCalendar[]) {
  const google = lista.filter(jeGoogle);
  return (
    google.find((c) => c.isPrimary) ||
    google.find((c) => c.ownerAccount && c.ownerAccount === c.source?.name) ||
    google[0]
  );
}

/** Kalendari u koje se može upisivati — za izbor u aplikaciji (Google prvi). */
export async function listaKalendara(): Promise<KalendarOpcija[]> {
  await dozvola();
  const lista = await upisiviKalendari();
  return lista
    .map((c) => ({ id: c.id, naziv: c.title, nalog: c.source?.name || "", google: jeGoogle(c) }))
    .sort((a, b) => Number(b.google) - Number(a.google));
}

async function izabraniKalendar(p: KalendarPodesavanja): Promise<CalendarT.ExpoCalendar> {
  const lista = await upisiviKalendari();
  const kal = (p.kalendarId && lista.find((c) => c.id === p.kalendarId)) || glavniGoogle(lista);
  if (!kal) {
    throw new Error("Na telefonu nema Google kalendara. Dodaj Google nalog u Podešavanjima telefona (Nalozi) pa probaj ponovo.");
  }
  return kal;
}

export async function opisKalendara(p: KalendarPodesavanja): Promise<string | null> {
  try {
    const kal = await izabraniKalendar(p);
    return kal.source?.name && kal.source.name !== kal.title ? `${kal.title} (${kal.source.name})` : kal.title;
  } catch {
    return null;
  }
}

function pocetakDana(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Obriši SAMO naše buduće događaje (sa oznakom) — prošli treninzi ostaju kao istorija. */
async function obrisiNase(kal: CalendarT.ExpoCalendar) {
  const od = pocetakDana(new Date());
  const doDatuma = new Date(od.getTime() + 60 * 24 * 3600 * 1000);
  const dogadjaji = await kal.listEvents(od, doDatuma);
  for (const e of dogadjaji) {
    if ((e.notes || "").includes(OZNAKA)) await e.delete();
  }
}

/** Stari build je pravio lokalni "ReelFuel" kalendar — očisti njegove buduće događaje da nema duplikata. */
async function ocistiStariLokalni(osim: string) {
  const svi = await upisiviKalendari();
  for (const c of svi) {
    if (c.id !== osim && c.title === "ReelFuel" && !jeGoogle(c)) {
      const od = pocetakDana(new Date());
      const ev = await c.listEvents(od, new Date(od.getTime() + 60 * 24 * 3600 * 1000));
      for (const e of ev) await e.delete();
    }
  }
}

/**
 * Upiše treninge za narednih 7 dana (od danas) iz izabranog plana.
 * Vraća broj upisanih treninga i naziv kalendara.
 */
export async function upisiTreninge(plan: any, p: KalendarPodesavanja): Promise<{ broj: number; kalendar: string }> {
  if (Platform.OS === "web") throw new Error("Kalendar radi samo u aplikaciji na telefonu.");
  const dani: any[] = plan?.[p.tip]?.dani ?? [];
  if (!dani.length) throw new Error("Nema plana treninga. Prvo generiši plan.");

  await dozvola();
  const kal = await izabraniKalendar(p);
  await obrisiNase(kal);
  await ocistiStariLokalni(kal.id).catch(() => {});

  const [h, m] = p.vreme.split(":").map(Number);
  const danas = pocetakDana(new Date());
  const sada = new Date();
  let broj = 0;

  for (let i = 0; i < DANA_UNAPRED; i++) {
    const d = new Date(danas.getFullYear(), danas.getMonth(), danas.getDate() + i);
    const idx = (d.getDay() + 6) % 7;
    const dan = dani.find((x) => weekdayIndex(x.dan) === idx);
    if (!dan || dan.je_odmor) continue;

    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
    if (start <= sada) continue; // današnji trening koji je već prošao ne upisujemo
    const end = new Date(start.getTime() + p.trajanjeMin * 60 * 1000);

    const vezbe = (dan.vezbe ?? [])
      .map((v: any) => `• ${v.naziv}${v.serije_i_ponavljanja ? ` — ${v.serije_i_ponavljanja}` : ""}`)
      .join("\n");

    await kal.createEvent({
      title: `💪 ${dan.tip_treninga || "Trening"}`,
      startDate: start,
      endDate: end,
      notes: `${p.tip === "teretana" ? "Teretana" : "Street workout"}\n\n${vezbe}\n\n${OZNAKA} (ne briši ovu oznaku — po njoj aplikacija prepoznaje svoje treninge)`,
      alarms: [{ relativeOffset: -PODSETNIK_MIN }],
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    broj++;
  }
  return { broj, kalendar: kal.title };
}

/** Ukloni sve buduće ReelFuel treninge iz izabranog kalendara. */
export async function ukloniTreninge(p: KalendarPodesavanja): Promise<void> {
  if (Platform.OS === "web") return;
  await dozvola();
  const kal = await izabraniKalendar(p);
  await obrisiNase(kal);
}
