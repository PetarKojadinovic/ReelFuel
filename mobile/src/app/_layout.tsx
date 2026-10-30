import { useEffect } from "react";
import { Stack, router, useRootNavigationState } from "expo-router";
import { useShareIntent } from "expo-share-intent";
import { colors } from "../theme";

export default function RootLayout() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const navState = useRootNavigationState();

  useEffect(() => {
    if (!hasShareIntent || !navState?.key) return;
    const raw = shareIntent.webUrl || shareIntent.text || "";
    const match = raw.match(/https?:\/\/\S+/);
    if (match) {
      router.push({ pathname: "/ingest", params: { url: match[0] } });
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, navState?.key]);

  return (
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
    </Stack>
  );
}