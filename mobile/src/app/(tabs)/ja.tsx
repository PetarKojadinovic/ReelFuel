import { useCallback, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, RefreshControl } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getProfile, getWeightSummary, addWeightEntry } from "../../services/api";
import { getRemindersOn } from "../../services/mealTimes";
import { getTodayDate } from "../../utils/date";
import { colors, fonts } from "../../theme";
import { common, typography } from "../../styles/common";
import { ScreenTitle, ListRow, EmptyState } from "../../components/ui";
import WeightChart from "../../components/WeightChart";

const CILJ_LABEL: Record<string, string> = {
  mrsavljenje: "za mršavljenje",
  dobijanje_mise: "za dobijanje mišića",
  odrzavanje: "za održavanje",
};

function fmtKg(v: number | null | undefined) {
  return v == null ? "—" : String(Math.round(v * 10) / 10).replace(".", ",");
}

export default function JaScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [veza, setVeza] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [tezina, setTezina] = useState<any>(null);
  const [podsetnici, setPodsetnici] = useState<boolean | null>(null);
  const [unos, setUnos] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    getRemindersOn().then(setPodsetnici).catch(() => {});
    try {
      const p = await getProfile();
      setVeza(true);
      setProfile(p?.exists ? p : null);
      const s = await getWeightSummary().catch(() => null);
      setTezina(s?.exists ? s : null);
    } catch {
      setVeza(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const sacuvajTezinu = async () => {
    const t = parseFloat((unos ?? "").replace(",", "."));
    if (!(t > 20 && t < 400)) {
      Alert.alert("Težina", "Upiši težinu u kilogramima, npr. 81,5");
      return;
    }
    setSaving(true);
    try {
      await addWeightEntry({ datum: getTodayDate(), tezina_kg: t });
      setUnos(null);
      await load();
    } catch {
      Alert.alert("Greška", "Nije sačuvano.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={common.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const trenutna = tezina?.trenutna_tezina ?? profile?.tezina_kg;
  const razlika = tezina ? Math.round((tezina.trenutna_tezina - tezina.pocetna_tezina) * 10) / 10 : null;
  const ciljna = tezina?.ciljna_tezina ?? profile?.ciljna_tezina_kg;

  return (
    <ScrollView
      style={common.container}
      contentContainerStyle={common.screenPadding}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <ScreenTitle title="Ja" />

      {!profile && veza !== false && (
        <EmptyState
          icon="person-add-outline"
          title="Unesi svoje podatke"
          text="Težina, visina, godine i cilj — od toga računam dnevne kalorije."
          action="Unesi podatke"
          onAction={() => router.push("/moji-podaci")}
          style={{ marginBottom: 16 }}
        />
      )}

      {profile && (
        <View style={[common.card, { padding: 16, borderRadius: 22 }]}>
          <View style={[common.rowBetween, { alignItems: "flex-start" }]}>
            <View>
              <Text style={[typography.bodySecondary, { fontFamily: fonts.extrabold }]}>Težina</Text>
              <Text style={styles.big}>
                {fmtKg(trenutna)} <Text style={styles.unit}>kg</Text>
              </Text>
              {razlika != null && razlika !== 0 && (
                <Text style={[styles.delta, { color: razlika < 0 === (profile.cilj !== "dobijanje_mise") ? colors.primary : colors.warning }]}>
                  {razlika > 0 ? "+" : "−"}
                  {fmtKg(Math.abs(razlika))} kg od početka
                </Text>
              )}
            </View>
            {unos == null && (
              <TouchableOpacity style={[common.primaryButton, styles.smallBtn]} onPress={() => setUnos("")}>
                <Text style={[common.primaryButtonText, { fontSize: 14 }]}>Upiši</Text>
              </TouchableOpacity>
            )}
          </View>

          {unos != null && (
            <View style={[common.row, { marginTop: 12 }]}>
              <TextInput
                style={[common.input, { flex: 1, marginBottom: 0 }]}
                value={unos}
                onChangeText={setUnos}
                placeholder="Današnja težina, npr. 81,5"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                autoFocus
              />
              <TouchableOpacity style={[common.primaryButton, styles.smallBtn]} onPress={sacuvajTezinu} disabled={saving}>
                <Text style={[common.primaryButtonText, { fontSize: 14 }]}>{saving ? "..." : "Sačuvaj"}</Text>
              </TouchableOpacity>
            </View>
          )}

          {tezina?.istorija?.length >= 2 ? (
            <View style={{ marginTop: 12 }}>
              <WeightChart istorija={tezina.istorija} ciljnaTezina={tezina.ciljna_tezina} />
            </View>
          ) : (
            <Text style={[typography.bodySecondary, { marginTop: 10 }]}>Upiši težinu bar dva puta da vidiš grafikon.</Text>
          )}
          {ciljna ? <Text style={[typography.bodySecondary, { marginTop: 6 }]}>Cilj: {fmtKg(ciljna)} kg</Text> : null}
        </View>
      )}

      {profile && (
        <View style={[common.row, { marginBottom: 10 }]}>
          <View style={[common.card, styles.stat]}>
            <Text style={[typography.bodySecondary, { fontFamily: fonts.extrabold }]}>Dnevni cilj</Text>
            <Text style={styles.statValue}>{profile.dnevni_cilj_kalorija ?? "—"} kcal</Text>
            <Text style={typography.bodySecondary}>{CILJ_LABEL[profile.cilj] ?? ""}</Text>
          </View>
          <View style={[common.card, styles.stat]}>
            <Text style={[typography.bodySecondary, { fontFamily: fonts.extrabold }]}>Treninga</Text>
            <Text style={styles.statValue}>{profile.broj_treninga_nedeljno ?? 4}× nedeljno</Text>
            <Text style={typography.bodySecondary}>po planu</Text>
          </View>
        </View>
      )}

      <View style={[common.card, { padding: 0, overflow: "hidden", borderRadius: 22 }]}>
        <ListRow icon="person-outline" title="Moji podaci i cilj" onPress={() => router.push("/moji-podaci")} />
        <ListRow
          icon="notifications-outline"
          title="Podsetnici za obroke"
          value={podsetnici == null ? undefined : podsetnici ? "Uključeni" : "Isključeni"}
          onPress={() => router.push("/podsetnici")}
        />
        <ListRow icon="stats-chart-outline" title="Nedeljni izveštaj" onPress={() => router.push("/weekly-report")} />
        <ListRow icon="chatbubble-ellipses-outline" title="Pitaj asistenta" onPress={() => router.push("/chat")} />
        <ListRow
          icon="wifi-outline"
          title="Veza sa laptopom"
          value={veza == null ? undefined : veza ? "Radi" : "Nema veze"}
          valueColor={veza ? colors.primary : colors.warning}
          onPress={() => router.push("/settings")}
          last
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 34, fontFamily: fonts.black, color: colors.textPrimary, lineHeight: 40 },
  unit: { fontSize: 16, color: colors.textSecondary, fontFamily: fonts.bold },
  delta: { fontSize: 14, fontFamily: fonts.extrabold },
  smallBtn: { minHeight: 44, paddingHorizontal: 16 },
  stat: { flex: 1, gap: 2, marginBottom: 0 },
  statValue: { fontSize: 20, fontFamily: fonts.black, color: colors.textPrimary },
});
