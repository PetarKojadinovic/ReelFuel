import AsyncStorage from "@react-native-async-storage/async-storage";

export type MealTimes = { dorucak: string; rucak: string; vecera: string };

const KEY_TIMES = "reelfuel_meal_times";
const KEY_ON = "reelfuel_reminders_on";

export const DEFAULT_TIMES: MealTimes = { dorucak: "08:00", rucak: "13:00", vecera: "19:00" };

export function isValidHM(v: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

export async function getMealTimes(): Promise<MealTimes> {
  try {
    const raw = await AsyncStorage.getItem(KEY_TIMES);
    if (raw) {
      const p = JSON.parse(raw);
      if (isValidHM(p.dorucak) && isValidHM(p.rucak) && isValidHM(p.vecera)) return p;
    }
  } catch {}
  return DEFAULT_TIMES;
}

export async function setMealTimes(t: MealTimes) {
  await AsyncStorage.setItem(KEY_TIMES, JSON.stringify(t));
}

export async function getRemindersOn(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY_ON)) === "1";
  } catch {
    return false;
  }
}

export async function setRemindersOn(on: boolean) {
  await AsyncStorage.setItem(KEY_ON, on ? "1" : "0");
}

const KEY_AUTO_PLAN = "reelfuel_auto_plan";

export async function getAutoPlanOn(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY_AUTO_PLAN)) !== "0"; // podrazumevano uključeno
  } catch {
    return true;
  }
}

export async function setAutoPlanOn(on: boolean) {
  await AsyncStorage.setItem(KEY_AUTO_PLAN, on ? "1" : "0");
}