import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { getWeeklyReport } from "../services/api";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function WeeklyReportScreen() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const load = async () => {
    try {
      const data = await getWeeklyReport();
      setReport(data);
    } catch (err) {
      // tiho
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={common.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!report?.exists) {
    return (
      <View style={[common.centered, { padding: 20 }]}>
        <Text style={common.emptyText}>Podesi profil da vidiš nedeljni izveštaj.</Text>
      </View>
    );
  }

  const { ishrana, trening, tezina, period } = report;

  const ishranaMsg =
    ishrana.dani_pogodjen_cilj >= 5
      ? "Odlična nedelja! 🔥"
      : ishrana.dani_pogodjen_cilj >= 3
      ? "Solidno, ima prostora za bolje 💪"
      : "Sledeće nedelje možeš bolje 🎯";

  const treningMsg =
    trening.odradjeno_dana >= trening.planirano_dana
      ? "Ispunio si plan treninga! 🏆"
      : `Odradio ${trening.odradjeno_dana}/${trening.planirano_dana} treninga`;

  return (
    <ScrollView style={common.container} contentContainerStyle={{ padding: 20, paddingTop: 20 }}>
      <Text style={typography.title}>Nedeljni Izveštaj</Text>
      <Text style={[typography.bodySecondary, { marginBottom: 20 }]}>
        {period.od} — {period.do}
      </Text>

      <View style={[common.card, styles.card]}>
        <Text style={styles.cardIcon}>🍽️</Text>
        <Text style={styles.cardBigNumber}>
          {ishrana.dani_pogodjen_cilj}
          <Text style={styles.cardBigNumberMuted}>/7</Text>
        </Text>
        <Text style={[typography.bodySecondary, { marginTop: 4, marginBottom: 10 }]}>
          dana si pogodio kalorijski cilj
        </Text>
        <Text style={styles.cardMotivation}>{ishranaMsg}</Text>
        {ishrana.dani_sa_unosom < 7 && (
          <Text style={styles.cardNote}>
            Uneo si podatke {ishrana.dani_sa_unosom}/7 dana — unesi svaki dan za precizniji izveštaj.
          </Text>
        )}
      </View>

      <View style={[common.card, styles.card]}>
        <Text style={styles.cardIcon}>🏋️</Text>
        <Text style={styles.cardBigNumber}>
          {trening.odradjeno_dana}
          <Text style={styles.cardBigNumberMuted}>/{trening.planirano_dana}</Text>
        </Text>
        <Text style={[typography.bodySecondary, { marginTop: 4, marginBottom: 10 }]}>treninga odrađeno</Text>
        <Text style={styles.cardMotivation}>{treningMsg}</Text>
      </View>

      <View style={[common.card, styles.card]}>
        <Text style={styles.cardIcon}>⚖️</Text>
        {tezina.promena_kg !== null ? (
          <>
            <Text style={styles.cardBigNumber}>
              {tezina.promena_kg > 0 ? "+" : ""}
              {tezina.promena_kg}
              <Text style={styles.cardBigNumberMuted}> kg</Text>
            </Text>
            <Text style={[typography.bodySecondary, { marginTop: 4, marginBottom: 10 }]}>
              promena težine ove nedelje
            </Text>
            <Text style={styles.cardMotivation}>
              {tezina.pocetna}kg → {tezina.trenutna}kg
              {tezina.ciljna ? ` (cilj: ${tezina.ciljna}kg)` : ""}
            </Text>
          </>
        ) : (
          <Text style={styles.cardNote}>Nema dovoljno unosa težine za trend ove nedelje.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20 },
  cardIcon: { fontSize: 24, marginBottom: 8 },
  cardBigNumber: { fontSize: 34, fontWeight: "800", color: colors.primary },
  cardBigNumberMuted: { fontSize: 18, color: colors.textSecondary, fontWeight: "600" },
  cardMotivation: { fontSize: 15, color: colors.textPrimary, fontWeight: "600" },
  cardNote: { fontSize: 12, color: colors.textSecondary, marginTop: 8, lineHeight: 18 },
});