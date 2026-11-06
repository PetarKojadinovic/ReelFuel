import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_TIMES,
  getAutoPlanOn,
  getMealTimes,
  getRemindersOn,
  isValidHM,
  setAutoPlanOn,
  setMealTimes,
  setRemindersOn,
} from "../src/services/mealTimes";
import { izvuciPodrzanLink } from "../src/services/clipboardLink";

beforeEach(() => AsyncStorage.clear());

describe("vreme obroka", () => {
  test("format HH:MM", () => {
    expect(isValidHM("08:00")).toBe(true);
    expect(isValidHM("23:59")).toBe(true);
    expect(isValidHM("24:00")).toBe(false);
    expect(isValidHM("8:00")).toBe(false);
    expect(isValidHM("08:60")).toBe(false);
  });

  test("čuva i čita vremena", async () => {
    await setMealTimes({ dorucak: "07:30", rucak: "12:00", vecera: "20:00" });
    expect(await getMealTimes()).toEqual({ dorucak: "07:30", rucak: "12:00", vecera: "20:00" });
  });

  test("pokvaren zapis vraća podrazumevana vremena", async () => {
    await AsyncStorage.setItem("reelfuel_meal_times", "{nije json");
    expect(await getMealTimes()).toEqual(DEFAULT_TIMES);
    await AsyncStorage.setItem("reelfuel_meal_times", JSON.stringify({ dorucak: "99:99", rucak: "12:00", vecera: "20:00" }));
    expect(await getMealTimes()).toEqual(DEFAULT_TIMES);
  });

  test("podsetnici su podrazumevano isključeni, nov plan uključen", async () => {
    expect(await getRemindersOn()).toBe(false);
    expect(await getAutoPlanOn()).toBe(true);
    await setRemindersOn(true);
    await setAutoPlanOn(false);
    expect(await getRemindersOn()).toBe(true);
    expect(await getAutoPlanOn()).toBe(false);
  });
});

describe("link iz clipboard-a", () => {
  test("prepoznaje Instagram i TikTok link u tekstu", () => {
    const ig = "https://www.instagram.com/reel/Ddt0UMKsi7B/?utm_source=ig_web_copy_link";
    expect(izvuciPodrzanLink(`Pogledaj ovo: ${ig} super je`)).toBe(ig);
    expect(izvuciPodrzanLink("https://vm.tiktok.com/ZMabc/")).toBe("https://vm.tiktok.com/ZMabc/");
  });

  test("preskače nedozvoljene i lažne domene", () => {
    expect(izvuciPodrzanLink("https://instagram.com.evil.example/reel/1")).toBeNull();
    expect(izvuciPodrzanLink("https://notinstagram.com/reel/1")).toBeNull();
    expect(izvuciPodrzanLink("https://youtube.com/watch?v=1")).toBeNull();
    expect(izvuciPodrzanLink("nema linka")).toBeNull();
  });

  test("bira prvi dozvoljen link kad ih ima više", () => {
    expect(izvuciPodrzanLink("https://google.com https://www.tiktok.com/@a/video/1")).toBe("https://www.tiktok.com/@a/video/1");
  });
});
