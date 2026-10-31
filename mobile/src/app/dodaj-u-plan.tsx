import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { getPlanSlotovi, ubaciUPlan } from "../services/api";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

const TIP_LABEL: Record<string, string> = { dorucak: "Doručak", rucak: "Ručak", vecera: "Večera" };

function razlikaTekst(r: number | null) {
  if (r == null) return "razlika nepoznata";
  if (r === 0) return "isti broj kalorija";
  return r > 0 ? `${r} kcal više` : `${Math.abs(r)} kcal manje`;
}

export default function DodajUPlanScreen() {
  const { recipe_id } = useLocalSearchParams<{ recipe_id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setData(await getPlanSlotovi(Number(recipe_id)));
      } catch (e: any) {
        setError(e?.message || "Nije uspelo učitavanje");
      } finally {
        setLoading(false);
      }
    })();
  }, [recipe_id]);

  const choose = (s: any) => {
    Alert.alert(
      "Zameniti obrok u planu?",
      `${s.dan} · ${TIP_LABEL[s.obrok_tip]}\n"${s.trenutni_naziv}" → "${data.recept.naziv}"`,
      [
        { text: "Otkaži", style: "cancel" },
        {
          text: "Zameni",
          onPress: async () => {
            setSaving(true);
            try {
              setDone({ ...(await ubaciUPlan(Number(recipe_id), s.dan_offset, s.obrok_tip)), dan: s.dan });
            } catch (e: any) {
              Alert.alert("Greška", e?.message || "Nije uspelo.");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={common.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[common.centered, { padding: 20 }]}>
        <Text style={[typography.body, { textAlign: "center", marginBottom: 20 }]}>{error}</Text>
        <TouchableOpacity style={common.secondaryButton} onPress={() => router.replace("/recipes")}>
          <Text style={common.secondaryButtonText}>Nazad na recepte</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (done) {
    return (
      <View style={[common.container, { padding: 20 }]}>
        <Text style={[typography.title, { marginBottom: 12 }]}>Ubačeno u plan ✓</Text>
        <Text style={[typography.body, { marginBottom: 8 }]}>
          {done.dan} · {TIP_LABEL[done.obrok_tip]}: {data.recept.naziv} ({done.kalorije} kcal)
        </Text>
        {done.kalorije_nepoznate && (
          <Text style={[typography.bodySecondary, { marginBottom: 8 }]}>
            Recept nema upisane kalorije, pa je zadržan broj kalorija prethodnog obroka.
          </Text>
        )}
        <Text style={[typography.bodySecondary, { marginBottom: 20 }]}>
          Lista za kupovinu se ne menja sama. Regeneriši je ako ti treba.
        </Text>
        <TouchableOpacity style={[common.secondaryButton, { marginBottom: 10 }]} onPress={() => router.replace("/shopping-list")}>
          <Text style={common.secondaryButtonText}>🛒 Lista za kupovinu</Text>
        </TouchableOpacity>
        <TouchableOpacity style={common.primaryButton} onPress={() => router.replace("/recipes")}>
          <Text style={common.primaryButtonText}>Gotovo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={common.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={[typography.title, { marginBottom: 8 }]}>Dodaj u plan</Text>
      <Text style={[typography.body, { marginBottom: 4 }]}>{data.recept.naziv}</Text>
      <Text style={[typography.bodySecondary, { marginBottom: 20 }]}>
        {data.recept.kalorije != null ? `${data.recept.kalorije} kcal` : "Kalorije recepta nisu upisane"}. Izaberi koji
        obrok menjaš, poređano po tome koliko se kalorije poklapaju.
      </Text>

      {data.slotovi.length === 0 && (
        <Text style={typography.bodySecondary}>Nema slobodnih obroka u narednih 7 dana.</Text>
      )}
      {data.slotovi.map((s: any) => (
        <TouchableOpacity key={`${s.dan_offset}-${s.obrok_tip}`} style={common.card} onPress={() => choose(s)} disabled={saving}>
          <Text style={styles.slot}>
            {s.dan} · {TIP_LABEL[s.obrok_tip]}
          </Text>
          <Text style={styles.current}>
            Sada: {s.trenutni_naziv} ({s.trenutne_kalorije} kcal){s.izvor === "sacuvan" ? " 📌" : ""}
          </Text>
          <Text style={typography.bodySecondary}>Recept ima {razlikaTekst(s.razlika)}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={{ marginTop: 12, alignItems: "center" }} onPress={() => router.replace("/recipes")}>
        <Text style={typography.bodySecondary}>Preskoči, samo sačuvaj recept</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  slot: { fontSize: 12, color: colors.secondary, fontWeight: "700", textTransform: "uppercase" },
  current: { fontSize: 15, color: colors.textPrimary, marginVertical: 4 },
});