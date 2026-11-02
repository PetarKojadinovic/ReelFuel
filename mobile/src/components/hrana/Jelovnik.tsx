import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { getDan, danAkcija, generateMealPlan, ubaciUPlan, getShoppingList } from "../../services/api";
import { scheduleMealReminders } from "../../services/notifications";
import { getTodayDate, addDays, daysBetween, weekDays, formatDanDatum, formatDatumKratko } from "../../utils/date";
import { colors, fonts } from "../../theme";
import { common, typography } from "../../styles/common";
import { Icon, DayStrip, EmptyState } from "../ui";
import RecipePicker from "../RecipePicker";

const TIP_LABEL: Record<string, string> = { dorucak: "Doručak", rucak: "Ručak", vecera: "Večera" };
const POTVRDJENO = ["pojeo", "zamenjeno", "preskoceno"];

export default function Jelovnik({ onOpenKupovina, refreshKey }: { onOpenKupovina: () => void; refreshKey: number }) {
  const today = getTodayDate();
  const [nedelja, setNedelja] = useState<0 | 1>(0);
  const [selected, setSelected] = useState(today);
  const [dani, setDani] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [zamena, setZamena] = useState<{ datum: string; tip: string } | null>(null);
  const [kupovinaBroj, setKupovinaBroj] = useState<number | null>(null);

  const days = weekDays(addDays(today, 7 * nedelja));

  const load = useCallback(async () => {
    try {
      const wd = weekDays(addDays(today, 7 * nedelja));
      const res = await Promise.all(wd.map((d) => getDan(d.datum).catch(() => null)));
      const map: Record<string, any> = {};
      res.forEach((r, i) => (map[wd[i].datum] = r));
      setDani(map);
      getShoppingList()
        .then((s) => setKupovinaBroj((s?.items ?? []).filter((i: any) => !i.checked).length))
        .catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [nedelja, today]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const promeniNedelju = (n: 0 | 1) => {
    setNedelja(n);
    setLoading(true);
    setSelected(n === 0 ? today : addDays(weekDays(today)[0].datum, 7));
  };

  const pojeo = async (datum: string, tip: string) => {
    setBusy(`${datum}-${tip}`);
    try {
      await danAkcija(datum, tip, { akcija: "pojeo" });
      await load();
    } catch {
      Alert.alert("Greška", "Nije sačuvano.");
    } finally {
      setBusy(null);
    }
  };

  const zameniReceptom = async (recipe: any) => {
    if (!zamena) return;
    const z = zamena;
    setZamena(null);
    setBusy(`${z.datum}-${z.tip}`);
    try {
      await ubaciUPlan(recipe.id, daysBetween(today, z.datum), z.tip);
      await load();
    } catch (e: any) {
      Alert.alert("Greška", e?.message || "Zamena nije uspela.");
    } finally {
      setBusy(null);
    }
  };

  const noviJelovnik = (potvrdi: boolean) => {
    const run = async () => {
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
    if (!potvrdi) return run();
    Alert.alert("Novi jelovnik", "Napraviću nov jelovnik za ovu nedelju. Obroci koje si već označio ostaju zapisani.", [
      { text: "Otkaži", style: "cancel" },
      { text: "Napravi", onPress: run },
    ]);
  };

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  const imaPlana = Object.values(dani).some((d) => d?.ima_plana);
  if (!imaPlana) {
    return (
      <EmptyState
        icon="restaurant-outline"
        title="Još nemaš jelovnik"
        text="Napraviću ti jelovnik za celu nedelju po tvom cilju i tvojim receptima."
        action="Napravi jelovnik"
        onAction={() => noviJelovnik(false)}
        busy={busy === "plan"}
      />
    );
  }

  const dan = dani[selected];
  const obroci: any[] = dan?.obroci ?? [];
  const ukupno = obroci.reduce((s, o) => s + (o.kalorije || 0), 0);
  const prosao = selected < today;

  return (
    <View>
      <View style={[common.rowBetween, { marginBottom: 12 }]}>
        <Text style={typography.bodyStrong}>
          {nedelja === 0 ? "Ova nedelja" : "Sledeća nedelja"} · {formatDatumKratko(days[0].datum)}–{formatDatumKratko(days[6].datum)}
        </Text>
        <TouchableOpacity onPress={() => promeniNedelju(nedelja === 0 ? 1 : 0)} style={styles.weekBtn}>
          <Text style={styles.weekBtnText}>{nedelja === 0 ? "Sledeća" : "Ova"}</Text>
          <Icon name={nedelja === 0 ? "chevron-forward" : "chevron-back"} size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <DayStrip days={days} selected={selected} today={today} onSelect={setSelected} />

      <View style={[common.rowBetween, { marginBottom: 10 }]}>
        <Text style={typography.heading}>{selected === today ? "Danas" : formatDanDatum(selected)}</Text>
        <Text style={typography.bodySecondary}>{ukupno} kcal</Text>
      </View>

      {obroci.length === 0 && <Text style={[typography.bodySecondary, { marginBottom: 12 }]}>Za ovaj dan nema obroka u jelovniku.</Text>}

      {obroci.map((o) => {
        const key = `${selected}-${o.obrok_tip}`;
        const gotovo = POTVRDJENO.includes(o.status);
        const mozeCekirati = !gotovo && selected <= today;
        const mozeZameniti = !gotovo && !prosao;
        return (
          <View key={o.obrok_tip} style={[common.card, styles.row]}>
            <View style={{ flex: 1 }}>
              <Text style={typography.eyebrow}>
                {TIP_LABEL[o.obrok_tip]}
                {o.status === "pojeo" ? " · pojedeno" : o.status === "zamenjeno" ? " · jeo nešto drugo" : o.status === "preskoceno" ? " · preskočeno" : ""}
              </Text>
              <Text style={[typography.bodyStrong, o.status === "preskoceno" && styles.skipped]} numberOfLines={2}>{o.naziv}</Text>
              <Text style={typography.bodySecondary}>{o.kalorije} kcal</Text>
            </View>
            {busy === key ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                {gotovo && (
                  <View style={[styles.iconBtn, { backgroundColor: o.status === "preskoceno" ? colors.surfaceAlt : colors.primary }]}>
                    <Icon
                      name={o.status === "pojeo" ? "checkmark" : o.status === "zamenjeno" ? "swap-horizontal" : "remove"}
                      size={20}
                      color={o.status === "preskoceno" ? colors.textSecondary : colors.onPrimary}
                    />
                  </View>
                )}
                {mozeZameniti && (
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => setZamena({ datum: selected, tip: o.obrok_tip })}
                    accessibilityLabel={`Zameni ${TIP_LABEL[o.obrok_tip].toLowerCase()} receptom`}
                  >
                    <Icon name="swap-horizontal" size={20} />
                  </TouchableOpacity>
                )}
                {mozeCekirati && (
                  <TouchableOpacity
                    style={[styles.iconBtn, styles.checkEmpty]}
                    onPress={() => pojeo(selected, o.obrok_tip)}
                    accessibilityLabel={`Označi ${TIP_LABEL[o.obrok_tip].toLowerCase()} kao pojedeno`}
                  >
                    <Icon name="checkmark" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        );
      })}

      {nedelja === 1 && (
        <Text style={[typography.bodySecondary, { marginBottom: 12 }]}>
          Jelovnik za sledeću nedelju pravi se u ponedeljak. Recepti koje ubaciš ostaju na svom mestu.
        </Text>
      )}

      <TouchableOpacity style={[common.outlineButton, { marginTop: 6 }]} onPress={onOpenKupovina}>
        <Icon name="cart-outline" size={20} />
        <Text style={common.outlineButtonText}>
          Kupovina{kupovinaBroj != null ? ` · ${kupovinaBroj} ${kupovinaBroj === 1 ? "stvar" : "stvari"}` : ""}
        </Text>
      </TouchableOpacity>

      {nedelja === 0 && (
        <TouchableOpacity style={styles.newPlan} onPress={() => noviJelovnik(true)} disabled={busy === "plan"}>
          <Text style={typography.bodySecondary}>{busy === "plan" ? "Pravim jelovnik..." : "Napravi nov jelovnik za ovu nedelju"}</Text>
        </TouchableOpacity>
      )}

      <RecipePicker
        visible={!!zamena}
        title="Zameni recept"
        subtitle={zamena ? `${formatDanDatum(zamena.datum)} · ${TIP_LABEL[zamena.tip]}` : undefined}
        onPick={zameniReceptom}
        onClose={() => setZamena(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" },
  checkEmpty: { backgroundColor: "transparent", borderWidth: 2, borderColor: colors.border },
  skipped: { textDecorationLine: "line-through", color: colors.textSecondary },
  weekBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 8, paddingLeft: 12 },
  weekBtnText: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.extrabold },
  newPlan: { alignItems: "center", paddingVertical: 16 },
});
