import { useCallback, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { osveziNedelju, getNedeljaStatus, getKorekcija, odgovoriKorekcija, resetKorekcija } from "../services/api";
import { getAutoPlanOn } from "../services/mealTimes";
import { colors, fonts } from "../theme";
import { common, typography } from "../styles/common";
import { Icon, IconTile, TextButton } from "./ui";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RADI = ["pokrenuto", "u_toku"];

/**
 * Na početku nove nedelje sam napravi jelovnik, plan treninga i listu za kupovinu
 * (ako je uključeno u "Ja"), i prikaže predlog korekcije kalorijskog cilja.
 */
export default function NedeljaIKorekcija({ onChanged }: { onChanged?: () => void }) {
  const [refresh, setRefresh] = useState("azurno");
  const [gotovo, setGotovo] = useState(false);
  const [kor, setKor] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const promena = useRef(onChanged);
  promena.current = onChanged;

  const prati = useCallback(
    async (prvi: string) => {
      let s = prvi;
      const pokrenuto = RADI.includes(s);
      if (alive.current) setRefresh(s);
      let tries = 0;
      while (alive.current && RADI.includes(s) && tries < 45) {
        await sleep(4000);
        s = (await getNedeljaStatus()).status;
        if (alive.current) setRefresh(s);
        tries++;
      }
      if (alive.current && pokrenuto && s === "azurno") {
        setGotovo(true);
        promena.current?.();
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      (async () => {
        if (await getAutoPlanOn()) {
          try {
            await prati((await osveziNedelju()).status);
          } catch {}
        }
        try {
          const k = await getKorekcija();
          if (alive.current) setKor(k);
        } catch {}
      })();
      return () => {
        alive.current = false;
      };
    }, [prati])
  );

  const ponovo = async () => {
    try {
      await prati((await osveziNedelju(true)).status);
    } catch {
      setRefresh("greska");
    }
  };

  const odgovori = async (prihvati: boolean) => {
    if (!kor?.predlog) return;
    setBusy(true);
    try {
      setKor(await odgovoriKorekcija(kor.predlog.id, prihvati));
      promena.current?.();
    } catch {
    } finally {
      setBusy(false);
    }
  };

  const vrati = async () => {
    setBusy(true);
    try {
      setKor(await resetKorekcija());
      promena.current?.();
    } catch {
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      {RADI.includes(refresh) && (
        <View style={[common.card, styles.row]}>
          <ActivityIndicator color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={typography.bodyStrong}>Nova nedelja</Text>
            <Text style={typography.bodySecondary}>Pravim jelovnik, trening i listu za kupovinu. Možeš da zatvoriš aplikaciju.</Text>
          </View>
        </View>
      )}

      {gotovo && refresh === "azurno" && (
        <View style={[common.card, styles.row]}>
          <IconTile icon="calendar-outline" size={44} />
          <View style={{ flex: 1 }}>
            <Text style={typography.bodyStrong}>Plan za ovu nedelju je spreman</Text>
            <TextButton title="Pogledaj jelovnik" onPress={() => router.navigate({ pathname: "/hrana", params: { deo: "jelovnik" } })} />
          </View>
          <TouchableOpacity onPress={() => setGotovo(false)} style={{ padding: 6 }} accessibilityLabel="Zatvori">
            <Icon name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {refresh === "greska" && (
        <View style={[common.card, styles.row]}>
          <IconTile icon="alert-circle-outline" color={colors.warning} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={typography.bodyStrong}>Plan za ovu nedelju nije napravljen</Text>
            <Text style={typography.bodySecondary}>Proveri vezu sa laptopom, pa probaj ponovo.</Text>
            <TextButton title="Pokušaj ponovo" onPress={ponovo} />
          </View>
        </View>
      )}

      {kor?.predlog && (
        <View style={common.card}>
          <Text style={styles.title}>Predlog za dnevni cilj</Text>
          <Text style={[typography.bodyStrong, { marginVertical: 8 }]}>
            {kor.predlog.dnevni_cilj_pre} → {kor.predlog.dnevni_cilj_posle} kcal ({kor.predlog.delta > 0 ? "+" : ""}
            {kor.predlog.delta})
          </Text>
          <Text style={[typography.bodySecondary, { marginBottom: 6 }]}>{kor.predlog.razlog}</Text>
          <Text style={[typography.note, { marginBottom: 12 }]}>Orijentaciona preporuka, nije medicinski savet.</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity style={[common.primaryButton, styles.btn]} onPress={() => odgovori(true)} disabled={busy}>
              <Text style={common.primaryButtonText}>Prihvati</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[common.secondaryButton, styles.btn]} onPress={() => odgovori(false)} disabled={busy}>
              <Text style={common.secondaryButtonText}>Ne, hvala</Text>
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
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 12, color: colors.primary, fontFamily: fonts.extrabold, textTransform: "uppercase" },
  btnRow: { flexDirection: "row", gap: 8 },
  btn: { flex: 1 },
  noteRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
});
