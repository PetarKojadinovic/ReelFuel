import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function RecipeResultScreen() {
  const { recipe: recipeParam } = useLocalSearchParams();
  const recipe = JSON.parse(recipeParam as string);

  return (
    <ScrollView style={[common.container, { padding: 20 }]}>
      <Text style={[typography.title, { marginBottom: 20 }]}>{recipe.naziv_jela}</Text>

      <View style={common.card}>
        <Text style={styles.sectionTitle}>Sastojci</Text>
        {recipe.sastojci.map((s: any, i: number) => (
          <Text key={i} style={styles.item}>• {s.kolicina} {s.naziv}</Text>
        ))}
      </View>

      <View style={common.card}>
        <Text style={styles.sectionTitle}>Koraci</Text>
        {recipe.koraci.map((k: string, i: number) => (
          <Text key={i} style={styles.item}>{i + 1}. {k}</Text>
        ))}
      </View>

      {recipe.priblizne_kalorije && (
        <Text style={styles.calories}>Kalorije: {recipe.priblizne_kalorije}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.primary, marginBottom: 10 },
  item: { fontSize: 15, color: colors.textPrimary, marginBottom: 6, lineHeight: 22 },
  calories: { marginTop: 4, fontSize: 16, fontWeight: "700", color: colors.primary },
});