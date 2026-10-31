import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { osveziNedelju, getNedeljaStatus, getKorekcija, odgovoriKorekcija, resetKorekcija } from "../services/api";
import { getAutoPlanOn } from "../services/mealTimes";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function NedeljaIKorekcija({ onChanged }: { onChanged?: () => void }) {
  const [refresh, setRefresh] = useState("azurno");
  const [kor, setKor] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        if (await getAutoPlanOn()) {
          try {
            let s = (await osveziNedelju()).status;
            let started = s === "pokrenuto" || s === "u_toku";
            if (alive) setRefresh(s);
            let tries = 0;
            while (alive && (s === "pokrenuto" || s === "u_toku") && tries < 45) {
              await sleep(4000);
              s = (await getNedeljaStatus()).status;
              if (alive) setRefresh(s);
              tries++;
            }
            if (alive && started && s === "azurno") onChanged?.();
          } catch {}
        }
        try {
          const k = await getKorekcija();
          if (alive) setKor(k);
        } catch {}
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const odgovori = async (prihvati: boolean) => {
    if (!kor?.predlog) return;
    setBusy(true);
    try {
      setKor(await odgovoriKorekcija(kor.predlog.id, prihvati));
      onChanged?.();
    } catch {
    } finally {
      setBusy(false);
    }
  };

  const vrati = async () => {
    setBusy(true);
    try {
      setKor(await resetKorekcija());
      onChanged?.();
    } catch {
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      {(refresh === "pokrenuto" || refresh === "u_toku") && (
        <View style={[common.card, styles.row]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[typography.body, { marginLeft: 12, flex: 1 }]}>
            Pravim plan ishrane, treninga i listu za kupovinu za ovu nedelju...
          </Text>
        </View>
      )}
      {refresh === "greska" && (
        <Text style={[typography.bodySecondary, { marginBottom: 12 }]}>
          Automatski plan za ovu nedelju nije uspeo. Generiši ga ručno u Nedeljnom planu.
        </Text>
      )}

      {kor?.predlog && (
        <View style={common.card}>
          <Text style={styles.title}>Predlog za dnevni cilj</Text>
          <Text style={[typography.body, { marginVertical: 8 }]}>
            {kor.predlog.dnevni_cilj_pre} → {kor.predlog.dnevni_cilj_posle} kcal ({kor.predlog.delta > 0 ? "+" : ""}
            {kor.predlog.delta})
          </Text>
          <Text style={[typography.bodySecondary, { marginBottom: 6 }]}>{kor.predlog.razlog}</Text>
          <Text style={[typography.bodySecondary, { marginBottom: 12, fontSize: 11 }]}>
            Orijentaciona preporuka, nije medicinski savet.
          </Text>
          <View style={styles.btnRow}>
            <TouchableOpacity style={[common.primaryButton, styles.btn]} onPress={() => odgovori(true)} disabled={busy}>
              <Text style={styles.btnText}>Prihvati</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[common.secondaryButton, styles.btn]} onPress={() => odgovori(false)} disabled={busy}>
              <Text style={styles.btnTextLight}>Ne, hvala</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!kor?.predlog && kor && kor.korekcija !== 0 && (
        <View style={styles.noteRow}>
          <Text style={typography.bodySecondary}>
            Cilj je prilagođen za {kor.korekcija > 0 ? "+" : ""}
            {kor.korekcija} kcal.
          </Text>
          <TouchableOpacity onPress={vrati} disabled={busy}>
            <Text style={[typography.bodySecondary, { textDecorationLine: "underline" }]}>Vrati originalni</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: 12, color: colors.secondary, fontWeight: "700", textTransform: "uppercase" },
  btnRow: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 12 },
  btnText: { color: "#141414", fontSize: 13, fontWeight: "700", textAlign: "center" },
  btnTextLight: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", textAlign: "center" },
  noteRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
});