import { getApiUrl } from "./apiConfig";
import { getMealTimes } from "./mealTimes";

const API_KEY = process.env.EXPO_PUBLIC_API_KEY || "";

function authHeaders(extra: Record<string, string> = {}) {
  return {
    "X-API-Key": API_KEY,
    "ngrok-skip-browser-warning": "true",
    ...extra,
  };
}

type Opcije = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Šalje se kao JSON (postavlja Content-Type). */
  json?: unknown;
  /** Multipart telo; Content-Type se NE postavlja (fetch sam dodaje granicu). */
  form?: FormData;
  /** true = poruka iz servera (`detail`) ako postoji, inače `greska`. */
  detalj?: boolean;
};

/**
 * Jedini put do backenda: adresa (`getApiUrl`), ključ, provera `ok` i poruka o grešci.
 * `greska` je tekst koji ekran prikaže kad zahtev ne uspe.
 */
async function zahtev<T = any>(putanja: string, greska: string, o: Opcije = {}): Promise<T> {
  const API_BASE_URL = await getApiUrl();
  const init: RequestInit = { headers: authHeaders() };
  if (o.method) init.method = o.method;
  if (o.json !== undefined) {
    init.headers = authHeaders({ "Content-Type": "application/json" });
    init.body = JSON.stringify(o.json);
  } else if (o.form) {
    init.body = o.form;
  }
  const response = await fetch(`${API_BASE_URL}${putanja}`, init);
  if (!response.ok) throw new Error(o.detalj ? await serverDetail(response, greska) : greska);
  return response.json();
}

async function serverDetail(response: Response, fallback: string): Promise<string> {
  try {
    const j = await response.json();
    if (typeof j.detail === "string") return j.detail;
  } catch {}
  return fallback;
}

const enc = encodeURIComponent;

function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Trenutno vreme + vremena obroka (backend po njima zna koji obrok je "sledeći"). */
async function vremenaObroka() {
  const t = await getMealTimes();
  return `sada=${enc(nowHM())}&dorucak=${enc(t.dorucak)}&rucak=${enc(t.rucak)}&vecera=${enc(t.vecera)}`;
}

// ---------- Profil ----------

export function saveProfile(profile: {
  tezina_kg: number;
  visina_cm: number;
  godine: number;
  pol: string;
  nivo_aktivnosti: string;
  cilj: string;
  raspodela_kalorija: string;
  broj_treninga_nedeljno?: number;
  ciljna_tezina_kg?: number;
}) {
  return zahtev("/profile/", "Greska pri cuvanju profila", { method: "POST", json: profile });
}

export function getProfile() {
  return zahtev("/profile/", "Greska pri ucitavanju profila");
}

// ---------- Recepti i jelovnik ----------

export function submitRecipeLink(url: string) {
  return zahtev("/recipe/", "Greska pri obradi linka", { method: "POST", json: { url } });
}

export function listRecipes() {
  return zahtev("/recipe/list", "Greska pri ucitavanju recepata");
}

export function deleteRecipe(id: number) {
  return zahtev(`/recipe/${id}`, "Greska pri brisanju recepta", { method: "DELETE" });
}

export function addManualRecipe(recipe: {
  naziv_jela: string;
  sastojci: { naziv: string; kolicina: string }[];
  koraci: string[];
  priblizne_kalorije?: string;
  proteini_g?: number | null;
}) {
  return zahtev("/recipe/manual", "Greska pri cuvanju recepta", { method: "POST", json: recipe });
}

export function generateMealPlan() {
  return zahtev("/mealplan/generate", "Greska pri generisanju plana", { method: "POST" });
}

export function getLatestMealPlan() {
  return zahtev("/mealplan/latest", "Greska pri ucitavanju plana");
}

// ---------- Chat ----------

export function sendChatMessage(message: string) {
  return zahtev("/chat/", "Greska pri slanju poruke", { method: "POST", json: { message } });
}

export function getChatHistory() {
  return zahtev("/chat/history", "Greska pri ucitavanju istorije");
}

// ---------- Dnevnik hrane ----------

export function addLogEntry(entry: {
  datum: string;
  naziv: string;
  kalorije: number;
  proteini_g?: number | null;
  obrok_tip?: string;
  izvor: string;
}) {
  return zahtev("/log/", "Greska pri cuvanju unosa", { method: "POST", json: entry });
}

export function deleteLogEntry(id: number) {
  return zahtev(`/log/${id}`, "Greska pri brisanju unosa", { method: "DELETE" });
}

export function getDayLog(datum: string) {
  return zahtev(`/log/${datum}`, "Greska pri ucitavanju dnevnika");
}

// ---------- Vežbe i katalog ----------

export function submitExerciseLink(url: string) {
  return zahtev("/exercise/", "Greska pri obradi linka", { method: "POST", json: { url } });
}

export function listExercises() {
  return zahtev("/exercise/list", "Greska pri ucitavanju vezbi");
}

export function deleteExercise(id: number) {
  return zahtev(`/exercise/${id}`, "Greska pri brisanju vezbe", { method: "DELETE" });
}

export function addManualExercise(exercise: { naziv_vezbe: string; grupa_misica: string; serije_i_ponavljanja: string }) {
  return zahtev("/exercise/manual", "Greska pri cuvanju vezbe", { method: "POST", json: exercise });
}

/** Vežba + podaci iz kataloga (mišići, koraci, slike). Prvi put backend poveže vežbu sa katalogom (AI). */
export function getExerciseDetails(id: number) {
  return zahtev(`/exercise/${id}/detalji`, "Greska pri ucitavanju vezbe");
}

export function searchExerciseCatalog(q: string) {
  return zahtev(`/exercise/katalog?q=${enc(q)}`, "Greska pri pretrazi");
}

/** Opis vežbe iz plana treninga (plan ima samo naziv). */
export function getCatalogByName(naziv: string, grupa?: string) {
  return zahtev(`/exercise/katalog/po-nazivu?naziv=${enc(naziv)}&grupa=${enc(grupa ?? "")}`, "Greska pri ucitavanju vezbe");
}

export function setCatalogByName(naziv: string, katalogId: string | null) {
  return zahtev("/exercise/katalog/po-nazivu", "Greska pri cuvanju izbora", {
    method: "PUT",
    json: { naziv, katalog_id: katalogId },
  });
}

/** Ručno izaberi vežbu iz kataloga; `null` = "nema je u katalogu". */
export function setExerciseCatalog(id: number, katalogId: string | null) {
  return zahtev(`/exercise/${id}/katalog`, "Greska pri cuvanju izbora", { method: "PUT", json: { katalog_id: katalogId } });
}

// ---------- Trening ----------

export function generateWorkoutPlan() {
  return zahtev("/workoutplan/generate", "Greska pri generisanju plana treninga", { method: "POST" });
}

export function getLatestWorkoutPlan() {
  return zahtev("/workoutplan/latest", "Greska pri ucitavanju plana treninga");
}

export function addWorkoutLogEntry(entry: {
  datum: string;
  naziv_vezbe: string;
  serije_i_ponavljanja?: string;
  dan_treninga?: string;
  izvor: string;
}) {
  return zahtev("/workoutlog/", "Greska pri cuvanju unosa treninga", { method: "POST", json: entry });
}

export function deleteWorkoutLogEntry(id: number) {
  return zahtev(`/workoutlog/${id}`, "Greska pri brisanju unosa treninga", { method: "DELETE" });
}

export function getWorkoutDayLog(datum: string) {
  return zahtev(`/workoutlog/${datum}`, "Greska pri ucitavanju dnevnika treninga");
}

// ---------- Težina ----------

export function addWeightEntry(entry: { datum: string; tezina_kg: number }) {
  return zahtev("/weightlog/", "Greska pri cuvanju tezine", { method: "POST", json: entry });
}

export function deleteWeightEntry(id: number) {
  return zahtev(`/weightlog/${id}`, "Greska pri brisanju unosa", { method: "DELETE" });
}

export function getWeightSummary() {
  return zahtev("/weightlog/summary", "Greska pri ucitavanju istorije tezine");
}

// ---------- Kupovina i izveštaj ----------

export function generateShoppingList() {
  return zahtev("/shoppinglist/generate", "Greska pri generisanju liste", { method: "POST" });
}

export function generateShoppingListFromRecipe(recipeId: number) {
  return zahtev("/shoppinglist/generate-from-recipe", "Greska pri dodavanju iz recepta", {
    method: "POST",
    json: { recipe_id: recipeId },
  });
}

export function getShoppingList() {
  return zahtev("/shoppinglist/", "Greska pri ucitavanju liste");
}

export function toggleShoppingItem(id: number) {
  return zahtev(`/shoppinglist/${id}/toggle`, "Greska pri azuriranju stavke", { method: "PATCH" });
}

export function deleteShoppingItem(id: number) {
  return zahtev(`/shoppinglist/${id}`, "Greska pri brisanju stavke", { method: "DELETE" });
}

export function getWeeklyReport() {
  return zahtev("/report/weekly", "Greska pri ucitavanju izvestaja");
}

// ---------- Obrada linkova (ingest) ----------

export function startIngest(url: string, tip?: "recept" | "vezba") {
  return zahtev("/ingest/", "Greska pri slanju linka", { method: "POST", json: { url, tip } });
}

export function getIngestJob(id: string) {
  return zahtev(`/ingest/${id}`, "Greska pri citanju statusa");
}

export function saveIngestJob(id: string) {
  return zahtev(`/ingest/${id}/save`, "Greska pri cuvanju", { method: "POST", json: {} });
}

export type PregledStavka = {
  id: string;
  url: string;
  status: "u_toku" | "gotovo" | "potrebna_odluka" | "greska";
  faza: string;
  tip: "recept" | "vezba" | null;
  naziv: string | null;
  greska: string | null;
  created_at: string | null;
};

export async function getIngestPregled(): Promise<PregledStavka[]> {
  const data = await zahtev<{ stavke?: PregledStavka[] } | null>("/ingest/", "Greska pri ucitavanju liste za pregled");
  return data?.stavke ?? [];
}

export function odbaciIngestJob(id: string) {
  return zahtev(`/ingest/${id}/odbaci`, "Greska pri odbacivanju", { method: "POST" });
}

// ---------- Dan (plan kao dnevnik) ----------

export async function getDan(datum: string) {
  return zahtev(`/dan/${datum}?${await vremenaObroka()}`, "Greska pri ucitavanju dana");
}

export function danAkcija(
  datum: string,
  obrokTip: string,
  body: { akcija: "pojeo" | "preskocio" | "zamena"; naziv?: string; kalorije?: number; proteini_g?: number | null }
) {
  return zahtev(`/dan/${datum}/${obrokTip}`, "Greska pri cuvanju obroka", { method: "POST", json: body });
}

export function analyzeMealPhoto(base64: string, mediaType = "image/jpeg") {
  return zahtev("/dan/analiza-slike", "Greska pri analizi slike", {
    method: "POST",
    json: { slika_base64: base64, media_type: mediaType },
  });
}

export type ProcenaObroka = {
  tekst: string;
  naziv: string | null;
  kalorije: number | null;
  proteini_g: number | null;
  stavke: { naziv: string; kalorije: number; proteini_g: number | null }[];
};

/** Kratak opis obroka ("dva jaja i hleb") -> procena. Ništa se ne upisuje u dnevnik. */
export function proceniOpis(tekst: string): Promise<ProcenaObroka> {
  return zahtev("/dan/opis", "Procena nije uspela", { method: "POST", json: { tekst }, detalj: true });
}

/** Snimak glasa (uri sa telefona) -> tekst -> procena. */
export async function proceniGlas(uri: string): Promise<ProcenaObroka> {
  // Expo fetch ne prima React Native oblik { uri, name, type } ("Unsupported FormDataPart implementation"),
  // nego File iz expo-file-system (ima bytes(), name i type). Učitava se ovde da web ne bi pukao.
  const { File } = require("expo-file-system") as typeof import("expo-file-system");
  const fajl = new File(uri);
  if (!fajl.exists) throw new Error("Snimak nije pronađen");
  const form = new FormData();
  form.append("snimak", fajl as any, fajl.name || "obrok.m4a");
  return zahtev("/dan/glas", "Prepoznavanje glasa nije uspelo", { method: "POST", form, detalj: true });
}

// ---------- Nedeljni plan i korekcija cilja ----------

export function osveziNedelju(force = false) {
  return zahtev(`/nedelja/osvezi${force ? "?force=true" : ""}`, "Greska pri osvezavanju nedelje", { method: "POST" });
}

export function getNedeljaStatus() {
  return zahtev("/nedelja/status", "Greska pri citanju statusa");
}

export function getKorekcija() {
  return zahtev("/korekcija/", "Greska pri citanju predloga");
}

export function odgovoriKorekcija(id: number, prihvati: boolean) {
  return zahtev(`/korekcija/${id}/odgovor`, "Greska pri cuvanju odgovora", { method: "POST", json: { prihvati } });
}

export function resetKorekcija() {
  return zahtev("/korekcija/reset", "Greska pri vracanju cilja", { method: "POST" });
}

// ---------- Recept u plan ----------

export async function getPlanSlotovi(recipeId: number) {
  return zahtev(`/plan/slotovi?recipe_id=${recipeId}&${await vremenaObroka()}`, "Greska pri ucitavanju slobodnih obroka", {
    detalj: true,
  });
}

export function ubaciUPlan(recipeId: number, danOffset: number, obrokTip: string) {
  return zahtev("/plan/ubaci", "Greska pri ubacivanju u plan", {
    method: "POST",
    json: { recipe_id: recipeId, dan_offset: danOffset, obrok_tip: obrokTip },
    detalj: true,
  });
}

// ---------- Bar-kod ----------

export type Proizvod = {
  pronadjen: boolean;
  barkod: string;
  naziv?: string;
  kcal_100g?: number | null;
  proteini_100g?: number | null;
  porcija_g?: number | null;
  paket_g?: number | null;
  izvor?: "openfoodfacts" | "etiketa";
  procitano?: boolean;
};

export function getProizvod(barkod: string): Promise<Proizvod> {
  return zahtev(`/proizvod/${enc(barkod)}`, "Greska pri trazenju proizvoda", { detalj: true });
}

export function procitajEtiketu(barkod: string, base64: string, naziv?: string): Promise<Proizvod> {
  return zahtev(`/proizvod/${enc(barkod)}/etiketa`, "Greska pri citanju etikete", {
    method: "POST",
    json: { slika_base64: base64, media_type: "image/jpeg", naziv },
    detalj: true,
  });
}

// ---------- Kopija baze ----------

export type Kopija = { naziv: string; vreme: string; velicina_kb: number };

export function getBackups(): Promise<{ kopije: Kopija[]; zadrzi: number }> {
  return zahtev("/backup/", "Greska pri ucitavanju kopija");
}

export function napraviBackup(): Promise<Kopija> {
  return zahtev("/backup/", "Kopija nije napravljena", { method: "POST" });
}
