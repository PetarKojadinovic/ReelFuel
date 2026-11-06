import { useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { generateShoppingListFromRecipe } from "../services/api";
import { common, typography } from "../styles/common";
import { Card, DetailHeader, StatCard } from "../components/ui";

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
          { text: "Otvori listu", onPress: () => router.navigate({ pathname: "/hrana", params: { deo: "kupovina" } }) },
        ]
      );
    } catch {
      Alert.alert("Greška", "Nije uspelo dodavanje u listu za kupovinu.");
    } finally {
      setDodajem(false);
    }
  };

  return (
    <ScrollView style={common.container} contentContainerStyle={common.stackPadding}>
      <DetailHeader icon="restaurant-outline" eyebrow="Recept" title={recipe.naziv_jela || "Recept"} />

      {(recipe.priblizne_kalorije || recipe.proteini_g != null) && (
        <View style={common.row}>
          {recipe.priblizne_kalorije ? <StatCard label="Kalorije" value={recipe.priblizne_kalorije} /> : null}
          {recipe.proteini_g != null ? <StatCard label="Proteini" value={Math.round(recipe.proteini_g)} unit="g" /> : null}
        </View>
      )}

      <Card>
        <Text style={[typography.heading, { marginBottom: 10 }]}>Sastojci</Text>
        {sastojci.length === 0 ? (
          <Text style={typography.bodySecondary}>Sastojci nisu izvučeni iz videa.</Text>
        ) : (
          sastojci.map((s: any, i: number) => (
            <Text key={i} style={typography.listItem}>
              • {s.kolicina} {s.naziv}
            </Text>
          ))
        )}
      </Card>

      <Card>
        <Text style={[typography.heading, { marginBottom: 10 }]}>Koraci</Text>
        {koraci.length === 0 ? (
          <Text style={typography.bodySecondary}>Koraci nisu izvučeni iz videa.</Text>
        ) : (
          koraci.map((k: string, i: number) => (
            <Text key={i} style={typography.listItem}>
              {i + 1}. {k}
            </Text>
          ))
        )}
      </Card>

      {recipe.id != null && (
        <>
          <TouchableOpacity
            style={[common.primaryButton, { marginTop: 8 }]}
            onPress={() => router.push({ pathname: "/dodaj-u-plan", params: { recipe_id: String(recipe.id) } })}
          >
            <Text style={common.primaryButtonText}>Dodaj u jelovnik</Text>
          </TouchableOpacity>
          {sastojci.length > 0 && (
            <TouchableOpacity style={[common.secondaryButton, { marginTop: 10 }]} onPress={dodajUListu} disabled={dodajem}>
              <Text style={common.secondaryButtonText}>{dodajem ? "Dodajem..." : "Dodaj sastojke u kupovinu"}</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
}
