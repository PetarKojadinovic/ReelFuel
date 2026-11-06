import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getWeeklyReport } from "../services/api";
import { colors, fonts } from "../theme";
import { common, typography } from "../styles/common";
import { Card, IconTile, Message, type IconName } from "../components/ui";

function Kartica({
  icon,
  broj,
  od,
  opis,
  poruka,
  napomena,
}: {
  icon: IconName;
  broj: string | number;
  od?: string;
  opis: string;
  poruka?: string;
  napomena?: string;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <IconTile icon={icon} />
        <View style={{ flex: 1 }}>
          <Text style={typography.bigNumber}>
            {broj}
            {od ? <Text style={styles.od}>{od}</Text> : null}
          </Text>
          <Text style={typography.bodySecondary}>{opis}</Text>
        </View>
      </View>
      {poruka ? <Text style={[typography.bodyStrong, { marginTop: 12 }]}>{poruka}</Text> : null}
      {napomena ? <Text style={[typography.note, { marginTop: 8 }]}>{napomena}</Text> : null}
    </Card>
  );
}

export default function WeeklyReportScreen() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState(false);

  const load = async () => {
    setGreska(false);
    try {
      setReport(await getWeeklyReport());
    } catch {
      setGreska(true);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  if (loading) return <Message loading />;

  if (greska) {
    return (
      <Message
        icon="cloud-offline-outline"
        iconColor={colors.warning}
        title="Ne mogu da dođem do laptopa"
        text="Proveri da li je backend pokrenut i da si na istoj mreži."
        action="Pokušaj ponovo"
        onAction={() => {
          setLoading(true);
          load();
        }}
      />
    );
  }

  if (!report?.exists) {
    return (
      <Message
        icon="person-outline"
        title="Još nema izveštaja"
        text="Unesi svoje podatke i cilj da bih mogao da pratim nedelju."
        action="Moji podaci"
        onAction={() => router.push("/moji-podaci")}
      />
    );
  }

  const { ishrana, trening, tezina, period } = report;

  const ishranaMsg =
    ishrana.dani_pogodjen_cilj >= 5
      ? "Odlična nedelja!"
      : ishrana.dani_pogodjen_cilj >= 3
      ? "Solidno, ima prostora za bolje."
      : "Sledeće nedelje možeš bolje.";

  const treningMsg =
    trening.odradjeno_dana >= trening.planirano_dana ? "Ispunio si plan treninga!" : "Još malo do punog plana.";

  return (
    <ScrollView style={common.container} contentContainerStyle={common.stackPadding}>
      <Text style={[typography.eyebrow, { marginBottom: 12 }]}>
        {period.od} — {period.do}
      </Text>

      <Kartica
        icon="restaurant-outline"
        broj={ishrana.dani_pogodjen_cilj}
        od="/7"
        opis="dana si pogodio kalorijski cilj"
        poruka={ishranaMsg}
        napomena={
          ishrana.dani_sa_unosom < 7
            ? `Uneo si podatke ${ishrana.dani_sa_unosom}/7 dana — unesi svaki dan za precizniji izveštaj.`
            : undefined
        }
      />

      <Kartica
        icon="barbell-outline"
        broj={trening.odradjeno_dana}
        od={`/${trening.planirano_dana}`}
        opis="treninga odrađeno"
        poruka={treningMsg}
      />

      {tezina.promena_kg !== null ? (
        <Kartica
          icon="scale-outline"
          broj={`${tezina.promena_kg > 0 ? "+" : ""}${tezina.promena_kg}`}
          od=" kg"
          opis="promena težine ove nedelje"
          poruka={`${tezina.pocetna} kg → ${tezina.trenutna} kg${tezina.ciljna ? ` (cilj: ${tezina.ciljna} kg)` : ""}`}
        />
      ) : (
        <Card style={[styles.card, styles.cardTop]}>
          <IconTile icon="scale-outline" color={colors.textSecondary} />
          <Text style={[typography.bodySecondary, { flex: 1 }]}>Nema dovoljno unosa težine za trend ove nedelje.</Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  od: { fontSize: 18, fontFamily: fonts.bold, color: colors.textSecondary },
});
