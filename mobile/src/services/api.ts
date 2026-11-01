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

export async function submitRecipeLink(url: string) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/recipe/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error("Greska pri obradi linka");
  return response.json();
}

export async function saveProfile(profile: {
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
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/profile/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(profile),
  });
  if (!response.ok) throw new Error("Greska pri cuvanju profila");
  return response.json();
}

export async function getProfile() {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/profile/`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri ucitavanju profila");
  return response.json();
}

export async function generateMealPlan() {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/mealplan/generate`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Greska pri generisanju plana");
  return response.json();
}

export async function getLatestMealPlan() {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/mealplan/latest`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri ucitavanju plana");
  return response.json();
}

export async function sendChatMessage(message: string) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/chat/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ message }),
  });
  if (!response.ok) throw new Error("Greska pri slanju poruke");
  return response.json();
}

export async function getChatHistory() {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/chat/history`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri ucitavanju istorije");
  return response.json();
}

export async function listRecipes() {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/recipe/list`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri ucitavanju recepata");
  return response.json();
}

export async function deleteRecipe(id: number) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/recipe/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Greska pri brisanju recepta");
  return response.json();
}

export async function addLogEntry(entry: {
  datum: string;
  naziv: string;
  kalorije: number;
  obrok_tip?: string;
  izvor: string;
}) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/log/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(entry),
  });
  if (!response.ok) throw new Error("Greska pri cuvanju unosa");
  return response.json();
}

export async function deleteLogEntry(id: number) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/log/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Greska pri brisanju unosa");
  return response.json();
}

export async function getDayLog(datum: string) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/log/${datum}`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri ucitavanju dnevnika");
  return response.json();
}

export async function addManualRecipe(recipe: {
  naziv_jela: string;
  sastojci: { naziv: string; kolicina: string }[];
  koraci: string[];
  priblizne_kalorije?: string;
}) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/recipe/manual`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(recipe),
  });
  if (!response.ok) throw new Error("Greska pri cuvanju recepta");
  return response.json();
}

export async function submitExerciseLink(url: string) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/exercise/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error("Greska pri obradi linka");
  return response.json();
}

export async function listExercises() {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/exercise/list`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri ucitavanju vezbi");
  return response.json();
}

export async function deleteExercise(id: number) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/exercise/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Greska pri brisanju vezbe");
  return response.json();
}

export async function generateWorkoutPlan() {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/workoutplan/generate`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Greska pri generisanju plana treninga");
  return response.json();
}

export async function getLatestWorkoutPlan() {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/workoutplan/latest`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri ucitavanju plana treninga");
  return response.json();
}

export async function addWorkoutLogEntry(entry: {
  datum: string;
  naziv_vezbe: string;
  serije_i_ponavljanja?: string;
  dan_treninga?: string;
  izvor: string;
}) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/workoutlog/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(entry),
  });
  if (!response.ok) throw new Error("Greska pri cuvanju unosa treninga");
  return response.json();
}

export async function deleteWorkoutLogEntry(id: number) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/workoutlog/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Greska pri brisanju unosa treninga");
  return response.json();
}

export async function getWorkoutDayLog(datum: string) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/workoutlog/${datum}`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri ucitavanju dnevnika treninga");
  return response.json();
}

export async function addWeightEntry(entry: { datum: string; tezina_kg: number }) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/weightlog/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(entry),
  });
  if (!response.ok) throw new Error("Greska pri cuvanju tezine");
  return response.json();
}

export async function deleteWeightEntry(id: number) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/weightlog/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Greska pri brisanju unosa");
  return response.json();
}

export async function getWeightSummary() {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/weightlog/summary`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri ucitavanju istorije tezine");
  return response.json();
}

export async function addManualExercise(exercise: {
  naziv_vezbe: string;
  grupa_misica: string;
  serije_i_ponavljanja: string;
}) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/exercise/manual`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(exercise),
  });
  if (!response.ok) throw new Error("Greska pri cuvanju vezbe");
  return response.json();
}

export async function generateShoppingList() {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/shoppinglist/generate`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Greska pri generisanju liste");
  return response.json();
}

export async function getShoppingList() {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/shoppinglist/`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri ucitavanju liste");
  return response.json();
}

export async function toggleShoppingItem(id: number) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/shoppinglist/${id}/toggle`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Greska pri azuriranju stavke");
  return response.json();
}

export async function deleteShoppingItem(id: number) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/shoppinglist/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Greska pri brisanju stavke");
  return response.json();
}

export async function getWeeklyReport() {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/report/weekly`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri ucitavanju izvestaja");
  return response.json();
}

export async function generateShoppingListFromRecipe(recipeId: number) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/shoppinglist/generate-from-recipe`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ recipe_id: recipeId }),
  });
  if (!response.ok) throw new Error("Greska pri dodavanju iz recepta");
  return response.json();
}


export async function startIngest(url: string, tip?: "recept" | "vezba") {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/ingest/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ url, tip }),
  });
  if (!response.ok) throw new Error("Greska pri slanju linka");
  return response.json();
}

export async function getIngestJob(id: string) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/ingest/${id}`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri citanju statusa");
  return response.json();
}

export async function saveIngestJob(id: string) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/ingest/${id}/save`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new Error("Greska pri cuvanju");
  return response.json();
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
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/ingest/`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri ucitavanju liste za pregled");
  const data = await response.json();
  return data?.stavke ?? [];
}

export async function odbaciIngestJob(id: string) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/ingest/${id}/odbaci`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Greska pri odbacivanju");
  return response.json();
}

function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export async function getDan(datum: string) {
  const API_BASE_URL = await getApiUrl();
  const t = await getMealTimes();
  const q =
    `sada=${encodeURIComponent(nowHM())}` +
    `&dorucak=${encodeURIComponent(t.dorucak)}` +
    `&rucak=${encodeURIComponent(t.rucak)}` +
    `&vecera=${encodeURIComponent(t.vecera)}`;
  const response = await fetch(`${API_BASE_URL}/dan/${datum}?${q}`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri ucitavanju dana");
  return response.json();
}

export async function danAkcija(
  datum: string,
  obrokTip: string,
  body: { akcija: "pojeo" | "preskocio" | "zamena"; naziv?: string; kalorije?: number }
) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/dan/${datum}/${obrokTip}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Greska pri cuvanju obroka");
  return response.json();
}

export async function analyzeMealPhoto(base64: string, mediaType = "image/jpeg") {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/dan/analiza-slike`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ slika_base64: base64, media_type: mediaType }),
  });
  if (!response.ok) throw new Error("Greska pri analizi slike");
  return response.json();
}


async function serverDetail(response: Response, fallback: string): Promise<string> {
  try {
    const j = await response.json();
    if (typeof j.detail === "string") return j.detail;
  } catch {}
  return fallback;
}

export async function osveziNedelju() {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/nedelja/osvezi`, { method: "POST", headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri osvezavanju nedelje");
  return response.json();
}

export async function getNedeljaStatus() {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/nedelja/status`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri citanju statusa");
  return response.json();
}

export async function getPlanSlotovi(recipeId: number) {
  const API_BASE_URL = await getApiUrl();
  const t = await getMealTimes();
  const q =
    `recipe_id=${recipeId}&sada=${encodeURIComponent(nowHM())}` +
    `&dorucak=${encodeURIComponent(t.dorucak)}&rucak=${encodeURIComponent(t.rucak)}&vecera=${encodeURIComponent(t.vecera)}`;
  const response = await fetch(`${API_BASE_URL}/plan/slotovi?${q}`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await serverDetail(response, "Greska pri ucitavanju slobodnih obroka"));
  return response.json();
}

export async function ubaciUPlan(recipeId: number, danOffset: number, obrokTip: string) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/plan/ubaci`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ recipe_id: recipeId, dan_offset: danOffset, obrok_tip: obrokTip }),
  });
  if (!response.ok) throw new Error(await serverDetail(response, "Greska pri ubacivanju u plan"));
  return response.json();
}

export type Proizvod = {
  pronadjen: boolean;
  barkod: string;
  naziv?: string;
  kcal_100g?: number | null;
  porcija_g?: number | null;
  paket_g?: number | null;
  izvor?: "openfoodfacts" | "etiketa";
  procitano?: boolean;
};

export async function getProizvod(barkod: string): Promise<Proizvod> {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/proizvod/${encodeURIComponent(barkod)}`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await serverDetail(response, "Greska pri trazenju proizvoda"));
  return response.json();
}

export async function procitajEtiketu(barkod: string, base64: string, naziv?: string): Promise<Proizvod> {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/proizvod/${encodeURIComponent(barkod)}/etiketa`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ slika_base64: base64, media_type: "image/jpeg", naziv }),
  });
  if (!response.ok) throw new Error(await serverDetail(response, "Greska pri citanju etikete"));
  return response.json();
}

export async function getKorekcija() {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/korekcija/`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri citanju predloga");
  return response.json();
}

export async function odgovoriKorekcija(id: number, prihvati: boolean) {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/korekcija/${id}/odgovor`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prihvati }),
  });
  if (!response.ok) throw new Error("Greska pri cuvanju odgovora");
  return response.json();
}

export async function resetKorekcija() {
  const API_BASE_URL = await getApiUrl();
  const response = await fetch(`${API_BASE_URL}/korekcija/reset`, { method: "POST", headers: authHeaders() });
  if (!response.ok) throw new Error("Greska pri vracanju cilja");
  return response.json();
}