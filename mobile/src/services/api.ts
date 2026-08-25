import { getApiUrl } from "./apiConfig";

const API_KEY = process.env.EXPO_PUBLIC_API_KEY || "";

function authHeaders(extra: Record<string, string> = {}) {
  return {
    "X-API-Key": API_KEY,
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