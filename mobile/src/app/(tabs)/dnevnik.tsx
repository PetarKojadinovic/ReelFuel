import { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  getDan,
  getDayLog,
  danAkcija,
  addLogEntry,
  deleteLogEntry,
  getWorkoutDayLog,
  addWorkoutLogEntry,
  deleteWorkoutLogEntry,
} from "../../services/api";
import { getTodayDate } from "../../utils/date";
import { colors } from "../../theme";
import { common, typography } from "../../styles/common";

const TIP_LABEL: Record<string, string> = { dorucak: "Doručak", rucak: "Ručak", vecera: "Večera" };
const STATUS_LABEL: Record<string, string> = {
  ceka: "Čeka",
  procena: "Pretpostavljeno (procena)",
  pojeo: "Pojedeno",
  zamenjeno: "Zamenjeno",
  preskoceno: "Preskočeno",
};
const MARKER_IZVORI = ["plan", "zamena", "preskoceno"];

export default function DnevnikScreen() {
  const [tab, setTab] = useState<"ishrana" | "trening">("ishrana");
  const [dan, setDan] = useState<any>(null);
  const [log, setLog] = useState<any>(null);
  const [workoutLog, setWorkoutLog] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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
      const [danData, foodData, workoutData] = await Promise.all([
        getDan(today),
        getDayLog(today),
        getWorkoutDayLog(today),
      ]);
      setDan(danData);
      setLog(foodData);
      setWorkoutLog(workoutData);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const mealAction = async (tip: string, akcija: "pojeo" | "preskocio") => {
    try {
      await danAkcija(today, tip, { akcija });
      await load();
    } catch {
      Alert.alert("Greška", "Nije uspelo čuvanje. Proveri vezu sa serverom.");
    }
  };

  const undoMeal = async (entryId: number) => {
    try {
      await deleteLogEntry(entryId);
      await load();
    } catch {
      Alert.alert("Greška", "Nije uspelo poništavanje.");
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
    } catch {
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
    } catch {
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

  const cilj = dan?.dnevni_cilj_kalorija;
  const progres = cilj ? Math.min((dan?.ukupno || 0) / cilj, 1) : 0;
  const ostaliUnosi = (log?.unosi || []).filter((e: any) => !MARKER_IZVORI.includes(e.izvor));

  return (
    <ScrollView style={common.container} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
      <Text style={typography.title}>Dnevnik</Text>
      <Text style={[typography.bodySecondary, { marginBottom: 20 }]}>{today}</Text>

      {loadError && (
        <Text style={[typography.bodySecondary, { marginBottom: 12 }]}>
          Ne mogu da učitam podatke sa servera. Proveri adresu u Podešavanjima servera.
        </Text>
      )}

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, tab === "ishrana" && styles.tabBtnActive]} onPress={() => setTab("ishrana")}>
          <Text style={[styles.tabBtnText, tab === "ishrana" && styles.tabBtnTextActive]}>🍽️ Ishrana</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === "trening" && styles.tabBtnActive]} onPress={() => setTab("trening")}>
          <Text style={[styles.tabBtnText, tab === "trening" && styles.tabBtnTextActive]}>💪 Trening</Text>
        </TouchableOpacity>
      </View>

      {tab === "ishrana" ? (
        <>
          {cilj && (
            <View style={[common.card, styles.summaryCard]}>
              <View style={styles.ringInner}>
                <Text style={styles.ringValue}>{dan.ukupno}</Text>
                <Text style={typography.bodySecondary}>/ {cilj} kcal</Text>
              </View>
              {dan.procena > 0 && (
                <Text style={[typography.bodySecondary, { marginBottom: 12 }]}>
                  Od toga procena: {dan.procena} kcal
                </Text>
              )}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progres * 100}%` }]} />
              </View>
            </View>
          )}

          <Text style={typography.sectionLabel}>Plan za danas</Text>
          {!dan?.ima_plana && (
            <Text style={styles.emptyTextSmall}>Nema plana ishrane za danas. Generiši ga u Nedeljnom planu.</Text>
          )}
          {(dan?.obroci || []).map((o: any) => {
            const open = o.status === "ceka" || o.status === "procena";
            return (
              <View key={o.obrok_tip} style={common.card}>
                <View style={common.rowBetween}>
                  <Text style={styles.mealType}>{TIP_LABEL[o.obrok_tip]}</Text>
                  <Text style={typography.bodySecondary}>{STATUS_LABEL[o.status]}</Text>
                </View>
                <Text style={styles.entryName}>{o.naziv}</Text>
                <Text style={[typography.bodySecondary, { marginBottom: 12 }]}>{o.kalorije} kcal</Text>

                {open ? (
                  <View style={styles.btnRow}>
                    <TouchableOpacity style={[common.primaryButton, styles.smallBtn]} onPress={() => mealAction(o.obrok_tip, "pojeo")}>
                      <Text style={styles.smallBtnText}>Pojeo sam</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[common.secondaryButton, styles.smallBtn]}
                      onPress={() => router.push({ pathname: "/zamena", params: { datum: today, obrok_tip: o.obrok_tip } })}
                    >
                      <Text style={styles.smallBtnTextLight}>Zameni</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[common.secondaryButton, styles.smallBtn]} onPress={() => mealAction(o.obrok_tip, "preskocio")}>
                      <Text style={styles.smallBtnTextLight}>Preskočio</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  o.entry_id && (
                    <TouchableOpacity onPress={() => undoMeal(o.entry_id)}>
                      <Text style={typography.bodySecondary}>↩︎ Poništi</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            );
          })}

          <Text style={typography.sectionLabel}>Ostali unosi</Text>
          {ostaliUnosi.length === 0 && <Text style={styles.emptyTextSmall}>Nema dodatnih unosa.</Text>}
          {ostaliUnosi.map((entry: any) => (
            <View key={entry.id} style={[common.card, styles.entryRow]}>
              <View style={styles.entryDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.entryName}>{entry.naziv}</Text>
                <Text style={typography.bodySecondary}>{entry.kalorije} kcal</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteFood(entry.id)}>
                <Text style={common.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.addSection}>
            <Text style={typography.sectionLabel}>Dodaj šta si pojeo</Text>
            <TouchableOpacity
              style={[common.secondaryButton, { marginBottom: 12 }]}
              onPress={() => router.push({ pathname: "/zamena", params: { datum: today } })}
            >
              <Text style={common.secondaryButtonText}>📷 Slikaj obrok</Text>
            </TouchableOpacity>
            <TextInput style={common.input} value={naziv} onChangeText={setNaziv} placeholder="Naziv obroka" placeholderTextColor={colors.textSecondary} />
            <TextInput style={common.input} value={kalorije} onChangeText={setKalorije} placeholder="Kalorije" placeholderTextColor={colors.textSecondary} keyboardType="numeric" />
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
            <TextInput style={common.input} value={vezbaNaziv} onChangeText={setVezbaNaziv} placeholder="Naziv vežbe" placeholderTextColor={colors.textSecondary} />
            <TextInput style={common.input} value={vezbaSerije} onChangeText={setVezbaSerije} placeholder="Serije i ponavljanja (opciono)" placeholderTextColor={colors.textSecondary} />
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
  mealType: { fontSize: 12, color: colors.secondary, fontWeight: "700", textTransform: "uppercase" },
  btnRow: { flexDirection: "row", gap: 8 },
  smallBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12 },
  smallBtnText: { color: "#141414", fontSize: 13, fontWeight: "700", textAlign: "center" },
  smallBtnTextLight: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", textAlign: "center" },
  entryRow: { flexDirection: "row", alignItems: "center" },
  entryDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 12 },
  entryName: { fontSize: 15, color: colors.textPrimary, fontWeight: "600", marginTop: 4 },
  addSection: { marginTop: 10, marginBottom: 40 },
});