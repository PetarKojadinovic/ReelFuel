import { useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { generateShoppingListFromRecipe } from "../services/api";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function RecipeResultScreen() {
  const { recipe: recipeParam } = useLocalSearchParams();

  let recipe: any = {};
  try {
    recipe = JSON.parse(recipeParam as string) || {};
  } catch {
    recipe = {};
  }

  const sastojci: any[] = Array.isArray(recipe.sastojci) ? recipe.sastojci : [];
  const koraci: string[] = Array.isArray(recipe.koraci) ? recipe.koraci : [];
  const [dodajem, setDodajem] = useState(false);

  const dodajUListu = async () => {
    setDodajem(true);
    try {
      const r = await generateShoppingListFromRecipe(recipe.id);
      const dodato = r?.dodato ?? 0;
      Alert.alert(
        "Lista za kupovinu",
        dodato > 0 ? `Dodato namirnica: ${dodato}` : "Sve namirnice su već na listi.",
        [
          { text: "OK", style: "cancel" },
          { text: "Otvori listu", onPress: () => router.push("/shopping-list") },
        ]
      );
    } catch {
      Alert.alert("Greška", "Nije uspelo dodavanje u listu za kupovinu.");
    } finally {
      setDodajem(false);
    }
  };

  return (
    <ScrollView style={[common.container, { padding: 20 }]}>
      <Text style={[typography.title, { marginBottom: 20 }]}>{recipe.naziv_jela || "Recept"}</Text>

      <View style={common.card}>
        <Text style={styles.sectionTitle}>Sastojci</Text>
        {sastojci.length === 0 ? (
          <Text style={styles.empty}>Sastojci nisu izvučeni iz videa.</Text>
        ) : (
          sastojci.map((s: any, i: number) => (
            <Text key={i} style={styles.item}>
              • {s.kolicina} {s.naziv}
            </Text>
          ))
        )}
      </View>

      <View style={common.card}>
        <Text style={styles.sectionTitle}>Koraci</Text>
        {koraci.length === 0 ? (
          <Text style={styles.empty}>Koraci nisu izvučeni iz videa.</Text>
        ) : (
          koraci.map((k: string, i: number) => (
            <Text key={i} style={styles.item}>
              {i + 1}. {k}
            </Text>
          ))
        )}
      </View>

      {recipe.priblizne_kalorije && <Text style={styles.calories}>Kalorije: {recipe.priblizne_kalorije}</Text>}

      {recipe.id != null && (
        <>
          <TouchableOpacity
            style={[common.primaryButton, { marginTop: 16 }]}
            onPress={() => router.push({ pathname: "/dodaj-u-plan", params: { recipe_id: String(recipe.id) } })}
          >
            <Text style={common.primaryButtonText}>📅 Dodaj u plan</Text>
          </TouchableOpacity>
          {sastojci.length > 0 && (
            <TouchableOpacity
              style={[common.secondaryButton, { marginTop: 12, marginBottom: 40 }]}
              onPress={dodajUListu}
              disabled={dodajem}
            >
              <Text style={common.secondaryButtonText}>
                {dodajem ? "Dodajem..." : "🛒 Dodaj sastojke u listu za kupovinu"}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.primary, marginBottom: 10 },
  item: { fontSize: 15, color: colors.textPrimary, marginBottom: 6, lineHeight: 22 },
  empty: { fontSize: 14, color: colors.textSecondary },
  calories: { marginTop: 4, fontSize: 16, fontWeight: "700", color: colors.primary },
});