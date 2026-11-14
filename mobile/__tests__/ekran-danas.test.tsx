/**
 * Ekran Danas ((tabs)/index.tsx): stanja (nema veze, nema profila, nema jelovnika) i dugmad za obroke.
 * Server, kalendar i notifikacije su zamenjeni lažnim funkcijama.
 */
import { Alert } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DanasScreen from "../src/app/(tabs)/index";
import * as api from "../src/services/api";
import { getTodayDate } from "../src/utils/date";

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    router: { navigate: jest.fn(), push: jest.fn() },
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
  };
});
jest.mock("../src/services/api", () => ({
  getProfile: jest.fn(),
  getDan: jest.fn(),
  getDayLog: jest.fn(),
  danAkcija: jest.fn(),
  deleteLogEntry: jest.fn(),
  getIngestPregled: jest.fn(),
  getLatestWorkoutPlan: jest.fn(),
  getWorkoutDayLog: jest.fn(),
  generateMealPlan: jest.fn(),
}));
jest.mock("../src/services/calendar", () => ({
  getKalendarPodesavanja: jest.fn(() => Promise.resolve({ tip: "teretana", ukljuceno: false, vreme: "18:00" })),
}));
jest.mock("../src/services/notifications", () => ({ scheduleMealReminders: jest.fn(() => Promise.resolve()) }));
// Kartica za novu nedelju ima svoje testove (komponente.test.tsx)
jest.mock("../src/components/NedeljaIKorekcija", () => () => null);

const m = api as jest.Mocked<typeof api>;
const { router } = jest.requireMock("expo-router");
const danas = getTodayDate();

function obrok(obrok_tip: string, status: string, extra: Record<string, unknown> = {}) {
  return { obrok_tip, status, naziv: `Obrok ${obrok_tip}`, kalorije: 500, proteini_g: 30, entry_id: null, ...extra };
}

function dan(extra: Record<string, unknown> = {}) {
  return {
    ima_plana: true,
    dnevni_cilj_kalorija: 2000,
    ukupno: 600,
    procena: 0,
    dnevni_cilj_proteina: 150,
    proteini_ukupno: 40,
    proteini_nepoznato: 0,
    obroci: [obrok("dorucak", "pojeo", { entry_id: 11, kalorije: 600 }), obrok("rucak", "ceka"), obrok("vecera", "ceka")],
    ...extra,
  };
}

let alert: jest.SpyInstance;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  m.getProfile.mockResolvedValue({ exists: true });
  m.getDan.mockResolvedValue(dan());
  m.getDayLog.mockResolvedValue({ unosi: [] });
  m.getIngestPregled.mockResolvedValue([]);
  m.getLatestWorkoutPlan.mockResolvedValue({ exists: false });
  m.getWorkoutDayLog.mockResolvedValue({ unosi: [] });
  m.danAkcija.mockResolvedValue({});
  m.deleteLogEntry.mockResolvedValue({});
  m.generateMealPlan.mockResolvedValue({});
});

afterEach(() => alert.mockRestore());

/** Pritisni dugme iz poslednjeg Alert-a (npr. "Poništi"). */
async function pritisniUAlertu(tekst: string) {
  const dugmad = alert.mock.calls.at(-1)?.[2] ?? [];
  const d = dugmad.find((b: any) => b.text === tekst);
  expect(d).toBeTruthy();
  // onPress osveži ekran (load) -> mora u act, i sačeka se da se osvežavanje završi
  await act(async () => {
    await d.onPress();
  });
  await waitFor(() => expect(m.getDan.mock.calls.length).toBeGreaterThanOrEqual(2));
}

describe("stanja ekrana", () => {
  test("server ne odgovara: poruka i dugme za vezu sa laptopom", async () => {
    m.getProfile.mockRejectedValue(new Error("Network request failed"));
    await render(<DanasScreen />);
    expect(await screen.findByText("Ne mogu da dođem do laptopa")).toBeTruthy();
    await fireEvent.press(screen.getByText("Veza sa laptopom"));
    expect(router.push).toHaveBeenCalledWith("/settings");
    expect(m.getDan).not.toHaveBeenCalled();
  });

  test("'Pokušaj ponovo' učitava opet", async () => {
    m.getProfile.mockRejectedValueOnce(new Error("x"));
    await render(<DanasScreen />);
    await fireEvent.press(await screen.findByText("Pokušaj ponovo"));
    expect(await screen.findByText("Obroci danas")).toBeTruthy();
    expect(m.getProfile).toHaveBeenCalledTimes(2);
  });

  test("nema profila: traži podatke", async () => {
    m.getProfile.mockResolvedValue({ exists: false });
    await render(<DanasScreen />);
    await fireEvent.press(await screen.findByText("Unesi svoje podatke"));
    expect(router.push).toHaveBeenCalledWith("/moji-podaci");
  });

  test("nema jelovnika: pravi ga i podesi podsetnike", async () => {
    m.getDan.mockResolvedValue(dan({ ima_plana: false, obroci: [], ukupno: 0 }));
    await render(<DanasScreen />);
    await fireEvent.press(await screen.findByText("Napravi jelovnik"));
    await waitFor(() => expect(m.generateMealPlan).toHaveBeenCalledTimes(1));
    const { scheduleMealReminders } = jest.requireMock("../src/services/notifications");
    expect(scheduleMealReminders).toHaveBeenCalledWith({ askPermission: false });
  });

  test("jelovnik ne uspe: poruka o grešci", async () => {
    m.getDan.mockResolvedValue(dan({ ima_plana: false, obroci: [] }));
    m.generateMealPlan.mockRejectedValue(new Error("500"));
    await render(<DanasScreen />);
    await fireEvent.press(await screen.findByText("Napravi jelovnik"));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Greška", expect.stringContaining("jelovnika nije uspelo")));
  });
});

describe("pregled dana", () => {
  test("kalorije, proteini i preostali obroci", async () => {
    await render(<DanasScreen />);
    expect(await screen.findByText("Pojeo si 600 od 2000 kcal. Ostalo: ručak, večera.")).toBeTruthy();
    expect(screen.getByText("Ide ti dobro")).toBeTruthy();
    expect(screen.getByText("Još 110 g do cilja.")).toBeTruthy();
    expect(getDanPozvanSa()).toBe(danas);
  });

  test("preko cilja", async () => {
    m.getDan.mockResolvedValue(dan({ ukupno: 2300, obroci: [] }));
    await render(<DanasScreen />);
    expect(await screen.findByText("Malo preko")).toBeTruthy();
    expect(screen.getByText("Pojeo si 2300 kcal, 300 preko cilja. Sutra je novi dan.")).toBeTruthy();
  });

  test("proteini: unosi bez podatka i ispunjen cilj", async () => {
    m.getDan.mockResolvedValue(dan({ proteini_ukupno: 160, proteini_nepoznato: 2 }));
    await render(<DanasScreen />);
    expect(await screen.findByText("Cilj za proteine je ispunjen. Za neke unose ne znam proteine.")).toBeTruthy();
  });

  test("'Još si pojeo' prikazuje samo slobodne unose", async () => {
    m.getDayLog.mockResolvedValue({
      unosi: [
        { id: 1, naziv: "Jabuka", kalorije: 80, izvor: "slobodan" },
        { id: 2, naziv: "Iz plana", kalorije: 600, izvor: "plan" },
        { id: 3, naziv: "Zamena", kalorije: 700, izvor: "zamena" },
      ],
    });
    await render(<DanasScreen />);
    expect(await screen.findByText("Jabuka")).toBeTruthy();
    expect(screen.queryByText("Iz plana")).toBeNull();
    expect(screen.queryByText("Zamena")).toBeNull();
  });

  test("baner za linkove koji su spremni", async () => {
    m.getIngestPregled.mockResolvedValue([
      { id: "a", status: "gotovo" },
      { id: "b", status: "u_toku" },
    ] as any);
    await render(<DanasScreen />);
    await fireEvent.press(await screen.findByText("Novi recepti i vežbe iz tvojih linkova"));
    expect(router.push).toHaveBeenCalledWith("/pregled");
  });

  test("današnji trening iz plana", async () => {
    const idx = (new Date().getDay() + 6) % 7;
    const DANI = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"];
    m.getLatestWorkoutPlan.mockResolvedValue({
      exists: true,
      plan: { teretana: { dani: [{ dan: DANI[idx], je_odmor: false, tip_treninga: "Noge", vezbe: [{}, {}, {}] }] } },
    });
    m.getWorkoutDayLog.mockResolvedValue({ unosi: [{ izvor: "plan" }] });
    await render(<DanasScreen />);
    expect(await screen.findByText("Noge · 3 vežbi")).toBeTruthy();
    expect(screen.getByText("Urađeno 1 od 3")).toBeTruthy();
  });
});

function getDanPozvanSa() {
  return m.getDan.mock.calls[0]?.[0];
}

describe("dugmad za obroke", () => {
  test("'Pojeo sam' upisuje obrok i osveži dan", async () => {
    await render(<DanasScreen />);
    const dugmad = await screen.findAllByText("Pojeo sam");
    expect(dugmad).toHaveLength(2); // doručak je već označen
    await fireEvent.press(dugmad[0]);
    await waitFor(() => expect(m.danAkcija).toHaveBeenCalledWith(danas, "rucak", { akcija: "pojeo" }));
    await waitFor(() => expect(m.getDan).toHaveBeenCalledTimes(2));
  });

  test("'Preskočio sam' za večeru", async () => {
    await render(<DanasScreen />);
    const linkovi = await screen.findAllByText("Preskočio sam ovaj obrok");
    await fireEvent.press(linkovi[1]);
    await waitFor(() => expect(m.danAkcija).toHaveBeenCalledWith(danas, "vecera", { akcija: "preskocio" }));
  });

  test("'Nešto drugo' otvara zamenu za taj obrok", async () => {
    await render(<DanasScreen />);
    await fireEvent.press((await screen.findAllByText("Nešto drugo"))[0]);
    expect(router.push).toHaveBeenCalledWith({ pathname: "/zamena", params: { datum: danas, obrok_tip: "rucak" } });
  });

  test("greška pri čuvanju: poruka, bez pada", async () => {
    m.danAkcija.mockRejectedValue(new Error("x"));
    await render(<DanasScreen />);
    await fireEvent.press((await screen.findAllByText("Pojeo sam"))[0]);
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Greška", "Nije sačuvano. Proveri vezu sa laptopom."));
  });

  test("tap na označen obrok pita za poništavanje", async () => {
    await render(<DanasScreen />);
    await fireEvent.press(await screen.findByText("Obrok dorucak"));
    expect(alert).toHaveBeenCalledWith("Doručak", "Da poništim ovaj unos?", expect.any(Array));
    await pritisniUAlertu("Poništi");
    expect(m.deleteLogEntry).toHaveBeenCalledWith(11);
  });

  test("brisanje slobodnog unosa", async () => {
    m.getDayLog.mockResolvedValue({ unosi: [{ id: 5, naziv: "Jabuka", kalorije: 80, izvor: "slobodan" }] });
    await render(<DanasScreen />);
    await fireEvent.press(await screen.findByLabelText("Obriši Jabuka"));
    await pritisniUAlertu("Obriši");
    expect(m.deleteLogEntry).toHaveBeenCalledWith(5);
  });
});
