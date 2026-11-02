import { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { getPlanSlotovi, ubaciUPlan } from "../services/api";
import { colors, fonts } from "../theme";
import { common, spacing, typography } from "../styles/common";
import { formatDanDatum, formatDatumKratko } from "../utils/date";

const TIP_LABEL: Record<string, string> = { dorucak: "Doručak", rucak: "Ručak", vecera: "Večera" };

type Slot = {
  dan_offset: number;
  dan: string;
  datum: string;
  nedelja: number; // 0 = ova, 1 = sledeća
  obrok_tip: string;
  trenutni_naziv: string;
  trenutne_kalorije: number;
  izvor?: string;
  razlika: number | null;
};

function razlikaTekst(r: number | null) {
  if (r == null) return "razlika u kalorijama nepoznata";
  if (r === 0) return "isti broj kalorija";
  return r > 0 ? `recept ima ${r} kcal više` : `recept ima ${Math.abs(r)} kcal manje`;
}

function dodajDane(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const x = new Date(y, m - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

/** Ponedeljak i nedelja za nedelju danas (0) ili sledeću (1), kao "2.–8. 11." */
function opsegNedelje(danas: string, nedelja: number): string {
  const [y, m, d] = danas.split("-").map(Number);
  const pomak = (new Date(y, m - 1, d).getDay() + 6) % 7; // pon=0
  const pon = dodajDane(danas, -pomak + 7 * nedelja);
  const ned = dodajDane(pon, 6);
  return `${formatDatumKratko(pon)} – ${formatDatumKratko(ned)}`;
}

function oznakaDana(datum: string, danas: string): string {
  if (datum === danas) return `Danas · ${formatDanDatum(datum)}`;
  if (datum === dodajDane(danas, 1)) return `Sutra · ${formatDanDatum(datum)}`;
  return formatDanDatum(datum);
}

export default function DodajUPlanScreen() {
  const { recipe_id } = useLocalSearchParams<{ recipe_id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [nedelja, setNedelja] = useState<0 | 1>(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await getPlanSlotovi(Number(recipe_id));
        setData(res);
        // Ako u ovoj nedelji nema slobodnih obroka (npr. nedelja uveče), otvori sledeću
        const slotovi: Slot[] = res?.slotovi ?? [];
        if (!slotovi.some((s) => s.nedelja === 0) && slotovi.some((s) => s.nedelja === 1)) setNedelja(1);
      } catch (e: any) {
        setError(e?.message || "Nije uspelo učitavanje");
      } finally {
        setLoading(false);
      }
    })();
  }, [recipe_id]);

  const slotovi: Slot[] = data?.slotovi ?? [];
  const danas: string = data?.danas ?? "";

  // Slotovi izabrane nedelje, grupisani po datumu (backend ih već šalje po redu)
  const dani = useMemo(() => {
    const grupe: { datum: string; obroci: Slot[] }[] = [];
    for (const s of slotovi.filter((x) => x.nedelja === nedelja)) {
      const last = grupe[grupe.length - 1];
      if (last && last.datum === s.datum) last.obroci.push(s);
      else grupe.push({ datum: s.datum, obroci: [s] });
    }
    return grupe;
  }, [slotovi, nedelja]);

  // Obrok sa najbližim brojem kalorija u izabranoj nedelji (samo kao savet)
  const najbolji = useMemo(() => {
    let best: Slot | null = null;
    for (const g of dani) {
      for (const s of g.obroci) {
        if (s.razlika == null) continue;
        if (!best || Math.abs(s.razlika) < Math.abs(best.razlika as number)) best = s;
      }
    }
    return best ? `${best.datum}-${best.obrok_tip}` : null;
  }, [dani]);

  const choose = (s: Slot) => {
    Alert.alert(
      "Zameniti obrok u planu?",
      `${formatDanDatum(s.datum)} · ${TIP_LABEL[s.obrok_tip]}\n"${s.trenutni_naziv}" → "${data.recept.naziv}"`,
      [
        { text: "Otkaži", style: "cancel" },
        {
          text: "Zameni",
          onPress: async () => {
            setSaving(true);
            try {
              const res = await ubaciUPlan(Number(recipe_id), s.dan_offset, s.obrok_tip);
              setDone({ ...res, datum: res?.datum ?? s.datum, nedelja: s.nedelja });
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
        <TouchableOpacity style={common.secondaryButton} onPress={() => router.navigate({ pathname: "/hrana", params: { deo: "recepti" } })}>
          <Text style={common.secondaryButtonText}>Nazad na recepte</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (done) {
    return (
      <View style={[common.container, { padding: 20 }]}>
        <Text style={[typography.title, { marginBottom: 12 }]}>Ubačeno u jelovnik</Text>
        <Text style={[typography.body, { marginBottom: 8 }]}>
          {formatDanDatum(done.datum)} · {TIP_LABEL[done.obrok_tip]}
        </Text>
        <Text style={[typography.body, { marginBottom: 8 }]}>
          {data.recept.naziv} ({done.kalorije} kcal)
        </Text>
        {done.kalorije_nepoznate && (
          <Text style={[typography.bodySecondary, { marginBottom: 8 }]}>
            Recept nema upisane kalorije, pa je zadržan broj kalorija prethodnog obroka.
          </Text>
        )}
        {done.nedelja === 1 && (
          <Text style={[typography.bodySecondary, { marginBottom: 8 }]}>
            Kad se u ponedeljak napravi plan za tu nedelju, ovaj obrok ostaje na svom mestu.
          </Text>
        )}
        <Text style={[typography.bodySecondary, { marginBottom: 20 }]}>
          Lista za kupovinu se ne menja sama. Regeneriši je ako ti treba.
        </Text>
        <TouchableOpacity style={[common.secondaryButton, { marginBottom: 10 }]} onPress={() => router.navigate({ pathname: "/hrana", params: { deo: "kupovina" } })}>
          <Text style={common.secondaryButtonText}>Lista za kupovinu</Text>
        </TouchableOpacity>
        <TouchableOpacity style={common.primaryButton} onPress={() => router.navigate({ pathname: "/hrana", params: { deo: "recepti" } })}>
          <Text style={common.primaryButtonText}>Gotovo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={common.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={[typography.title, { marginBottom: 8 }]}>Dodaj u plan</Text>
      <Text style={[typography.body, { marginBottom: 4 }]}>{data.recept.naziv}</Text>
      <Text style={[typography.bodySecondary, { marginBottom: 16 }]}>
        {data.recept.kalorije != null ? `${data.recept.kalorije} kcal` : "Kalorije recepta nisu upisane"}. Izaberi
        dan i obrok koji ovaj recept menja.
      </Text>

      <View style={common.tabRow}>
        {([0, 1] as const).map((n) => (
          <TouchableOpacity
            key={n}
            style={[common.tabBtn, nedelja === n && common.tabBtnActive]}
            onPress={() => setNedelja(n)}
          >
            <Text style={[common.tabBtnText, nedelja === n && common.tabBtnTextActive]}>
              {n === 0 ? "Ova nedelja" : "Sledeća nedelja"}
            </Text>
            {!!danas && (
              <Text style={[styles.tabDatum, nedelja === n && common.tabBtnTextActive]}>{opsegNedelje(danas, n)}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {nedelja === 1 && dani.length > 0 && (
        <Text style={[typography.bodySecondary, { marginBottom: spacing.md }]}>
          Plan za sledeću nedelju pravi se u ponedeljak. Recept koji ubaciš ostaje na tom mestu, a ostali obroci
          mogu da se promene.
        </Text>
      )}

      {dani.length === 0 && (
        <Text style={typography.bodySecondary}>
          {nedelja === 0 ? "Nema više slobodnih obroka u ovoj nedelji." : "Nema slobodnih obroka u sledećoj nedelji."}
        </Text>
      )}

      {dani.map((g) => (
        <View key={g.datum} style={{ marginBottom: spacing.md }}>
          <Text style={[styles.danNaslov, g.datum === danas && { color: colors.primary }]}>
            {oznakaDana(g.datum, danas)}
          </Text>
          {g.obroci.map((s) => {
            const key = `${s.datum}-${s.obrok_tip}`;
            return (
              <TouchableOpacity key={key} style={common.card} onPress={() => choose(s)} disabled={saving}>
                <View style={common.rowBetween}>
                  <Text style={styles.tip}>{TIP_LABEL[s.obrok_tip]}</Text>
                  {key === najbolji && (
                    <View style={common.badge}>
                      <Text style={common.badgeText}>najbliže kalorijama</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.current}>
                  Sada: {s.trenutni_naziv} ({s.trenutne_kalorije} kcal){s.izvor === "sacuvan" ? " 📌" : ""}
                </Text>
                <Text style={typography.bodySecondary}>{razlikaTekst(s.razlika)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {slotovi.some((s) => s.izvor === "sacuvan") && (
        <Text style={[typography.bodySecondary, { marginBottom: spacing.md }]}>📌 = već ubačen tvoj recept</Text>
      )}

      <TouchableOpacity style={{ marginTop: 4, alignItems: "center" }} onPress={() => router.navigate({ pathname: "/hrana", params: { deo: "recepti" } })}>
        <Text style={typography.bodySecondary}>Preskoči, samo sačuvaj recept</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabDatum: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  danNaslov: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.textPrimary, marginBottom: 8 },
  tip: { fontSize: 12, color: colors.secondary, fontFamily: fonts.bold, textTransform: "uppercase" },
  current: { fontSize: 15, color: colors.textPrimary, marginVertical: 4 },
});
