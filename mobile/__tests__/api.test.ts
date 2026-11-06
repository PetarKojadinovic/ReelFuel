/**
 * Adresa servera (auto / ručno) i API pozivi. fetch je zamenjen, ništa ne ide na mrežu.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const mockConstants = { expoConfig: { hostUri: "192.168.1.20:8081" } as { hostUri?: string } };
jest.mock("expo-constants", () => ({ __esModule: true, default: mockConstants }));

type ApiConfig = typeof import("../src/services/apiConfig");
type Api = typeof import("../src/services/api");

/** Svež modul (apiConfig pamti adresu u promenljivoj). */
function ucitaj(): { cfg: ApiConfig; api: Api } {
  let cfg!: ApiConfig;
  let api!: Api;
  jest.isolateModules(() => {
    cfg = require("../src/services/apiConfig");
    api = require("../src/services/api");
  });
  return { cfg, api };
}

const fetchMock = jest.fn();

function odgovor(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockConstants.expoConfig = { hostUri: "192.168.1.20:8081" };
  fetchMock.mockReset();
  (global as any).fetch = fetchMock;
});

describe("adresa servera", () => {
  test("auto: isti računar kao Expo, port 8000", async () => {
    const { cfg } = ucitaj();
    expect(cfg.getAutoUrl()).toBe("http://192.168.1.20:8000");
    expect(await cfg.getApiMode()).toBe("auto");
    expect(await cfg.getApiUrl()).toBe("http://192.168.1.20:8000");
  });

  test("ručna adresa ima prednost i pamti se", async () => {
    const { cfg } = ucitaj();
    await cfg.setApiUrl("http://10.0.0.5:8000");
    expect(await cfg.getApiMode()).toBe("rucno");
    expect(await cfg.getApiUrl()).toBe("http://10.0.0.5:8000");
    const { cfg: posleRestarta } = ucitaj();
    expect(await posleRestarta.getApiUrl()).toBe("http://10.0.0.5:8000");
  });

  test("bez Expo adrese (release build) koristi ručnu/rezervnu", async () => {
    mockConstants.expoConfig = {};
    const { cfg } = ucitaj();
    expect(cfg.getAutoUrl()).toBeNull();
    expect(await cfg.getApiUrl()).toBe(cfg.getDefaultUrl());
  });

  test("povratak na auto briše zapamćenu adresu", async () => {
    const { cfg } = ucitaj();
    await cfg.setApiUrl("http://10.0.0.5:8000");
    await cfg.setApiMode("auto");
    expect(await cfg.getApiUrl()).toBe("http://192.168.1.20:8000");
  });
});

describe("API pozivi", () => {
  test("šalje X-API-Key i ide na pravu adresu", async () => {
    const { api } = ucitaj();
    fetchMock.mockReturnValue(odgovor({ exists: false }));
    expect(await api.getProfile()).toEqual({ exists: false });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("http://192.168.1.20:8000/profile/");
    expect(opts.headers).toHaveProperty("X-API-Key");
  });

  test("nov plan: force samo kad se traži", async () => {
    const { api } = ucitaj();
    fetchMock.mockReturnValue(odgovor({ status: "azurno" }));
    await api.osveziNedelju();
    await api.osveziNedelju(true);
    expect(fetchMock.mock.calls[0][0]).toBe("http://192.168.1.20:8000/nedelja/osvezi");
    expect(fetchMock.mock.calls[1][0]).toBe("http://192.168.1.20:8000/nedelja/osvezi?force=true");
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
  });

  test("greška servera baca izuzetak (ekran prikaže poruku)", async () => {
    const { api } = ucitaj();
    fetchMock.mockReturnValue(odgovor({ detail: "x" }, false, 500));
    await expect(api.getProfile()).rejects.toThrow();
    await expect(api.napraviBackup()).rejects.toThrow("Kopija nije napravljena");
  });

  test("kopija podataka", async () => {
    const { api } = ucitaj();
    fetchMock.mockReturnValue(odgovor({ kopije: [{ naziv: "reelfuel-1.db", vreme: "2026-11-06T12:25:20", velicina_kb: 216 }], zadrzi: 10 }));
    const b = await api.getBackups();
    expect(b.kopije[0].velicina_kb).toBe(216);
    fetchMock.mockReturnValue(odgovor({ naziv: "reelfuel-2.db" }));
    await api.napraviBackup();
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
  });
});
