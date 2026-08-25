import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getProfile, listRecipes, getDayLog } from "../../services/api";
import { getTodayDate } from "../../utils/date";
import { colors } from "../../theme";
import { common, typography, spacing, radius } from "../../styles/common";
import { ActivityIndicator } from "react-native";

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [dnevniCilj, setDnevniCilj] = useState<number | null>(null);
  const [uneto, setUneto] = useState(0);
  const [brojRecepata, setBrojRecepata] = useState(0);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const load = async () => {
    try {
      const [profileData, recipesData, logData] = await Promise.all([
        getProfile(),
        listRecipes(),
        getDayLog(getTodayDate()),
      ]);
      setBrojRecepata(recipesData.recipes.length);
      setUneto(logData.ukupno_uneto || 0);
      setDnevniCilj(logData.dnevni_cilj_kalorija);
    } catch (err) {
      // tiho
    } finally {
      setLoading(false);
    }
  };

  const progres = dnevniCilj ? Math.min(uneto / dnevniCilj, 1) : 0;

  if (loading) {
    return (
      <View style={common.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={common.container} contentContainerStyle={common.screenPadding}>
      <View style={{ marginBottom: spacing.xl }}>
        <Text style={styles.logo}>
          Reel<Text style={{ color: colors.primary }}>Fuel</Text>
        </Text>
        <Text style={styles.greeting}>Zdravo! 👋</Text>
      </View>

      <View style={common.card}>
        <Text style={typography.bodySecondary}>Dnevni cilj</Text>
        <Text style={styles.goalValue}>
          {uneto} <Text style={styles.goalValueMuted}>/ {dnevniCilj ?? "—"} kcal</Text>
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progres * 100}%` }]} />
        </View>
      </View>

      <View style={styles.grid}>
        <TouchableOpacity style={[common.card, styles.gridCard]} onPress={() => router.push("/recipes")}>
          <Text style={styles.gridIcon}>📖</Text>
          <Text style={typography.bodySecondary}>Moji recepti</Text>
          <Text style={styles.gridValue}>{brojRecepata}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[common.card, styles.gridCard]} onPress={() => router.push("/meal-plan")}>
          <Text style={styles.gridIcon}>📅</Text>
          <Text style={typography.bodySecondary}>Nedeljni plan</Text>
          <Text style={styles.gridValue}>7 dana</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[common.card, styles.gridCard]} onPress={() => router.push("/dnevnik")}>
          <Text style={styles.gridIcon}>📊</Text>
          <Text style={typography.bodySecondary}>Dnevnik</Text>
          <Text style={styles.gridValue}>Danas</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[common.card, styles.gridCard]} onPress={() => router.push("/recipe-input")}>
          <Text style={styles.gridIcon}>➕</Text>
          <Text style={typography.bodySecondary}>Dodaj</Text>
          <Text style={styles.gridValue}>Recept</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[common.card, styles.gridCard]} onPress={() => router.push("/exercises")}>
          <Text style={styles.gridIcon}>💪</Text>
          <Text style={typography.bodySecondary}>Vežbe</Text>
          <Text style={styles.gridValue}>Pregled</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[common.card, styles.gridCard]} onPress={() => router.push("/workout-plan")}>
          <Text style={styles.gridIcon}>🏋️</Text>
          <Text style={typography.bodySecondary}>Plan treninga</Text>
          <Text style={styles.gridValue}>Nedeljni</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[common.card, styles.gridCard]} onPress={() => router.push("/shopping-list")}>
          <Text style={styles.gridIcon}>🛒</Text>
          <Text style={typography.bodySecondary}>Lista</Text>
          <Text style={styles.gridValue}>Kupovina</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[common.card, styles.gridCard]} onPress={() => router.push("/weekly-report")}>
          <Text style={styles.gridIcon}>📈</Text>
          <Text style={typography.bodySecondary}>Izveštaj</Text>
          <Text style={styles.gridValue}>Nedeljni</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quoteCard}>
        <Text style={styles.quoteText}>"Disciplina danas, rezultat sutra."</Text>
      </View>
    </ScrollView>
  );
}

// Samo stilovi SPECIFICNI za ovaj ekran ostaju ovde - sve ostalo dolazi iz common.ts
const styles = StyleSheet.create({
  logo: { fontSize: 22, fontWeight: "800", color: colors.textPrimary },
  greeting: { fontSize: 28, fontWeight: "800", color: colors.textPrimary, marginTop: 6 },
  goalValue: { fontSize: 26, fontWeight: "800", color: colors.primary, marginTop: 6, marginBottom: 12 },
  goalValueMuted: { fontSize: 16, color: colors.textSecondary, fontWeight: "600" },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  gridCard: { width: "47%", marginBottom: 0 },
  gridIcon: { fontSize: 24, marginBottom: 8 },
  gridValue: { fontSize: 18, fontWeight: "700", color: colors.textPrimary, marginTop: 4 },
  quoteCard: { backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 16, marginBottom: 20 },
  quoteText: { fontSize: 14, color: colors.textSecondary, fontStyle: "italic", textAlign: "center" },
});