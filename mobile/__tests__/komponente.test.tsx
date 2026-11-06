/**
 * Komponente: ui.tsx, CalorieRing i kartica za novu nedelju (NedeljaIKorekcija).
 * Server je zamenjen lažnim funkcijama.
 */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CalorieRing from "../src/components/CalorieRing";
import NedeljaIKorekcija from "../src/components/NedeljaIKorekcija";
import { EmptyState, HighlightCard, ListRow, Message, TextButton } from "../src/components/ui";
import * as api from "../src/services/api";

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    router: { navigate: jest.fn(), push: jest.fn() },
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
  };
});
jest.mock("../src/services/api", () => ({
  osveziNedelju: jest.fn(),
  getNedeljaStatus: jest.fn(),
  getKorekcija: jest.fn(),
  odgovoriKorekcija: jest.fn(),
  resetKorekcija: jest.fn(),
}));

const m = api as jest.Mocked<typeof api>;
const { router } = jest.requireMock("expo-router");

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  m.getKorekcija.mockResolvedValue({ predlog: null, korekcija: 0 });
});

describe("ui.tsx", () => {
  test("ListRow prikazuje vrednost i reaguje na dodir", async () => {
    const onPress = jest.fn();
    await render(<ListRow icon="save-outline" title="Kopija podataka" value="danas 12:25" onPress={onPress} />);
    await fireEvent.press(screen.getByText("Kopija podataka"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText("danas 12:25")).toBeTruthy();
  });

  test("ListRow bez onPress nije dugme", async () => {
    await render(<ListRow icon="wifi-outline" title="Veza" />);
    expect(screen.getByText("Veza")).toBeTruthy();
    expect(screen.queryByText("danas")).toBeNull();
  });

  test("Message: dugmad samo kad postoji i akcija", async () => {
    const onAction = jest.fn();
    await render(<Message title="Ne mogu da dođem do laptopa" action="Veza sa laptopom" onAction={onAction} secondary="Ne" />);
    await fireEvent.press(screen.getByText("Veza sa laptopom"));
    expect(onAction).toHaveBeenCalled();
    expect(screen.queryByText("Ne")).toBeNull(); // secondary bez onSecondary se ne prikazuje
  });

  test("EmptyState pokazuje 'Radim...' dok traje", async () => {
    await render(<EmptyState icon="restaurant-outline" title="Nema jelovnika" action="Napravi jelovnik" onAction={() => {}} busy />);
    expect(screen.getByText("Radim...")).toBeTruthy();
  });

  test("HighlightCard i TextButton", async () => {
    const onPress = jest.fn();
    await render(
      <>
        <HighlightCard broj={3} title="Novi recepti" subtitle="Dodirni da ih sačuvaš" onPress={onPress} />
        <TextButton title="Odbaci" onPress={onPress} />
      </>
    );
    await fireEvent.press(screen.getByText("Novi recepti"));
    await fireEvent.press(screen.getByText("Odbaci"));
    expect(onPress).toHaveBeenCalledTimes(2);
    expect(screen.getByText("3")).toBeTruthy();
  });
});

describe("CalorieRing", () => {
  test.each([
    [0, 0],
    [0.5, 50],
    [1.4, 100], // preko cilja: pun krug
    [-1, 0],
  ])("progres %p -> %p%%", async (progres, procenat) => {
    await render(<CalorieRing progres={progres} vrednost={1200} oznaka="kcal ostalo" />);
    expect(screen.getByRole("progressbar").props.accessibilityValue.now).toBe(procenat);
    expect(screen.getByText("1200")).toBeTruthy();
  });
});

describe("NedeljaIKorekcija", () => {
  afterEach(() => jest.useRealTimers());

  test("nova nedelja: pravi plan, javi kad je spreman, vodi na jelovnik", async () => {
    jest.useFakeTimers();
    m.osveziNedelju.mockResolvedValue({ status: "pokrenuto" });
    m.getNedeljaStatus.mockResolvedValue({ status: "azurno" });
    const onChanged = jest.fn();
    await render(<NedeljaIKorekcija onChanged={onChanged} />);

    expect(await screen.findByText("Nova nedelja")).toBeTruthy();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(4000);
    });
    expect(screen.getByText("Plan za ovu nedelju je spreman")).toBeTruthy();
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(m.osveziNedelju).toHaveBeenCalledTimes(1); // ne pokreće se ponovo pri crtanju

    await fireEvent.press(screen.getByText("Pogledaj jelovnik"));
    expect(router.navigate).toHaveBeenCalledWith({ pathname: "/hrana", params: { deo: "jelovnik" } });
    await fireEvent.press(screen.getByLabelText("Zatvori"));
    expect(screen.queryByText("Plan za ovu nedelju je spreman")).toBeNull();
  });

  test("plan je već tu: ništa se ne prikazuje", async () => {
    m.osveziNedelju.mockResolvedValue({ status: "azurno" });
    await render(<NedeljaIKorekcija />);
    await act(async () => {});
    expect(screen.queryByText("Nova nedelja")).toBeNull();
    expect(screen.queryByText("Plan za ovu nedelju je spreman")).toBeNull();
  });

  test("greška: 'Pokušaj ponovo' šalje force", async () => {
    m.osveziNedelju.mockResolvedValueOnce({ status: "greska" }).mockResolvedValueOnce({ status: "azurno" });
    await render(<NedeljaIKorekcija />);
    await fireEvent.press(await screen.findByText("Pokušaj ponovo"));
    await act(async () => {});
    expect(m.osveziNedelju).toHaveBeenLastCalledWith(true);
  });

  test("isključen automatski plan: server se ne pita", async () => {
    await AsyncStorage.setItem("reelfuel_auto_plan", "0");
    await render(<NedeljaIKorekcija />);
    await act(async () => {});
    expect(m.osveziNedelju).not.toHaveBeenCalled();
    expect(m.getKorekcija).toHaveBeenCalled();
  });

  test("predlog korekcije: prihvati", async () => {
    m.osveziNedelju.mockResolvedValue({ status: "azurno" });
    m.getKorekcija.mockResolvedValue({
      predlog: { id: 4, delta: 100, razlog: "Težina opada brže od cilja.", dnevni_cilj_pre: 2000, dnevni_cilj_posle: 2100 },
      korekcija: 0,
    });
    m.odgovoriKorekcija.mockResolvedValue({ predlog: null, korekcija: 100 });
    const onChanged = jest.fn();
    await render(<NedeljaIKorekcija onChanged={onChanged} />);
    expect(await screen.findByText("2000 → 2100 kcal (+100)")).toBeTruthy();
    await fireEvent.press(screen.getByText("Prihvati"));
    expect(await screen.findByText("Cilj je prilagođen za +100 kcal.")).toBeTruthy();
    expect(m.odgovoriKorekcija).toHaveBeenCalledWith(4, true);
    expect(onChanged).toHaveBeenCalled();
  });
});
