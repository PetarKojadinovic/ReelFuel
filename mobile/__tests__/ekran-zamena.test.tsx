/**
 * Ekran "Nešto drugo" (zamena.tsx): ručni unos, provera polja, procena iz naziva i sa slike.
 * Server i kamera su zamenjeni lažnim funkcijama; mikrofon (ExpoAudio) ne postoji u testu.
 */
import { Alert } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ZamenaScreen from "../src/app/zamena";
import * as api from "../src/services/api";

const mockParams: { datum: string; obrok_tip?: string; odmah?: string } = { datum: "2026-11-14" };

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("expo", () => ({ ...jest.requireActual("expo"), requireOptionalNativeModule: () => null }));
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("../src/services/api", () => ({
  analyzeMealPhoto: jest.fn(),
  danAkcija: jest.fn(),
  addLogEntry: jest.fn(),
  proceniOpis: jest.fn(),
}));

const m = api as jest.Mocked<typeof api>;
const picker = jest.requireMock("expo-image-picker");
const { router } = jest.requireMock("expo-router");

let alert: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.obrok_tip = undefined;
  mockParams.odmah = undefined;
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  m.danAkcija.mockResolvedValue({});
  m.addLogEntry.mockResolvedValue({});
});

afterEach(() => alert.mockRestore());

async function popuni(naziv: string, kcal: string, prot = "") {
  await fireEvent.changeText(screen.getByPlaceholderText("npr. Pasta sa piletinom"), naziv);
  await fireEvent.changeText(screen.getByPlaceholderText("npr. 650"), kcal);
  if (prot) await fireEvent.changeText(screen.getByPlaceholderText("npr. 35"), prot);
}

describe("ručni unos", () => {
  test("zamena obroka iz plana (proteini sa zarezom)", async () => {
    mockParams.obrok_tip = "rucak";
    await render(<ZamenaScreen />);
    expect(screen.getByText("Šta si pojeo umesto toga?")).toBeTruthy();
    await popuni("  Pica  ", "800", "35,5");
    await fireEvent.press(screen.getByText("Potvrdi"));
    await waitFor(() =>
      expect(m.danAkcija).toHaveBeenCalledWith("2026-11-14", "rucak", { akcija: "zamena", naziv: "Pica", kalorije: 800, proteini_g: 35.5 })
    );
    expect(m.addLogEntry).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });

  test("slobodan unos bez proteina = nepoznato (null)", async () => {
    await render(<ZamenaScreen />);
    expect(screen.getByText("Šta si pojeo?")).toBeTruthy();
    await popuni("Jabuka", "80");
    await fireEvent.press(screen.getByText("Potvrdi"));
    await waitFor(() =>
      expect(m.addLogEntry).toHaveBeenCalledWith({ datum: "2026-11-14", naziv: "Jabuka", kalorije: 80, proteini_g: null, izvor: "slobodan" })
    );
  });

  test("bez prethodnog ekrana ide na početnu", async () => {
    router.canGoBack.mockReturnValueOnce(false);
    await render(<ZamenaScreen />);
    await popuni("Jabuka", "80");
    await fireEvent.press(screen.getByText("Potvrdi"));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  test.each([
    ["", "500", "Unesi naziv i kalorije (0 do 5000)."],
    ["Pica", "", "Unesi naziv i kalorije (0 do 5000)."],
    ["Pica", "9000", "Unesi naziv i kalorije (0 do 5000)."],
    ["Pica", "-5", "Unesi naziv i kalorije (0 do 5000)."],
  ])("loš unos (%j, %j) se ne šalje", async (naziv, kcal, poruka) => {
    await render(<ZamenaScreen />);
    await popuni(naziv, kcal);
    await fireEvent.press(screen.getByText("Potvrdi"));
    expect(alert).toHaveBeenCalledWith("Greška", poruka);
    expect(m.addLogEntry).not.toHaveBeenCalled();
  });

  test.each(["abc", "900"])("loši proteini (%j) se ne šalju", async (prot) => {
    await render(<ZamenaScreen />);
    await popuni("Pica", "800", prot);
    await fireEvent.press(screen.getByText("Potvrdi"));
    expect(alert).toHaveBeenCalledWith("Greška", expect.stringContaining("Proteini moraju biti broj"));
    expect(m.addLogEntry).not.toHaveBeenCalled();
  });

  test("server ne sačuva: poruka, ostaje na ekranu", async () => {
    m.addLogEntry.mockRejectedValue(new Error("x"));
    await render(<ZamenaScreen />);
    await popuni("Jabuka", "80");
    await fireEvent.press(screen.getByText("Potvrdi"));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Greška", "Nije uspelo čuvanje."));
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe("procena iz naziva", () => {
  test("dugme se pojavi kad ima naziva a nema kalorija, pa popuni polja", async () => {
    m.proceniOpis.mockResolvedValue({
      tekst: "dva jaja i hleb",
      naziv: "Jaja i hleb",
      kalorije: 310,
      proteini_g: 15.6,
      stavke: [
        { naziv: "2 jaja", kalorije: 150, proteini_g: 12 },
        { naziv: "hleb", kalorije: 160, proteini_g: null },
      ],
    });
    await render(<ZamenaScreen />);
    expect(screen.queryByText("Izračunaj kalorije iz naziva")).toBeNull();
    await fireEvent.changeText(screen.getByPlaceholderText("npr. Pasta sa piletinom"), " dva jaja i hleb ");
    await fireEvent.press(screen.getByText("Izračunaj kalorije iz naziva"));
    expect(m.proceniOpis).toHaveBeenCalledWith("dva jaja i hleb");
    expect(await screen.findByDisplayValue("310")).toBeTruthy();
    expect(screen.getByDisplayValue("16")).toBeTruthy();
    expect(screen.getByText("Čuo sam: „dva jaja i hleb“")).toBeTruthy();
    expect(screen.getByText("150 kcal · 12 g P")).toBeTruthy();
    expect(screen.getByText("160 kcal")).toBeTruthy();
  });

  test("nema hrane u opisu", async () => {
    m.proceniOpis.mockResolvedValue({ tekst: "zdravo", naziv: null, kalorije: null, proteini_g: null, stavke: [] });
    await render(<ZamenaScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("npr. Pasta sa piletinom"), "zdravo");
    await fireEvent.press(screen.getByText("Izračunaj kalorije iz naziva"));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Nisam razumeo", expect.any(String)));
  });
});

describe("slika obroka", () => {
  const procena = { naziv: "Piletina sa pirinčem", kalorije: 650, proteini_g: 45, kalorije_min: 550, kalorije_max: 750, pouzdanost: "srednja" };

  test("iz galerije: popuni polja i napomenu", async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ base64: "QUJD" }] });
    m.analyzeMealPhoto.mockResolvedValue(procena);
    await render(<ZamenaScreen />);
    await fireEvent.press(screen.getByText("Iz galerije"));
    expect(await screen.findByDisplayValue("Piletina sa pirinčem")).toBeTruthy();
    expect(m.analyzeMealPhoto).toHaveBeenCalledWith("QUJD");
    expect(screen.getByDisplayValue("650")).toBeTruthy();
    expect(screen.getByText(/oko 550 do 750 kcal/)).toBeTruthy();
  });

  test("odustao od galerije: ništa se ne šalje", async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true });
    await render(<ZamenaScreen />);
    await fireEvent.press(screen.getByText("Iz galerije"));
    await waitFor(() => expect(picker.launchImageLibraryAsync).toHaveBeenCalled());
    expect(m.analyzeMealPhoto).not.toHaveBeenCalled();
  });

  test("nema dozvole za kameru", async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
    await render(<ZamenaScreen />);
    await fireEvent.press(screen.getByText("Slikaj"));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Dozvola", expect.any(String)));
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  test("odmah=slika (iz panela +) otvara kameru sam", async () => {
    mockParams.odmah = "slika";
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ base64: "Rk9U" }] });
    m.analyzeMealPhoto.mockResolvedValue(procena);
    await render(<ZamenaScreen />);
    await waitFor(() => expect(m.analyzeMealPhoto).toHaveBeenCalledWith("Rk9U"));
    expect(picker.launchCameraAsync).toHaveBeenCalledTimes(1);
  });

  test("na slici nema hrane", async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ base64: "QUJD" }] });
    m.analyzeMealPhoto.mockResolvedValue({ naziv: null });
    await render(<ZamenaScreen />);
    await fireEvent.press(screen.getByText("Iz galerije"));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Nije prepoznato", expect.any(String)));
  });

  test("skener bar-koda dobija isti obrok", async () => {
    mockParams.obrok_tip = "vecera";
    await render(<ZamenaScreen />);
    await fireEvent.press(screen.getByText("Skeniraj bar-kod sa pakovanja"));
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/skener", params: { datum: "2026-11-14", obrok_tip: "vecera" } });
  });
});
