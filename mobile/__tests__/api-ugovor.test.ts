/**
 * Ugovor sa backendom: za SVAKU funkciju iz api.ts tačna adresa, metoda, zaglavlja i telo zahteva.
 * Snimak (snapshot) je napravljen na starom kodu pre sređivanja api.ts — ako se promeni, promenio se i zahtev.
 * Vrednost X-API-Key se ne upisuje u snimak (zamenjena je sa "<kljuc>").
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { hostUri: "192.168.1.20:8081" } } }));
jest.mock("expo-file-system", () => ({
  // Blob da bi ga FormData u testu primio (pravi File iz expo-file-system radi isto na telefonu)
  File: class extends Blob {
    uri: string;
    exists = true;
    name = "snimak.m4a";
    constructor(uri: string) {
      super(["x"]);
      this.uri = uri;
    }
  },
}));

type Api = typeof import("../src/services/api");

const fetchMock = jest.fn();

function zapis() {
  return fetchMock.mock.calls.map(([url, opts]) => {
    const headers = { ...(opts?.headers ?? {}) };
    if ("X-API-Key" in headers) headers["X-API-Key"] = "<kljuc>";
    const body = opts?.body;
    return {
      url,
      method: opts?.method ?? "GET",
      headers,
      body: body instanceof FormData ? "FormData" : body === undefined ? undefined : JSON.parse(body),
    };
  });
}

let api: Api;

beforeEach(async () => {
  await AsyncStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ stavke: [1] }) }));
  (global as any).fetch = fetchMock;
  jest.useFakeTimers({ now: new Date(2026, 10, 14, 9, 5), doNotFake: ["nextTick", "setImmediate"] });
  jest.isolateModules(() => {
    api = require("../src/services/api");
  });
});

afterEach(() => jest.useRealTimers());

const POZIVI: [string, (a: Api) => Promise<unknown>][] = [
  ["submitRecipeLink", (a) => a.submitRecipeLink("https://www.instagram.com/reel/x")],
  ["saveProfile", (a) => a.saveProfile({ tezina_kg: 80, visina_cm: 180, godine: 25, pol: "muski", nivo_aktivnosti: "umereno", cilj: "odrzavanje", raspodela_kalorija: "ravnomerno" })],
  ["getProfile", (a) => a.getProfile()],
  ["generateMealPlan", (a) => a.generateMealPlan()],
  ["getLatestMealPlan", (a) => a.getLatestMealPlan()],
  ["sendChatMessage", (a) => a.sendChatMessage("zdravo")],
  ["getChatHistory", (a) => a.getChatHistory()],
  ["listRecipes", (a) => a.listRecipes()],
  ["deleteRecipe", (a) => a.deleteRecipe(3)],
  ["addLogEntry", (a) => a.addLogEntry({ datum: "2026-11-14", naziv: "Jaja", kalorije: 150, izvor: "slobodan" })],
  ["deleteLogEntry", (a) => a.deleteLogEntry(4)],
  ["getDayLog", (a) => a.getDayLog("2026-11-14")],
  ["addManualRecipe", (a) => a.addManualRecipe({ naziv_jela: "Supa", sastojci: [{ naziv: "voda", kolicina: "1 l" }], koraci: ["kuvaj"] })],
  ["submitExerciseLink", (a) => a.submitExerciseLink("https://www.tiktok.com/@a/video/1")],
  ["listExercises", (a) => a.listExercises()],
  ["deleteExercise", (a) => a.deleteExercise(5)],
  ["getExerciseDetails", (a) => a.getExerciseDetails(6)],
  ["searchExerciseCatalog", (a) => a.searchExerciseCatalog("push up&x")],
  ["getCatalogByName", (a) => a.getCatalogByName("Čučanj sa šipkom", "noge")],
  ["getCatalogByName bez grupe", (a) => a.getCatalogByName("Plank")],
  ["setCatalogByName", (a) => a.setCatalogByName("Plank", null)],
  ["setExerciseCatalog", (a) => a.setExerciseCatalog(7, "I4hDWkc")],
  ["generateWorkoutPlan", (a) => a.generateWorkoutPlan()],
  ["getLatestWorkoutPlan", (a) => a.getLatestWorkoutPlan()],
  ["addWorkoutLogEntry", (a) => a.addWorkoutLogEntry({ datum: "2026-11-14", naziv_vezbe: "Sklekovi", izvor: "plan" })],
  ["deleteWorkoutLogEntry", (a) => a.deleteWorkoutLogEntry(8)],
  ["getWorkoutDayLog", (a) => a.getWorkoutDayLog("2026-11-14")],
  ["addWeightEntry", (a) => a.addWeightEntry({ datum: "2026-11-14", tezina_kg: 80.5 })],
  ["deleteWeightEntry", (a) => a.deleteWeightEntry(9)],
  ["getWeightSummary", (a) => a.getWeightSummary()],
  ["addManualExercise", (a) => a.addManualExercise({ naziv_vezbe: "Zgibovi", grupa_misica: "leđa", serije_i_ponavljanja: "3x8" })],
  ["generateShoppingList", (a) => a.generateShoppingList()],
  ["getShoppingList", (a) => a.getShoppingList()],
  ["toggleShoppingItem", (a) => a.toggleShoppingItem(10)],
  ["deleteShoppingItem", (a) => a.deleteShoppingItem(11)],
  ["getWeeklyReport", (a) => a.getWeeklyReport()],
  ["generateShoppingListFromRecipe", (a) => a.generateShoppingListFromRecipe(12)],
  ["startIngest", (a) => a.startIngest("https://www.instagram.com/reel/x", "recept")],
  ["startIngest bez tipa", (a) => a.startIngest("https://www.instagram.com/reel/x")],
  ["getIngestJob", (a) => a.getIngestJob("abc")],
  ["saveIngestJob", (a) => a.saveIngestJob("abc")],
  ["getIngestPregled", (a) => a.getIngestPregled()],
  ["odbaciIngestJob", (a) => a.odbaciIngestJob("abc")],
  ["getDan", (a) => a.getDan("2026-11-14")],
  ["danAkcija", (a) => a.danAkcija("2026-11-14", "rucak", { akcija: "zamena", naziv: "Pica", kalorije: 800, proteini_g: 30 })],
  ["analyzeMealPhoto", (a) => a.analyzeMealPhoto("QUJD")],
  ["proceniOpis", (a) => a.proceniOpis("dva jaja")],
  ["proceniGlas", (a) => a.proceniGlas("file:///snimak.m4a")],
  ["osveziNedelju", (a) => a.osveziNedelju()],
  ["osveziNedelju force", (a) => a.osveziNedelju(true)],
  ["getNedeljaStatus", (a) => a.getNedeljaStatus()],
  ["getPlanSlotovi", (a) => a.getPlanSlotovi(13)],
  ["ubaciUPlan", (a) => a.ubaciUPlan(13, 2, "vecera")],
  ["getProizvod", (a) => a.getProizvod("3017620422003")],
  ["procitajEtiketu", (a) => a.procitajEtiketu("3017620422003", "QUJD", "Nutella")],
  ["getKorekcija", (a) => a.getKorekcija()],
  ["odgovoriKorekcija", (a) => a.odgovoriKorekcija(14, true)],
  ["resetKorekcija", (a) => a.resetKorekcija()],
  ["getBackups", (a) => a.getBackups()],
  ["napraviBackup", (a) => a.napraviBackup()],
];

describe("zahtev za svaku funkciju", () => {
  test.each(POZIVI)("%s", async (_ime, poziv) => {
    await poziv(api);
    expect(zapis()).toMatchSnapshot();
  });
});

describe("poruke o grešci", () => {
  function greska(body: unknown) {
    fetchMock.mockImplementation(() => Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve(body) }));
  }

  test("stalna poruka (server detail se ne prikazuje)", async () => {
    greska({ detail: "interno" });
    await expect(api.getProfile()).rejects.toThrow("Greska pri ucitavanju profila");
    await expect(api.deleteRecipe(1)).rejects.toThrow("Greska pri brisanju recepta");
  });

  test("poruka servera gde je predviđena", async () => {
    greska({ detail: "Nema obroka u planu" });
    await expect(api.ubaciUPlan(1, 0, "rucak")).rejects.toThrow("Nema obroka u planu");
    await expect(api.proceniOpis("x")).rejects.toThrow("Nema obroka u planu");
  });

  test("bez detail: rezervna poruka", async () => {
    greska({ detail: [{ msg: "x" }] });
    await expect(api.getProizvod("1")).rejects.toThrow("Greska pri trazenju proizvoda");
    fetchMock.mockImplementation(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error("nije JSON")) }));
    await expect(api.proceniOpis("x")).rejects.toThrow("Procena nije uspela");
  });

  test("pregled bez stavki vraća praznu listu", async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null) }));
    expect(await api.getIngestPregled()).toEqual([]);
  });

  test("snimak koji ne postoji: greška pre slanja", async () => {
    const fs = require("expo-file-system");
    const stari = fs.File;
    fs.File = class extends stari {
      exists = false;
    };
    try {
      await expect(api.proceniGlas("file:///nema.m4a")).rejects.toThrow("Snimak nije pronađen");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fs.File = stari;
    }
  });
});
