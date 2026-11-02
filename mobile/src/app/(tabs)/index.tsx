import { useState, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  getProfile,
  getDan,
  getDayLog,
  danAkcija,
  deleteLogEntry,
  getIngestPregled,
  getLatestWorkoutPlan,
  getWorkoutDayLog,
  generateMealPlan,
} from "../../services/api";
import { getMealTimes, DEFAULT_TIMES, type MealTimes } from "../../services/mealTimes";
import { getKalendarPodesavanja } from "../../services/calendar";
import { scheduleMealReminders } from "../../services/notifications";
import { getTodayDate, formatDugiDatum, weekdayIndex } from "../../utils/date";
import { colors, fonts } from "../../theme";
import { common, typography } from "../../styles/common";
import { Icon, HighlightCard, EmptyState } from "../../components/ui";
import CalorieRing from "../../components/CalorieRing";
import NedeljaIKorekcija from "../../components/NedeljaIKorekcija";

const TIP_LABEL: Record<string, string> = { dorucak: "Doručak", rucak: "Ručak", vecera: "Večera" };
const MARKER_IZVORI = ["plan", "zamena", "preskoceno"];
const TIMEOUT_MS = 10000;

function saRokom<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), TIMEOUT_MS)),
  ]);
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
function toMin(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export default function DanasScreen() {
  const today = getTodayDate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [imaProfil, setImaProfil] = useState(true);
  const [dan, setDan] = useState<any>(null);
  const [ostali, setOstali] = useState<any[]>([]);
  const [pregled, setPregled] = useState({ spremno: 0, ukupno: 0 });
  const [trening, setTrening] = useState<any>(null);
  const [treningVreme, setTreningVreme] = useState<string | null>(null);
  const [treningUradjeno, setTreningUradjeno] = useState(0);
  const [vremena, setVremena] = useState<MealTimes>(DEFAULT_TIMES);
  const [busy, setBusy] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    try {
      const profil = await saRokom(getProfile());
      setOffline(false);
      if (!profil.exists) {
        setImaProfil(false);
        return;
      }
      setImaProfil(true);
      const [danData, logData, t] = await Promise.all([getDan(today), getDayLog(today), getMealTimes()]);
      setDan(danData);
      setVremena(t);
      setOstali((logData?.unosi ?? []).filter((e: any) => !MARKER_IZVORI.includes(e.izvor)));

      getIngestPregled()
        .then((s) => setPregled({ spremno: s.filter((x) => x.status === "gotovo").length, ukupno: s.length }))
        .catch(() => {});

      // Današnji trening iz plana (teretana ili street, kako je izabrano u Treningu)
      Promise.all([getLatestWorkoutPlan(), getKalendarPodesavanja(), getWorkoutDayLog(today)])
        .then(([wp, kal, wlog]) => {
          const idx = (new Date().getDay() + 6) % 7;
          const plan = wp?.exists ? wp.plan?.[kal.tip] : null;
          setTrening((plan?.dani ?? []).find((d: any) => weekdayIndex(d.dan) === idx) ?? null);
          setTreningVreme(kal.ukljuceno ? kal.vreme : null);
          setTreningUradjeno((wlog?.unosi ?? []).filter((e: any) => e.izvor === "plan").length);
        })
        .catch(() => {});
    } catch {
      setOffline(true);
    } finally {
      loadedOnce.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, [today]);

  // Učitaj pri svakom povratku na ekran, ali bez velikog kruga posle prvog puta
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const akcija = async (tip: string, a: "pojeo" | "preskocio") => {
    setBusy(tip);
    try {
      await danAkcija(today, tip, { akcija: a });
      await load();
    } catch {
      Alert.alert("Greška", "Nije sačuvano. Proveri vezu sa laptopom.");
    } finally {
      setBusy(null);
    }
  };

  const ponisti = (o: any) => {
    if (!o.entry_id) return;
    Alert.alert(TIP_LABEL[o.obrok_tip], "Da poništim ovaj unos?", [
      { text: "Ne", style: "cancel" },
      {
        text: "Poništi",
        onPress: async () => {
          try {
            await deleteLogEntry(o.entry_id);
            await load();
          } catch {
            Alert.alert("Greška", "Nije uspelo poništavanje.");
          }
        },
      },
    ]);
  };

  const obrisiUnos = (e: any) => {
    Alert.alert("Obriši", `Da obrišem "${e.naziv}"?`, [
      { text: "Ne", style: "cancel" },
      {
        text: "Obriši",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteLogEntry(e.id);
            setOstali((prev) => prev.filter((x) => x.id !== e.id));
            load();
          } catch {
            Alert.alert("Greška", "Nije uspelo brisanje.");
          }
        },
      },
    ]);
  };

  const napraviJelovnik = async () => {
    setBusy("plan");
    try {
      await generateMealPlan();
      scheduleMealReminders({ askPermission: false }).catch(() => {});
      await load();
    } catch {
      Alert.alert("Greška", "Pravljenje jelovnika nije uspelo. Pokušaj ponovo.");
    } finally {
      setBusy(null);
    }
  };

  if (loading && !loadedOnce.current) {
    return (
      <View style={common.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const header = (
    <View style={{ marginBottom: 18 }}>
      <Text style={[typography.bodySecondary, { fontFamily: fonts.bold }]}>{formatDugiDatum(today)}</Text>
      <Text style={typography.title}>Zdravo!</Text>
    </View>
  );

  if (offline) {
    return (
      <ScrollView style={common.container} contentContainerStyle={common.screenPadding}>
        {header}
        <EmptyState
          icon="wifi-outline"
          title="Ne mogu da dođem do laptopa"
          text="Proveri da li je server upaljen i da su telefon i laptop na istoj mreži (npr. hotspot sa telefona)."
          action="Veza sa laptopom"
          onAction={() => router.push("/settings")}
        />
        <TouchableOpacity style={[common.outlineButton, { marginTop: 4 }]} onPress={() => { setLoading(true); load(); }}>
          <Icon name="refresh" size={20} />
          <Text style={common.outlineButtonText}>Pokušaj ponovo</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (!imaProfil) {
    return (
      <ScrollView style={common.container} contentContainerStyle={common.screenPadding}>
        {header}
        <EmptyState
          icon="person-add-outline"
          title="Prvo mi reci nešto o sebi"
          text="Težina, visina i cilj — da izračunam koliko kalorija ti treba dnevno."
          action="Unesi svoje podatke"
          onAction={() => router.push("/moji-podaci")}
        />
      </ScrollView>
    );
  }

  const cilj: number | null = dan?.dnevni_cilj_kalorija ?? null;
  const ukupno: number = dan?.ukupno ?? 0;
  const ostalo = cilj != null ? cilj - ukupno : null;
  const obroci: any[] = dan?.obroci ?? [];
  const otvoreni = obroci.filter((o) => o.status === "ceka" || o.status === "procena");
  const sledeci = otvoreni[0]?.obrok_tip;
  const sada = nowMinutes();

  let poruka = "Unesi šta jedeš i ja pratim ostalo.";
  if (cilj != null) {
    if (ukupno === 0) poruka = `Danas imaš ${cilj} kcal. Krenimo!`;
    else if (ostalo! > 0) poruka = `Pojeo si ${ukupno} od ${cilj} kcal.${otvoreni.length ? ` Ostalo: ${otvoreni.map((o) => TIP_LABEL[o.obrok_tip].toLowerCase()).join(", ")}.` : ""}`;
    else poruka = `Pojeo si ${ukupno} kcal, ${-ostalo!} preko cilja. Sutra je novi dan.`;
  }

  return (
    <ScrollView
      style={common.container}
      contentContainerStyle={common.screenPadding}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      {header}

      <View style={[common.card, styles.summary]}>
        <CalorieRing progres={cilj ? ukupno / cilj : 0} vrednost={ostalo != null ? Math.max(ostalo, 0) : ukupno} oznaka={ostalo != null ? (ostalo >= 0 ? "kcal još" : "preko") : "kcal"} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[typography.heading, { fontFamily: fonts.extrabold }]}>
            {ostalo == null ? "Danas" : ostalo >= 0 ? "Ide ti dobro" : "Malo preko"}
          </Text>
          <Text style={[typography.bodySecondary, { lineHeight: 19 }]}>{poruka}</Text>
          {dan?.procena > 0 && (
            <Text style={[typography.bodySecondary, { fontSize: 12 }]}>Od toga {dan.procena} kcal pretpostavljeno (nisi potvrdio).</Text>
          )}
        </View>
      </View>

      {pregled.ukupno > 0 && (
        <HighlightCard
          broj={pregled.spremno || pregled.ukupno}
          title={pregled.spremno > 0 ? "Novi recepti i vežbe iz tvojih linkova" : "Čitam tvoje linkove..."}
          subtitle={pregled.spremno > 0 ? "Dodirni da ih sačuvaš" : "Javiću kad bude spremno"}
          onPress={() => router.push("/pregled")}
        />
      )}

      <NedeljaIKorekcija onChanged={load} />

      <Text style={typography.sectionLabel}>Obroci danas</Text>

      {!dan?.ima_plana && (
        <EmptyState
          icon="restaurant-outline"
          title="Još nemaš jelovnik"
          text="Napraviću ti jelovnik za celu nedelju po tvom cilju i tvojim receptima."
          action="Napravi jelovnik"
          onAction={napraviJelovnik}
          busy={busy === "plan"}
        />
      )}

      {obroci.map((o) => {
        const open = o.status === "ceka" || o.status === "procena";
        const vreme = vremena[o.obrok_tip as keyof MealTimes];
        const jeSada = open && o.obrok_tip === sledeci && sada >= toMin(vreme) - 30;
        const eyebrow =
          o.status === "procena" ? `${TIP_LABEL[o.obrok_tip]} · nisi potvrdio` : jeSada ? `${TIP_LABEL[o.obrok_tip]} · sada` : `${TIP_LABEL[o.obrok_tip]} · ${vreme}`;

        return (
          <View key={o.obrok_tip} style={[common.card, jeSada && styles.mealNow]}>
            <TouchableOpacity style={styles.mealRow} onPress={() => (open ? null : ponisti(o))} disabled={open} activeOpacity={0.7}>
              <StatusCircle status={o.status} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.eyebrow, (jeSada || o.status === "procena") && { color: colors.warning }]}>{eyebrow}</Text>
                <Text style={[typography.bodyStrong, o.status === "preskoceno" && styles.skipped]} numberOfLines={2}>
                  {o.naziv}
                </Text>
                {o.status === "zamenjeno" && <Text style={typography.bodySecondary}>Jeo si nešto drugo</Text>}
                {o.status === "preskoceno" && <Text style={typography.bodySecondary}>Preskočeno</Text>}
              </View>
              <Text style={styles.kcal}>{o.kalorije}</Text>
            </TouchableOpacity>

            {open && (
              <>
                <View style={[common.row, { marginTop: 12 }]}>
                  <TouchableOpacity style={[common.primaryButton, styles.flexBtn]} onPress={() => akcija(o.obrok_tip, "pojeo")} disabled={!!busy}>
                    <Text style={common.primaryButtonText}>{busy === o.obrok_tip ? "..." : "Pojeo sam"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[common.secondaryButton, styles.flexBtn]}
                    onPress={() => router.push({ pathname: "/zamena", params: { datum: today, obrok_tip: o.obrok_tip } })}
                    disabled={!!busy}
                  >
                    <Text style={common.secondaryButtonText}>Nešto drugo</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.skipLink} onPress={() => akcija(o.obrok_tip, "preskocio")} disabled={!!busy}>
                  <Text style={typography.bodySecondary}>Preskočio sam ovaj obrok</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        );
      })}

      {ostali.length > 0 && (
        <>
          <Text style={typography.sectionLabel}>Još si pojeo</Text>
          {ostali.map((e) => (
            <View key={e.id} style={[common.card, styles.mealRow]}>
              <View style={[common.checkCircle, { backgroundColor: colors.surfaceAlt }]}>
                <Icon name="add" size={20} color={colors.primary} />
              </View>
              <Text style={[typography.bodyStrong, { flex: 1 }]} numberOfLines={2}>{e.naziv}</Text>
              <Text style={styles.kcal}>{e.kalorije}</Text>
              <TouchableOpacity onPress={() => obrisiUnos(e)} accessibilityLabel={`Obriši ${e.naziv}`} style={{ padding: 6 }}>
                <Icon name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      <TouchableOpacity
        style={[common.card, styles.mealRow]}
        onPress={() => router.navigate("/trening")}
        accessibilityLabel="Otvori trening"
      >
        <View style={[styles.squareIcon]}>
          <Icon name={trening?.je_odmor ? "bed-outline" : "barbell-outline"} size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={typography.eyebrow}>
            {trening?.je_odmor ? "Trening" : `Trening${treningVreme ? ` · ${treningVreme}` : " danas"}`}
          </Text>
          <Text style={typography.bodyStrong}>
            {!trening
              ? "Napravi plan treninga"
              : trening.je_odmor
              ? "Danas je odmor"
              : `${trening.tip_treninga} · ${(trening.vezbe ?? []).length} vežbi`}
          </Text>
          {trening && !trening.je_odmor && treningUradjeno > 0 && (
            <Text style={[typography.bodySecondary, { color: colors.primary }]}>Urađeno {treningUradjeno} od {(trening.vezbe ?? []).length}</Text>
          )}
        </View>
        <Text style={styles.link}>Vidi</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatusCircle({ status }: { status: string }) {
  if (status === "pojeo" || status === "zamenjeno") {
    return (
      <View style={[common.checkCircle, { backgroundColor: colors.primary }]} accessibilityLabel={status === "pojeo" ? "Pojedeno" : "Zamenjeno"}>
        <Icon name={status === "pojeo" ? "checkmark" : "swap-horizontal"} size={22} color={colors.onPrimary} />
      </View>
    );
  }
  if (status === "preskoceno") {
    return (
      <View style={[common.checkCircle, { backgroundColor: colors.surfaceAlt }]} accessibilityLabel="Preskočeno">
        <Icon name="remove" size={22} color={colors.textSecondary} />
      </View>
    );
  }
  if (status === "procena") {
    return <View style={[common.checkCircle, styles.dashed]} accessibilityLabel="Nije potvrđeno" />;
  }
  return <View style={[common.checkCircle, styles.empty]} accessibilityLabel="Čeka" />;
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", gap: 18, padding: 18, borderRadius: 24 },
  mealRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  mealNow: { borderWidth: 2, borderColor: colors.primary },
  kcal: { fontSize: 14, color: colors.textSecondary, fontFamily: fonts.bold },
  flexBtn: { flex: 1, minHeight: 48 },
  skipLink: { alignItems: "center", paddingTop: 12, paddingBottom: 2 },
  skipped: { textDecorationLine: "line-through", color: colors.textSecondary },
  dashed: { borderWidth: 2, borderStyle: "dashed", borderColor: colors.warning },
  empty: { borderWidth: 2, borderColor: colors.border },
  squareIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" },
  link: { color: colors.primary, fontSize: 15, fontFamily: fonts.extrabold },
});
