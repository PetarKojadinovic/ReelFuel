import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { getProfile, generateMealPlan, getLatestMealPlan, getDan, danAkcija } from "../services/api";
import { getTodayDate, dateForWeekday } from "../utils/date";
import { colors } from "../theme";
import { common, typography } from "../styles/common";
import { scheduleMealReminders } from "../services/notifications";

// Ključ: `${datum}-${obrok_tip}` → status iz /dan (pojeo, zamenjeno, preskoceno, ceka, procena)
type StatusMap = Record<string, string>;

const POTVRDJENO = ["pojeo", "zamenjeno", "preskoceno"];

export default function MealPlanScreen() {
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [plan, setPlan] = useState<any>(null);
  const [statusi, setStatusi] = useState<StatusMap>({});

  const today = getTodayDate();

  useEffect(() => {
    checkProfileAndPlan();
  }, []);

  const loadStatusi = async (p: any) => {
    // Učitaj stanje samo za dane ove nedelje do danas (budući dani ne mogu biti pojedeni)
    const datumi = (p?.dani ?? [])
      .map((d: any) => dateForWeekday(d.dan))
      .filter((d: string | null): d is string => !!d && d <= today);
    const rezultati = await Promise.all(datumi.map((d: string) => getDan(d).catch(() => null)));
    const map: StatusMap = {};
    rezultati.forEach((r: any) => {
      (r?.obroci ?? []).forEach((o: any) => {
        map[`${r.datum}-${o.obrok_tip}`] = o.status;
      });
    });
    setStatusi(map);
  };

  const checkProfileAndPlan = async () => {
    try {
      const profileData = await getProfile();
      if (!profileData.exists) return;
      const latestPlan = await getLatestMealPlan();
      if (latestPlan.exists) {
        setPlan(latestPlan.plan);
        await loadStatusi(latestPlan.plan);
      }
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
      await loadStatusi(data.plan);
      scheduleMealReminders({ askPermission: false }).catch(() => {});
    } catch (err) {
      Alert.alert("Greška", "Nije uspelo generisanje plana. Proveri da li imaš sačuvan profil.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckMeal = async (datum: string, mealType: string) => {
    const key = `${datum}-${mealType}`;
    if (POTVRDJENO.includes(statusi[key])) return;
    try {
      await danAkcija(datum, mealType, { akcija: "pojeo" });
      setStatusi((prev) => ({ ...prev, [key]: "pojeo" }));
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

      {plan?.dani?.map((day: any, i: number) => {
        const datum = dateForWeekday(day.dan);
        const jeDanas = datum === today;
        const buduci = !datum || datum > today;
        return (
          <View key={i} style={[common.card, styles.dayCard, jeDanas && styles.todayCard]}>
            <View style={common.rowBetween}>
              <Text style={styles.dayTitle}>
                {day.dan}
                {jeDanas ? "  · danas" : ""}
              </Text>
              <View style={common.badge}>
                <Text style={common.badgeText}>{day.ukupno_kalorija} kcal</Text>
              </View>
            </View>

            {Object.entries(day.obroci ?? {}).map(([mealType, meal]: any) => {
              const status = datum ? statusi[`${datum}-${mealType}`] : undefined;
              const isChecked = POTVRDJENO.includes(status ?? "");
              const ikona = status === "preskoceno" ? "–" : status === "zamenjeno" ? "↺" : "✓";
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
                  {!buduci && datum && (
                    <TouchableOpacity
                      style={[styles.checkBtn, isChecked && styles.checkBtnActive]}
                      onPress={() => handleCheckMeal(datum, mealType)}
                    >
                      <Text style={[styles.checkBtnText, isChecked && { color: colors.background }]}>
                        {isChecked ? ikona : ""}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dayCard: { marginBottom: 14 },
  todayCard: { borderColor: colors.primary },
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
  checkBtnText: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
});
