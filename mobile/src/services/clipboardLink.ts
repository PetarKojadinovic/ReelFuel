/**
 * Pronalazi Instagram/TikTok link u clipboard-u kad se aplikacija otvori,
 * da korisnik ne mora da lepi link ručno.
 *
 * expo-clipboard je native modul: učitava se lenjo (requireOptionalNativeModule),
 * pa stari build bez modula ne puca — samo ne nudi link.
 * Isti link se nudi samo jednom (pamti se u AsyncStorage).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

const KEY_POSLEDNJI = "reelfuel_clipboard_poslednji";
// Isto kao backend app/core/url_guard.py (ALLOWED_HOSTS)
const DOZVOLJENI = ["instagram.com", "tiktok.com"];

function dostupno(): boolean {
  return Platform.OS !== "web" && !!requireOptionalNativeModule("ExpoClipboard");
}

export function izvuciPodrzanLink(text: string): string | null {
  const matches = text.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
  for (const m of matches) {
    try {
      const host = new URL(m).hostname.toLowerCase();
      if (DOZVOLJENI.some((d) => host === d || host.endsWith("." + d))) return m;
    } catch {
      // nije validan URL
    }
  }
  return null;
}

/** Vrati novi (još neponuđen) podržan link iz clipboard-a, ili null. */
export async function noviLinkIzClipboarda(): Promise<string | null> {
  if (!dostupno()) return null;
  try {
    const Clipboard = require("expo-clipboard");
    if (!(await Clipboard.hasStringAsync())) return null;
    const link = izvuciPodrzanLink((await Clipboard.getStringAsync()) || "");
    if (!link) return null;
    const poslednji = await AsyncStorage.getItem(KEY_POSLEDNJI);
    if (poslednji === link) return null;
    return link;
  } catch {
    return null;
  }
}

/** Zapamti link kao ponuđen (bez obzira da li ga je korisnik prihvatio). */
export async function zapamtiLink(link: string) {
  try {
    await AsyncStorage.setItem(KEY_POSLEDNJI, link);
  } catch {
    // nije kritično
  }
}
