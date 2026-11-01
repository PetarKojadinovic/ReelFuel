import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Adresa backend servera.
 *
 * Režim "auto" (podrazumevano): aplikacija se učitava sa Expo/Metro servera na laptopu
 * (npr. 192.168.1.20:8081), a backend je na ISTOM računaru na portu 8000 — pa adresu
 * izvodimo sama. Tako ništa ne treba kucati posle promene mreže/hotspota.
 * Režim "rucno": koristi adresu upisanu u Podešavanjima (npr. kad backend bude na serveru).
 */
const STORAGE_KEY = "reelfuel_api_url";
const MODE_KEY = "reelfuel_api_mode";
const BACKEND_PORT = 8000;
const DEFAULT_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

export type ApiMode = "auto" | "rucno";

let cachedUrl: string | null = null;

/** Adresa backenda izvedena iz adrese Expo servera, ili null ako je ne znamo (npr. release build). */
export function getAutoUrl(): string | null {
  let host: string | undefined;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    host = window.location.hostname;
  } else {
    const hostUri = Constants.expoConfig?.hostUri; // npr. "192.168.1.20:8081"
    host = hostUri?.split(":")[0];
  }
  if (!host) return null;
  return `http://${host}:${BACKEND_PORT}`;
}

export async function getApiMode(): Promise<ApiMode> {
  try {
    return (await AsyncStorage.getItem(MODE_KEY)) === "rucno" ? "rucno" : "auto";
  } catch {
    return "auto";
  }
}

export async function setApiMode(mode: ApiMode): Promise<void> {
  cachedUrl = null;
  await AsyncStorage.setItem(MODE_KEY, mode);
}

export async function getManualUrl(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

export async function getApiUrl(): Promise<string> {
  if (cachedUrl) return cachedUrl;
  const mode = await getApiMode();
  const auto = getAutoUrl();
  cachedUrl = mode === "auto" && auto ? auto : await getManualUrl();
  return cachedUrl;
}

/** Sačuvaj ručnu adresu i prebaci na ručni režim. */
export async function setApiUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, url);
  await setApiMode("rucno");
  cachedUrl = url;
}

export function getDefaultUrl(): string {
  return DEFAULT_URL;
}
