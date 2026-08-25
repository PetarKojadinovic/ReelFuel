import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { getProfile, generateMealPlan, getLatestMealPlan, addLogEntry, getDayLog } from "../services/api";
import { getTodayDate } from "../utils/date";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function MealPlanScreen() {
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [plan, setPlan] = useState<any>(null);
  const [loggedToday, setLoggedToday] = useState<string[]>([]);

  useEffect(() => {
    checkProfileAndPlan();
  }, []);

  const checkProfileAndPlan = async () => {
    try {
      const profileData = await getProfile();
      if (!profileData.exists) {
        setCheckingProfile(false);
        return;
      }
      const latestPlan = await getLatestMealPlan();
      if (latestPlan.exists) setPlan(latestPlan.plan);

      const dayLog = await getDayLog(getTodayDate());
      const already = dayLog.unosi
        .filter((e: any) => e.izvor === "plan")
        .map((e: any) => `${e.obrok_tip}-${e.naziv}`);
      setLoggedToday(already);
    } catch (err) {
      // tiho
    } finally {
      setCheckingProfile(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await generateMealPlan();
      setPlan(data.plan);
    } catch (err) {
      Alert.alert("Greška", "Nije uspelo generisanje plana. Proveri da li imaš sačuvan profil.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckMeal = async (mealType: string, meal: any) => {
    const key = `${mealType}-${meal.naziv}`;
    if (loggedToday.includes(key)) return;
    try {
      await addLogEntry({
        datum: getTodayDate(),
        naziv: meal.naziv,
        kalorije: meal.kalorije,
        obrok_tip: mealType,
        izvor: "plan",
      });
      setLoggedToday((prev) => [...prev, key]);
    } catch (err) {
      Alert.alert("Greška", "Nije uspelo čekiranje obroka");
    }
  };

  if (checkingProfile) {
    return (
      <View style={common.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={common.container} contentContainerStyle={{ padding: 20, paddingTop: 20 }}>
      <Text style={[typography.title, { marginBottom: 20 }]}>Nedeljni Plan</Text>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 20 }} />
      ) : (
        <TouchableOpacity style={[common.primaryButton, { marginBottom: 20 }]} onPress={handleGenerate}>
          <Text style={common.primaryButtonText}>
            {plan ? "🔄 Generiši novi plan" : "✨ Generiši nedeljni plan"}
          </Text>
        </TouchableOpacity>
      )}

      {plan &&
        plan.dani &&
        plan.dani.map((day: any, i: number) => (
          <View key={i} style={[common.card, styles.dayCard]}>
            <View style={common.rowBetween}>
              <Text style={styles.dayTitle}>{day.dan}</Text>
              <View style={common.badge}>
                <Text style={common.badgeText}>{day.ukupno_kalorija} kcal</Text>
              </View>
            </View>

            {Object.entries(day.obroci).map(([mealType, meal]: any) => {
              const key = `${mealType}-${meal.naziv}`;
              const isChecked = loggedToday.includes(key);
              return (
                <View key={mealType} style={styles.mealRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mealType}>
                      {mealType === "dorucak" ? "Doručak" : mealType === "rucak" ? "Ručak" : "Večera"}
                    </Text>
                    <Text style={styles.mealName}>{meal.naziv}</Text>
                    <Text style={typography.bodySecondary}>
                      {meal.kalorije} kcal {meal.izvor === "sacuvan" ? "📌" : ""}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.checkBtn, isChecked && styles.checkBtnActive]}
                    onPress={() => handleCheckMeal(mealType, meal)}
                  >
                    <Text style={[styles.checkBtnText, isChecked && { color: "#141414" }]}>
                      {isChecked ? "✓" : ""}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dayCard: { marginBottom: 14 },
  dayTitle: { fontSize: 18, fontWeight: "800", color: colors.textPrimary, marginBottom: 12 },
  mealRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  mealType: { fontSize: 12, color: colors.secondary, fontWeight: "700", textTransform: "uppercase" },
  mealName: { fontSize: 15, color: colors.textPrimary, marginTop: 2 },
  checkBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  checkBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkBtnText: { fontSize: 15, fontWeight: "700" },
});