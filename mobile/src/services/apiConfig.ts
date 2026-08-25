import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "reelfuel_api_url";
const DEFAULT_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

let cachedUrl: string | null = null;

export async function getApiUrl(): Promise<string> {
  if (cachedUrl) return cachedUrl;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    cachedUrl = stored || DEFAULT_URL;
  } catch {
    cachedUrl = DEFAULT_URL;
  }
  return cachedUrl;
}

export async function setApiUrl(url: string): Promise<void> {
  cachedUrl = url;
  await AsyncStorage.setItem(STORAGE_KEY, url);
}

export function getDefaultUrl(): string {
  return DEFAULT_URL;
}