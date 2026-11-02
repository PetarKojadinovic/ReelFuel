import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Platform } from "react-native";
import { getProfile, generateWorkoutPlan, getLatestWorkoutPlan, addWorkoutLogEntry, getWorkoutDayLog } from "../../services/api";
import { isValidHM } from "../../services/mealTimes";
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
  type TipPlana,
} from "../../services/calendar";
import { getTodayDate, weekDays, weekdayIndex, formatDanDatum } from "../../utils/date";
import { colors, fonts } from "../../theme";
import { common, typography } from "../../styles/common";
import { Icon, DayStrip, EmptyState } from "../ui";

export default function Raspored({ refreshKey }: { refreshKey: number }) {
  const today = getTodayDate();
  const days = weekDays(today);
  const [loading, setLoading] = useState(true);
  const [imaProfil, setImaProfil] = useState(true);
  const [plan, setPlan] = useState<any>(null);
  const [tip, setTip] = useState<TipPlana>("teretana");
  const [selected, setSelected] = useState(today);
  const [uradjeno, setUradjeno] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const [kal, setKal] = useState<KalendarPodesavanja | null>(null);
  const [kalOtvoren, setKalOtvoren] = useState(false);
  const [kalVreme, setKalVreme] = useState("18:00");
  const [kalRadi, setKalRadi] = useState(false);
  const [kalNaziv, setKalNaziv] = useState<string | null>(null);
  const [kalOpcije, setKalOpcije] = useState<KalendarOpcija[] | null>(null);

  const load = useCallback(async () => {
    try {
      const [profil, k] = await Promise.all([getProfile(), getKalendarPodesavanja()]);
      setKal(k);
      setKalVreme(k.vreme);
      setTip(k.tip);
      if (k.ukljuceno && kalendarDostupan()) opisKalendara(k).then(setKalNaziv).catch(() => {});
      if (!profil.exists) {
        setImaProfil(false);
        return;
      }
      setImaProfil(true);
      const [wp, log] = await Promise.all([getLatestWorkoutPlan(), getWorkoutDayLog(today)]);
      setPlan(wp?.exists ? wp.plan : null);
      setUradjeno((log?.unosi ?? []).filter((e: any) => e.izvor === "plan").map((e: any) => e.naziv_vezbe));
    } catch {
      // tiho: Danas već pokazuje da laptop nije dostupan
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const aktivni = plan?.[tip];
  const danZa = (datum: string) => {
    const idx = weekdayIndex(days.find((d) => d.datum === datum)?.ime ?? "");
    return (aktivni?.dani ?? []).find((d: any) => weekdayIndex(d.dan) === idx);
  };

  const promeniTip = async (t: TipPlana) => {
    setTip(t);
    const p = { ...(kal ?? (await getKalendarPodesavanja())), tip: t } as KalendarPodesavanja;
    setKal(p);
    await setKalendarPodesavanja(p);
  };

  const cekiraj = async (dayName: string, vezba: any) => {
    if (uradjeno.includes(vezba.naziv)) return;
    setUradjeno((prev) => [...prev, vezba.naziv]);
    try {
      await addWorkoutLogEntry({
        datum: today,
        naziv_vezbe: vezba.naziv,
        serije_i_ponavljanja: vezba.serije_i_ponavljanja,
        dan_treninga: dayName,
        izvor: "plan",
      });
    } catch {
      setUradjeno((prev) => prev.filter((n) => n !== vezba.naziv));
      Alert.alert("Greška", "Nije sačuvano.");
    }
  };

  const zavrsio = async (day: any) => {
    for (const v of day.vezbe ?? []) {
      if (!uradjeno.includes(v.naziv)) await cekiraj(day.dan, v);
    }
  };

  const noviPlan = async () => {
    setGenerating(true);
    try {
      const data = await generateWorkoutPlan();
      setPlan(data.plan);
      if (kal?.ukljuceno && Platform.OS !== "web") await upisi(data.plan, true);
    } catch {
      Alert.alert("Greška", "Pravljenje plana nije uspelo. Pokušaj ponovo.");
    } finally {
      setGenerating(false);
    }
  };

  const upisi = async (p = plan, tiho = false) => {
    if (!isValidHM(kalVreme)) {
      Alert.alert("Vreme", "Upiši vreme kao HH:MM, npr. 18:00");
      return;
    }
    const pod = { ...(kal ?? { trajanjeMin: 60 }), ukljuceno: true, vreme: kalVreme, tip } as KalendarPodesavanja;
    setKalRadi(true);
    try {
      const { broj, kalendar } = await upisiTreninge(p, pod);
      await setKalendarPodesavanja(pod);
      setKal(pod);
      setKalOtvoren(false);
      opisKalendara(pod).then(setKalNaziv).catch(() => {});
      if (!tiho) {
        Alert.alert(
          "Upisano",
          broj > 0 ? `${broj} treninga za narednih 7 dana u ${kalVreme}, u "${kalendar}". Podsetnik 30 min pre.` : "Nema treninga u narednih 7 dana."
        );
      }
    } catch (e: any) {
      Alert.alert("Kalendar", e?.message || "Upis u kalendar nije uspeo.");
    } finally {
      setKalRadi(false);
    }
  };

  const iskljuci = async () => {
    setKalRadi(true);
    try {
      await ukloniTreninge(kal as KalendarPodesavanja);
      const p = { ...(kal as KalendarPodesavanja), ukljuceno: false };
      await setKalendarPodesavanja(p);
      setKal(p);
      setKalOtvoren(false);
    } catch (e: any) {
      Alert.alert("Kalendar", e?.message || "Brisanje nije uspelo.");
    } finally {
      setKalRadi(false);
    }
  };

  const izborKalendara = async () => {
    try {
      const lista = await listaKalendara();
      if (!lista.length) {
        Alert.alert("Kalendar", "Na telefonu nema kalendara u koji se može upisivati. Dodaj Google nalog u podešavanjima telefona.");
        return;
      }
      setKalOpcije(lista);
    } catch (e: any) {
      Alert.alert("Kalendar", e?.message || "Ne mogu da pročitam listu kalendara.");
    }
  };

  const izaberi = async (o: KalendarOpcija) => {
    const p = { ...(kal ?? (await getKalendarPodesavanja())), kalendarId: o.id } as KalendarPodesavanja;
    await setKalendarPodesavanja(p);
    setKal(p);
    setKalNaziv(o.nalog && o.nalog !== o.naziv ? `${o.naziv} (${o.nalog})` : o.naziv);
    setKalOpcije(null);
  };

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  if (!imaProfil) {
    return <EmptyState icon="person-add-outline" title="Prvo unesi svoje podatke" text="U tabu Ja → Moji podaci i cilj." />;
  }

  if (!plan) {
    return (
      <EmptyState
        icon="barbell-outline"
        title="Još nemaš plan treninga"
        text="Napraviću raspored za nedelju po tvom cilju i broju treninga, i za teretanu i za vežbanje napolju."
        action="Napravi plan"
        onAction={noviPlan}
        busy={generating}
      />
    );
  }

  const dan = danZa(selected);
  const jeDanas = selected === today;
  const brojTreninga = (aktivni?.dani ?? []).filter((d: any) => !d.je_odmor).length;
  const sveUradjeno = dan && !dan.je_odmor && (dan.vezbe ?? []).every((v: any) => uradjeno.includes(v.naziv));

  return (
    <View>
      <View style={[common.row, { marginBottom: 14 }]}>
        {(["teretana", "street_workout"] as TipPlana[]).map((t) => (
          <TouchableOpacity key={t} style={[styles.chip, tip === t && styles.chipOn]} onPress={() => promeniTip(t)}>
            <Icon name={t === "teretana" ? "barbell-outline" : "body-outline"} size={18} color={tip === t ? colors.onPrimary : colors.textSecondary} />
            <Text style={[styles.chipText, tip === t && { color: colors.onPrimary }]}>{t === "teretana" ? "Teretana" : "Napolju"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <DayStrip days={days} selected={selected} today={today} onSelect={setSelected} tacka={(d) => !!danZa(d) && !danZa(d).je_odmor} />
      <Text style={[typography.bodySecondary, { marginTop: -8, marginBottom: 14 }]}>Zelena tačka = dan za trening ({brojTreninga} puta nedeljno)</Text>

      {!dan || dan.je_odmor ? (
        <View style={[common.card, styles.restCard]}>
          <Icon name="bed-outline" size={28} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={typography.eyebrow}>{jeDanas ? "Danas" : formatDanDatum(selected)}</Text>
            <Text style={typography.bodyStrong}>Dan za odmor</Text>
          </View>
        </View>
      ) : (
        <View style={[common.card, { padding: 16, borderRadius: 22 }]}>
          <View style={[common.rowBetween, { alignItems: "flex-start" }]}>
            <View style={{ flex: 1 }}>
              <Text style={typography.eyebrow}>
                {jeDanas ? "Danas" : formatDanDatum(selected)}
                {kal?.ukljuceno ? ` · ${kal.vreme}` : ""} · {tip === "teretana" ? "teretana" : "napolju"}
              </Text>
              <Text style={[typography.heading, { fontSize: 20 }]}>{dan.tip_treninga}</Text>
            </View>
          </View>

          <View style={{ marginTop: 8 }}>
            {(dan.vezbe ?? []).map((v: any, i: number) => {
              const done = jeDanas && uradjeno.includes(v.naziv);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.vezba, i < dan.vezbe.length - 1 && styles.vezbaBorder]}
                  onPress={() => jeDanas && cekiraj(dan.dan, v)}
                  disabled={!jeDanas || done}
                  accessibilityRole={jeDanas ? "checkbox" : undefined}
                  accessibilityState={jeDanas ? { checked: done } : undefined}
                >
                  {jeDanas && (
                    <View style={[styles.check, done && styles.checkOn]}>
                      {done && <Icon name="checkmark" size={16} color={colors.onPrimary} />}
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={typography.bodyStrong}>{v.naziv}</Text>
                    {v.grupa_misica ? (
                      <Text style={typography.bodySecondary}>
                        {v.grupa_misica}
                        {v.izvor === "sacuvan" ? " · iz tvog reela" : ""}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.serije}>{v.serije_i_ponavljanja}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {jeDanas && (
            <TouchableOpacity
              style={[common.primaryButton, { marginTop: 12 }, sveUradjeno && { backgroundColor: colors.surfaceAlt }]}
              onPress={() => zavrsio(dan)}
              disabled={sveUradjeno}
            >
              <Text style={[common.primaryButtonText, sveUradjeno && { color: colors.primary }]}>
                {sveUradjeno ? "Trening završen. Bravo!" : "Završio sam trening"}
              </Text>
            </TouchableOpacity>
          )}
          {!jeDanas && <Text style={[typography.bodySecondary, { marginTop: 8 }]}>Vežbe se čekiraju na dan treninga.</Text>}
        </View>
      )}

      {Platform.OS !== "web" && (
        <View style={common.card}>
          <TouchableOpacity style={styles.kalRow} onPress={() => setKalOtvoren((o) => !o)} accessibilityRole="switch" accessibilityState={{ checked: !!kal?.ukljuceno }}>
            <Icon name="calendar-outline" size={22} />
            <View style={{ flex: 1 }}>
              <Text style={typography.bodyStrong}>Treninzi u Google kalendaru</Text>
              <Text style={typography.bodySecondary}>{kal?.ukljuceno ? `Uključeno · ${kal.vreme}` : "Isključeno"}</Text>
            </View>
            <View style={[styles.toggle, kal?.ukljuceno && styles.toggleOn]}>
              <View style={[styles.knob, kal?.ukljuceno && styles.knobOn]} />
            </View>
          </TouchableOpacity>

          {kalOtvoren && (
            <View style={{ marginTop: 14, gap: 10 }}>
              <Text style={typography.bodySecondary}>
                Upisujem treninge za narednih 7 dana, sa podsetnikom 30 min pre. Diram samo svoje treninge (oznaka #ReelFuel).
              </Text>
              <View style={common.rowBetween}>
                <Text style={typography.bodyStrong}>U koliko sati?</Text>
                <TextInput
                  style={[common.input, { marginBottom: 0, width: 100, textAlign: "center" }]}
                  value={kalVreme}
                  onChangeText={setKalVreme}
                  placeholder="18:00"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={5}
                />
              </View>
              <TouchableOpacity onPress={izborKalendara} disabled={kalRadi}>
                <Text style={typography.bodySecondary}>
                  Kalendar: {kalNaziv ?? "glavni Google kalendar"} · <Text style={{ color: colors.primary, fontFamily: fonts.extrabold }}>Promeni</Text>
                </Text>
              </TouchableOpacity>
              {kalOpcije?.map((o) => (
                <TouchableOpacity key={o.id} style={[styles.kalOpcija, kal?.kalendarId === o.id && { borderColor: colors.primary }]} onPress={() => izaberi(o)}>
                  <Text style={typography.bodyStrong}>{o.naziv}</Text>
                  <Text style={typography.bodySecondary}>
                    {o.nalog}
                    {o.google ? " · Google" : " · samo na telefonu"}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={common.primaryButton} onPress={() => upisi()} disabled={kalRadi}>
                <Text style={common.primaryButtonText}>{kalRadi ? "Radim..." : kal?.ukljuceno ? "Sačuvaj i osveži" : "Uključi"}</Text>
              </TouchableOpacity>
              {kal?.ukljuceno && (
                <TouchableOpacity style={{ alignItems: "center", padding: 8 }} onPress={iskljuci} disabled={kalRadi}>
                  <Text style={typography.bodySecondary}>Isključi i obriši treninge iz kalendara</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      <TouchableOpacity style={{ alignItems: "center", paddingVertical: 16 }} onPress={noviPlan} disabled={generating}>
        <Text style={typography.bodySecondary}>{generating ? "Pravim plan..." : "Napravi nov plan treninga"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.textSecondary },
  restCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  vezba: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  vezbaBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.border, justifyContent: "center", alignItems: "center" },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  serije: { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary },
  kalRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.surfaceAlt, padding: 3 },
  toggleOn: { backgroundColor: colors.primary },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.textSecondary },
  knobOn: { backgroundColor: colors.onPrimary, alignSelf: "flex-end" },
  kalOpcija: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
});
