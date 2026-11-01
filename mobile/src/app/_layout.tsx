import { useEffect, useRef } from "react";
import { Alert, AppState } from "react-native";
import { Stack, router, useRootNavigationState } from "expo-router";
import { useShareIntent } from "expo-share-intent";
import { colors } from "../theme";
import NotificationHandler from "../components/NotificationHandler";
import { noviLinkIzClipboarda, zapamtiLink } from "../services/clipboardLink";

export default function RootLayout() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const navState = useRootNavigationState();
  const shareRef = useRef(hasShareIntent);
  shareRef.current = hasShareIntent;
  const pitamRef = useRef(false);

  useEffect(() => {
    if (!hasShareIntent || !navState?.key) return;
    const raw = shareIntent.webUrl || shareIntent.text || "";
    const match = raw.match(/https?:\/\/\S+/);
    if (match) {
      zapamtiLink(match[0]); // da ga clipboard posle ne nudi ponovo
      router.push({ pathname: "/ingest", params: { url: match[0] } });
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, navState?.key]);

  // Link iz clipboard-a: kad se aplikacija otvori ili vrati u prvi plan
  useEffect(() => {
    if (!navState?.key) return;

    const proveri = async () => {
      if (shareRef.current || pitamRef.current) return;
      const link = await noviLinkIzClipboarda();
      if (!link || shareRef.current) return;
      pitamRef.current = true;
      await zapamtiLink(link);
      Alert.alert("Link u clipboard-u", `Da obradim ovaj reel?\n\n${link}`, [
        { text: "Ne", style: "cancel", onPress: () => (pitamRef.current = false) },
        {
          text: "Obradi",
          onPress: () => {
            pitamRef.current = false;
            router.push({ pathname: "/ingest", params: { url: link } });
          },
        },
      ]);
    };

    // Android dozvoljava citanje clipboard-a tek kad prozor ima fokus -> mala pauza
    const t = setTimeout(proveri, 600);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setTimeout(proveri, 600);
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, [navState?.key]);

  return (
    <>
      <NotificationHandler />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="recipe-input" options={{ title: "Dodaj Recept" }} />
        <Stack.Screen name="recipe-result" options={{ title: "Recept" }} />
        <Stack.Screen name="recipe-manual" options={{ title: "Dodaj Recept Ručno" }} />
        <Stack.Screen name="recipes" options={{ title: "Moji Recepti" }} />
        <Stack.Screen name="meal-plan" options={{ title: "Nedeljni Plan" }} />
        <Stack.Screen name="exercise-input" options={{ title: "Dodaj Vežbu" }} />
        <Stack.Screen name="exercise-result" options={{ title: "Vežba" }} />
        <Stack.Screen name="exercises" options={{ title: "Moje Vežbe" }} />
        <Stack.Screen name="exercise-manual" options={{ title: "Dodaj Vežbu Ručno" }} />
        <Stack.Screen name="shopping-list" options={{ title: "Lista za Kupovinu" }} />
        <Stack.Screen name="weekly-report" options={{ title: "Nedeljni Izveštaj" }} />
        <Stack.Screen name="settings" options={{ title: "Podešavanja" }} />
        <Stack.Screen name="workout-plan" options={{ title: "Plan Treninga" }} />
        <Stack.Screen name="ingest" options={{ title: "Obrada linka" }} />
        <Stack.Screen name="pregled" options={{ title: "Spremno za pregled" }} />
        <Stack.Screen name="zamena" options={{ title: "Zamena obroka" }} />
        <Stack.Screen name="podsetnici" options={{ title: "Podsetnici" }} />
        <Stack.Screen name="dodaj-u-plan" options={{ title: "Dodaj u plan" }} />
        <Stack.Screen name="skener" options={{ title: "Skeniraj pakovanje" }} />
      </Stack>
    </>
  );
}
