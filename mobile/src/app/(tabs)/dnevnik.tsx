import { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { getDayLog, addLogEntry, deleteLogEntry, getWorkoutDayLog, addWorkoutLogEntry, deleteWorkoutLogEntry } from "../../services/api";
import { getTodayDate } from "../../utils/date";
import { colors } from "../../theme";
import { common, typography } from "../../styles/common";

export default function DnevnikScreen() {
  const [tab, setTab] = useState<"ishrana" | "trening">("ishrana");
  const [log, setLog] = useState<any>(null);
  const [workoutLog, setWorkoutLog] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [naziv, setNaziv] = useState("");
  const [kalorije, setKalorije] = useState("");
  const [vezbaNaziv, setVezbaNaziv] = useState("");
  const [vezbaSerije, setVezbaSerije] = useState("");
  const [saving, setSaving] = useState(false);

  const today = getTodayDate();

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const load = async () => {
    try {
      const [foodData, workoutData] = await Promise.all([getDayLog(today), getWorkoutDayLog(today)]);
      setLog(foodData);
      setWorkoutLog(workoutData);
    } catch (err) {
      // tiho
    } finally {
      setLoading(false);
    }
  };

  const handleAddFood = async () => {
    if (!naziv.trim() || !kalorije.trim()) {
      Alert.alert("Greška", "Unesi naziv i kalorije");
      return;
    }
    setSaving(true);
    try {
      await addLogEntry({ datum: today, naziv: naziv.trim(), kalorije: parseInt(kalorije), izvor: "slobodan" });
      setNaziv("");
      setKalorije("");
      await load();
    } catch (err) {
      Alert.alert("Greška", "Nije uspelo čuvanje unosa");
    } finally {
      setSaving(false);
    }
  };

  const handleAddWorkout = async () => {
    if (!vezbaNaziv.trim()) {
      Alert.alert("Greška", "Unesi naziv vežbe");
      return;
    }
    setSaving(true);
    try {
      await addWorkoutLogEntry({
        datum: today,
        naziv_vezbe: vezbaNaziv.trim(),
        serije_i_ponavljanja: vezbaSerije.trim() || undefined,
        izvor: "slobodan",
      });
      setVezbaNaziv("");
      setVezbaSerije("");
      await load();
    } catch (err) {
      Alert.alert("Greška", "Nije uspelo čuvanje vežbe");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFood = async (id: number) => {
    await deleteLogEntry(id);
    await load();
  };

  const handleDeleteWorkout = async (id: number) => {
    await deleteWorkoutLogEntry(id);
    await load();
  };

  if (loading) {
    return (
      <View style={common.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const progres = log?.dnevni_cilj_kalorija ? Math.min(log.ukupno_uneto / log.dnevni_cilj_kalorija, 1) : 0;

  return (
    <ScrollView style={common.container} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
      <Text style={typography.title}>Dnevnik</Text>
      <Text style={[typography.bodySecondary, { marginBottom: 20 }]}>{today}</Text>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "ishrana" && styles.tabBtnActive]}
          onPress={() => setTab("ishrana")}
        >
          <Text style={[styles.tabBtnText, tab === "ishrana" && styles.tabBtnTextActive]}>🍽️ Ishrana</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "trening" && styles.tabBtnActive]}
          onPress={() => setTab("trening")}
        >
          <Text style={[styles.tabBtnText, tab === "trening" && styles.tabBtnTextActive]}>💪 Trening</Text>
        </TouchableOpacity>
      </View>

      {tab === "ishrana" ? (
        <>
          {log?.dnevni_cilj_kalorija && (
            <View style={[common.card, styles.summaryCard]}>
              <View style={styles.ringInner}>
                <Text style={styles.ringValue}>{log.ukupno_uneto}</Text>
                <Text style={typography.bodySecondary}>/ {log.dnevni_cilj_kalorija} kcal</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progres * 100}%` }]} />
              </View>
            </View>
          )}

          <Text style={typography.sectionLabel}>Obroci</Text>
          {log?.unosi.length === 0 && <Text style={styles.emptyTextSmall}>Još ništa nije uneto danas.</Text>}
          {log?.unosi.map((entry: any) => (
            <View key={entry.id} style={[common.card, styles.entryRow]}>
              <View style={styles.entryDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.entryName}>{entry.naziv}</Text>
                <Text style={typography.bodySecondary}>
                  {entry.kalorije} kcal {entry.obrok_tip ? `· ${entry.obrok_tip}` : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteFood(entry.id)}>
                <Text style={common.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.addSection}>
            <Text style={typography.sectionLabel}>Dodaj šta si pojeo</Text>
            <TextInput
              style={common.input}
              value={naziv}
              onChangeText={setNaziv}
              placeholder="Naziv obroka"
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              style={common.input}
              value={kalorije}
              onChangeText={setKalorije}
              placeholder="Kalorije"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />
            <TouchableOpacity style={common.primaryButton} onPress={handleAddFood} disabled={saving}>
              <Text style={common.primaryButtonText}>{saving ? "Čuvam..." : "+ Dodaj obrok"}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={typography.sectionLabel}>Odrađene vežbe danas</Text>
          {(!workoutLog || workoutLog.unosi.length === 0) && (
            <Text style={styles.emptyTextSmall}>Još ništa nije odrađeno danas.</Text>
          )}
          {workoutLog?.unosi.map((entry: any) => (
            <View key={entry.id} style={[common.card, styles.entryRow]}>
              <View style={styles.entryDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.entryName}>{entry.naziv_vezbe}</Text>
                <Text style={typography.bodySecondary}>
                  {entry.serije_i_ponavljanja || ""} {entry.dan_treninga ? `· ${entry.dan_treninga}` : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteWorkout(entry.id)}>
                <Text style={common.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.addSection}>
            <Text style={typography.sectionLabel}>Dodaj odrađenu vežbu</Text>
            <TextInput
              style={common.input}
              value={vezbaNaziv}
              onChangeText={setVezbaNaziv}
              placeholder="Naziv vežbe"
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              style={common.input}
              value={vezbaSerije}
              onChangeText={setVezbaSerije}
              placeholder="Serije i ponavljanja (opciono)"
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity style={common.primaryButton} onPress={handleAddWorkout} disabled={saving}>
              <Text style={common.primaryButtonText}>{saving ? "Čuvam..." : "+ Dodaj vežbu"}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
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
  tabBtnText: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
  tabBtnTextActive: { color: "#141414" },
  summaryCard: { alignItems: "center", padding: 20, marginBottom: 24 },
  ringInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 6,
    borderColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  ringValue: { fontSize: 24, fontWeight: "800", color: colors.textPrimary },
  progressTrack: { width: "100%", height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 4 },
  emptyTextSmall: { color: colors.textSecondary, fontSize: 13, marginBottom: 10 },
  entryRow: { flexDirection: "row", alignItems: "center" },
  entryDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 12 },
  entryName: { fontSize: 15, color: colors.textPrimary, fontWeight: "600" },
  addSection: { marginTop: 10, marginBottom: 40 },
});