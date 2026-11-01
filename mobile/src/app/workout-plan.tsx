import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Platform } from "react-native";
import { getProfile, generateWorkoutPlan, getLatestWorkoutPlan, addWorkoutLogEntry, getWorkoutDayLog } from "../services/api";
import { getTodayDate } from "../utils/date";
import { isValidHM } from "../services/mealTimes";
import {
  getKalendarPodesavanja,
  setKalendarPodesavanja,
  upisiTreninge,
  ukloniTreninge,
  listaKalendara,
  opisKalendara,
  kalendarDostupan,
  type KalendarPodesavanja,
  type KalendarOpcija,
} from "../services/calendar";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function WorkoutPlanScreen() {
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [fullPlan, setFullPlan] = useState<any>(null);
  const [tab, setTab] = useState<"teretana" | "street_workout">("teretana");
  const [loggedToday, setLoggedToday] = useState<string[]>([]);
  const [kal, setKal] = useState<KalendarPodesavanja | null>(null);
  const [kalVreme, setKalVreme] = useState("18:00");
  const [kalRadi, setKalRadi] = useState(false);
  const [kalNaziv, setKalNaziv] = useState<string | null>(null);
  const [kalOpcije, setKalOpcije] = useState<KalendarOpcija[] | null>(null);

  useEffect(() => {
    checkProfileAndPlan();
    getKalendarPodesavanja().then((p) => {
      setKal(p);
      setKalVreme(p.vreme);
      setTab(p.tip);
      // Naziv kalendara prikazujemo samo ako je dozvola već data (ne pitamo za dozvolu pri otvaranju ekrana)
      if (p.ukljuceno && kalendarDostupan()) opisKalendara(p).then(setKalNaziv);
    });
  }, []);

  const otvoriIzborKalendara = async () => {
    try {
      const lista = await listaKalendara();
      if (!lista.length) {
        Alert.alert("Kalendar", "Na telefonu nema kalendara u koji se može upisivati. Dodaj Google nalog u Podešavanjima telefona.");
        return;
      }
      setKalOpcije(lista);
    } catch (e: any) {
      Alert.alert("Kalendar", e?.message || "Ne mogu da pročitam listu kalendara.");
    }
  };

  const izaberiKalendar = async (o: KalendarOpcija) => {
    const p = { ...(kal ?? (await getKalendarPodesavanja())), kalendarId: o.id } as KalendarPodesavanja;
    await setKalendarPodesavanja(p);
    setKal(p);
    setKalNaziv(o.nalog && o.nalog !== o.naziv ? `${o.naziv} (${o.nalog})` : o.naziv);
    setKalOpcije(null);
  };

  const handleUpisiUKalendar = async (plan = fullPlan, tiho = false) => {
    if (!isValidHM(kalVreme)) {
      Alert.alert("Greška", "Vreme treninga upiši kao HH:MM, npr. 18:00");
      return;
    }
    const p: KalendarPodesavanja = { ...(kal ?? { trajanjeMin: 60 }), ukljuceno: true, vreme: kalVreme, tip: tab } as KalendarPodesavanja;
    setKalRadi(true);
    try {
      const { broj, kalendar } = await upisiTreninge(plan, p);
      await setKalendarPodesavanja(p);
      setKal(p);
      opisKalendara(p).then(setKalNaziv);
      if (!tiho) {
        Alert.alert(
          "Upisano u kalendar",
          broj > 0
            ? `${broj} treninga za narednih 7 dana u ${kalVreme}, u kalendar "${kalendar}". Podsetnik 30 min pre. Google kalendaru ponekad treba minut da se sinhronizuje.`
            : "Nema treninga u narednih 7 dana (svi su dani odmora ili je vreme prošlo)."
        );
      }
    } catch (e: any) {
      Alert.alert("Kalendar", e?.message || "Upis u kalendar nije uspeo.");
    } finally {
      setKalRadi(false);
    }
  };

  const handleUkloniIzKalendara = async () => {
    setKalRadi(true);
    try {
      await ukloniTreninge(kal as KalendarPodesavanja);
      const p = { ...(kal as KalendarPodesavanja), ukljuceno: false };
      await setKalendarPodesavanja(p);
      setKal(p);
      Alert.alert("Uklonjeno", "Budući ReelFuel treninzi su obrisani iz kalendara.");
    } catch (e: any) {
      Alert.alert("Kalendar", e?.message || "Brisanje nije uspelo.");
    } finally {
      setKalRadi(false);
    }
  };

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
      // Ako je kalendar uključen, novi plan odmah zameni stare treninge u kalendaru
      if (kal?.ukljuceno && Platform.OS !== "web") {
        await handleUpisiUKalendar(data.plan, true);
      }
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

          {Platform.OS !== "web" && (
            <View style={[common.card, { marginBottom: 20 }]}>
              <Text style={[typography.body, { fontWeight: "800" }]}>📅 Kalendar</Text>
              <Text style={[typography.bodySecondary, { marginTop: 4, marginBottom: 12 }]}>
                Upisuje {tab === "teretana" ? "teretana" : "street workout"} treninge za narednih 7 dana u tvoj Google
                kalendar. Aplikacija menja samo svoje treninge (oznaka #ReelFuel), tvoje ostale obaveze ne dira.
                {kal?.ukljuceno ? " Uključeno — novi plan se sam upisuje." : ""}
              </Text>
              <View style={[common.rowBetween, { marginBottom: 12 }]}>
                <Text style={[typography.bodySecondary, { flex: 1 }]} numberOfLines={2}>
                  Kalendar: {kalNaziv ?? "glavni Google kalendar"}
                </Text>
                <TouchableOpacity onPress={otvoriIzborKalendara} disabled={kalRadi}>
                  <Text style={[typography.bodySecondary, { color: colors.primary, fontWeight: "700" }]}>Promeni</Text>
                </TouchableOpacity>
              </View>
              {kalOpcije && (
                <View style={{ marginBottom: 12, gap: 8 }}>
                  {kalOpcije.map((o) => (
                    <TouchableOpacity
                      key={o.id}
                      style={[styles.kalOpcija, kal?.kalendarId === o.id && styles.kalOpcijaActive]}
                      onPress={() => izaberiKalendar(o)}
                    >
                      <Text style={typography.body}>{o.naziv}</Text>
                      <Text style={typography.bodySecondary}>
                        {o.nalog}
                        {o.google ? " · Google" : " · samo na telefonu"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={[common.rowBetween, { gap: 10 }]}>
                <Text style={typography.bodySecondary}>Vreme treninga</Text>
                <TextInput
                  style={[common.input, { marginBottom: 0, width: 100, textAlign: "center" }]}
                  value={kalVreme}
                  onChangeText={setKalVreme}
                  placeholder="18:00"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={5}
                />
              </View>
              <TouchableOpacity
                style={[common.primaryButton, { marginTop: 12 }]}
                onPress={() => handleUpisiUKalendar()}
                disabled={kalRadi}
              >
                <Text style={common.primaryButtonText}>
                  {kalRadi ? "Radim..." : kal?.ukljuceno ? "🔄 Osveži kalendar" : "📅 Upiši treninge u kalendar"}
                </Text>
              </TouchableOpacity>
              {kal?.ukljuceno && (
                <TouchableOpacity style={{ marginTop: 12, alignItems: "center" }} onPress={handleUkloniIzKalendara} disabled={kalRadi}>
                  <Text style={typography.bodySecondary}>Ukloni treninge iz kalendara</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

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
  kalOpcija: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  kalOpcijaActive: { borderColor: colors.primary },
});