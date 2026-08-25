import { Stack } from "expo-router";
import { colors } from "../theme";

export default function RootLayout() {
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
    </Stack>
  );
}