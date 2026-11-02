import { useEffect, useRef } from "react";
import { Alert, AppState, View } from "react-native";
import { Stack, router, useRootNavigationState } from "expo-router";
import { useShareIntent } from "expo-share-intent";
import { useFonts } from "expo-font";
import { Nunito_500Medium } from "@expo-google-fonts/nunito/500Medium";
import { Nunito_600SemiBold } from "@expo-google-fonts/nunito/600SemiBold";
import { Nunito_700Bold } from "@expo-google-fonts/nunito/700Bold";
import { Nunito_800ExtraBold } from "@expo-google-fonts/nunito/800ExtraBold";
import { Nunito_900Black } from "@expo-google-fonts/nunito/900Black";
import { colors, fonts } from "../theme";
import NotificationHandler from "../components/NotificationHandler";
import { noviLinkIzClipboarda, zapamtiLink } from "../services/clipboardLink";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });
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

  // Dok se font ne učita, prikaži samo pozadinu (traje delić sekunde). Ako font pukne, nastavi sa sistemskim.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <>
      <NotificationHandler />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontFamily: fonts.black, fontSize: 18 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Dugme + u donjem meniju: panel odozdo preko trenutnog ekrana */}
        <Stack.Screen
          name="dodaj"
          options={{
            headerShown: false,
            presentation: "transparentModal",
            animation: "fade",
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen name="zamena" options={{ title: "Šta si pojeo?", presentation: "modal" }} />
        <Stack.Screen name="dodaj-u-plan" options={{ title: "Dodaj u jelovnik", presentation: "modal" }} />
        <Stack.Screen name="chat" options={{ title: "Pitaj asistenta" }} />
        <Stack.Screen name="moji-podaci" options={{ title: "Moji podaci i cilj" }} />
        <Stack.Screen name="recipe-result" options={{ title: "Recept" }} />
        <Stack.Screen name="recipe-manual" options={{ title: "Novi recept" }} />
        <Stack.Screen name="exercise-result" options={{ title: "Vežba" }} />
        <Stack.Screen name="exercise-manual" options={{ title: "Nova vežba" }} />
        <Stack.Screen name="weekly-report" options={{ title: "Nedeljni izveštaj" }} />
        <Stack.Screen name="settings" options={{ title: "Veza sa laptopom" }} />
        <Stack.Screen name="ingest" options={{ title: "Čitam link" }} />
        <Stack.Screen name="pregled" options={{ title: "Novo iz linkova" }} />
        <Stack.Screen name="podsetnici" options={{ title: "Podsetnici" }} />
        <Stack.Screen name="skener" options={{ title: "Skeniraj pakovanje" }} />
      </Stack>
    </>
  );
}
