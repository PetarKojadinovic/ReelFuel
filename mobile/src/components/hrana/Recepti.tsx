import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { router } from "expo-router";
import { listRecipes, deleteRecipe } from "../../services/api";
import { colors } from "../../theme";
import { common, typography } from "../../styles/common";
import { Icon, EmptyState } from "../ui";

export default function Recepti({ refreshKey }: { refreshKey: number }) {
  const [recipes, setRecipes] = useState<any[] | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await listRecipes();
      setRecipes(d?.recipes ?? []);
    } catch {
      setRecipes((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const obrisi = (r: any) => {
    Alert.alert("Obriši recept", `Da obrišem "${r.naziv_jela}"?`, [
      { text: "Ne", style: "cancel" },
      {
        text: "Obriši",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteRecipe(r.id);
            setRecipes((prev) => (prev ?? []).filter((x) => x.id !== r.id));
          } catch {
            Alert.alert("Greška", "Brisanje nije uspelo.");
          }
        },
      },
    ]);
  };

  if (recipes == null) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  return (
    <View>
      <View style={[common.row, { marginBottom: 16 }]}>
        <TouchableOpacity style={[common.primaryButton, styles.flex]} onPress={() => router.push("/dodaj")}>
          <Text style={common.primaryButtonText}>Iz linka</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[common.secondaryButton, styles.flex]} onPress={() => router.push("/recipe-manual")}>
          <Text style={common.secondaryButtonText}>Upiši sam</Text>
        </TouchableOpacity>
      </View>

      {recipes.length === 0 && (
        <EmptyState
          icon="book-outline"
          title="Još nemaš recepata"
          text="Podeli reel sa Instagrama ili TikToka u ReelFuel, ili nalepi link preko dugmeta +."
        />
      )}

      {recipes.map((r) => (
        <TouchableOpacity
          key={r.id}
          style={[common.card, styles.row]}
          onPress={() => router.push({ pathname: "/recipe-result", params: { recipe: JSON.stringify(r) } })}
        >
          <View style={styles.icon}>
            <Icon name="restaurant-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={typography.bodyStrong} numberOfLines={2}>{r.naziv_jela}</Text>
            {r.priblizne_kalorije || r.proteini_g != null ? (
              <Text style={typography.bodySecondary}>
                {[r.priblizne_kalorije, r.proteini_g != null ? `${Math.round(r.proteini_g)} g proteina` : null].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => obrisi(r)} style={{ padding: 8 }} accessibilityLabel={`Obriši ${r.naziv_jela}`}>
            <Icon name="trash-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" },
});
