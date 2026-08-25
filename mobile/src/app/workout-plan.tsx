import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { getProfile, generateWorkoutPlan, getLatestWorkoutPlan, addWorkoutLogEntry, getWorkoutDayLog } from "../services/api";
import { getTodayDate } from "../utils/date";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function WorkoutPlanScreen() {
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [fullPlan, setFullPlan] = useState<any>(null);
  const [tab, setTab] = useState<"teretana" | "street_workout">("teretana");
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
      const latestPlan = await getLatestWorkoutPlan();
      if (latestPlan.exists) setFullPlan(latestPlan.plan);

      const dayLog = await getWorkoutDayLog(getTodayDate());
      const already = dayLog.unosi
        .filter((e: any) => e.izvor === "plan")
        .map((e: any) => e.naziv_vezbe);
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
      const data = await generateWorkoutPlan();
      setFullPlan(data.plan);
    } catch (err) {
      Alert.alert("Greška", "Nije uspelo generisanje plana. Proveri da li imaš sačuvan profil.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckExercise = async (dayName: string, vezba: any) => {
    if (loggedToday.includes(vezba.naziv)) return;
    try {
      await addWorkoutLogEntry({
        datum: getTodayDate(),
        naziv_vezbe: vezba.naziv,
        serije_i_ponavljanja: vezba.serije_i_ponavljanja,
        dan_treninga: dayName,
        izvor: "plan",
      });
      setLoggedToday((prev) => [...prev, vezba.naziv]);
    } catch (err) {
      Alert.alert("Greška", "Nije uspelo čekiranje vežbe");
    }
  };

  if (checkingProfile) {
    return (
      <View style={common.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const activePlan = fullPlan ? fullPlan[tab] : null;

  return (
    <ScrollView style={common.container} contentContainerStyle={{ padding: 20, paddingTop: 20 }}>
      <Text style={[typography.title, { marginBottom: 16 }]}>Plan Treninga</Text>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 20 }} />
      ) : (
        <TouchableOpacity style={[common.primaryButton, { marginBottom: 20 }]} onPress={handleGenerate}>
          <Text style={common.primaryButtonText}>
            {fullPlan ? "🔄 Generiši nova oba plana" : "✨ Generiši planove"}
          </Text>
        </TouchableOpacity>
      )}

      {fullPlan && (
        <>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === "teretana" && styles.tabBtnActive]}
              onPress={() => setTab("teretana")}
            >
              <Text style={[styles.tabBtnText, tab === "teretana" && styles.tabBtnTextActive]}>
                🏋️ Teretana
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === "street_workout" && styles.tabBtnActive]}
              onPress={() => setTab("street_workout")}
            >
              <Text style={[styles.tabBtnText, tab === "street_workout" && styles.tabBtnTextActive]}>
                🤸 Street Workout
              </Text>
            </TouchableOpacity>
          </View>

          {activePlan?.tip_splita && (
            <View style={[styles.splitCard]}>
              <Text style={typography.bodySecondary}>Izabrani split</Text>
              <Text style={styles.splitText}>{activePlan.tip_splita}</Text>
            </View>
          )}

          {activePlan?.dani.map((day: any, i: number) => (
            <View key={i} style={[common.card, styles.dayCard, day.je_odmor && styles.restCard]}>
              <View style={common.rowBetween}>
                <Text style={styles.dayTitle}>{day.dan}</Text>
                <View style={common.badge}>
                  <Text style={common.badgeText}>{day.tip_treninga}</Text>
                </View>
              </View>

              {!day.je_odmor &&
                day.vezbe.map((vezba: any, vi: number) => {
                  const isChecked = loggedToday.includes(vezba.naziv);
                  return (
                    <View key={vi} style={styles.exerciseRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.exerciseName}>{vezba.naziv}</Text>
                        <Text style={typography.bodySecondary}>
                          {vezba.grupa_misica} · {vezba.serije_i_ponavljanja}{" "}
                          {vezba.izvor === "sacuvan" ? "📌" : ""}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.checkBtn, isChecked && styles.checkBtnActive]}
                        onPress={() => handleCheckExercise(day.dan, vezba)}
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
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  tabBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabBtnText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  tabBtnTextActive: { color: "#141414" },
  splitCard: { backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 14, marginBottom: 20 },
  splitText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20, marginTop: 4 },
  dayCard: { marginBottom: 14 },
  restCard: { opacity: 0.6 },
  dayTitle: { fontSize: 18, fontWeight: "800", color: colors.textPrimary, marginBottom: 12 },
  exerciseRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  exerciseName: { fontSize: 15, color: colors.textPrimary, fontWeight: "600" },
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