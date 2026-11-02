import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { router } from "expo-router";
import { getProfile, saveProfile } from "../services/api";
import { colors, fonts } from "../theme";
import { common, typography } from "../styles/common";

type Pol = "muski" | "zenski";
type Aktivnost = "nizak" | "srednji" | "visok";
type Cilj = "mrsavljenje" | "dobijanje_mise" | "odrzavanje";
type Raspodela = "vecera_najveca" | "rucak_najveci" | "dorucak_najveci" | "ravnomerno";

function Opcije<T extends string>({
  value,
  onChange,
  options,
  kolona,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; opis?: string }[];
  kolona?: boolean;
}) {
  return (
    <View style={kolona ? { gap: 8 } : styles.row}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            style={[styles.opt, kolona && styles.optWide, on && styles.optOn]}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.optText, on && { color: colors.onPrimary }]}>{o.label}</Text>
            {o.opis ? <Text style={[styles.optOpis, on && { color: colors.onPrimary }]}>{o.opis}</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function MojiPodaciScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [postoji, setPostoji] = useState(false);
  const [tezina, setTezina] = useState("");
  const [visina, setVisina] = useState("");
  const [godine, setGodine] = useState("");
  const [ciljnaTezina, setCiljnaTezina] = useState("");
  const [pol, setPol] = useState<Pol>("muski");
  const [aktivnost, setAktivnost] = useState<Aktivnost>("srednji");
  const [cilj, setCilj] = useState<Cilj>("mrsavljenje");
  const [raspodela, setRaspodela] = useState<Raspodela>("vecera_najveca");
  const [brojTreninga, setBrojTreninga] = useState(4);

  useEffect(() => {
    getProfile()
      .then((d) => {
        if (!d?.exists) return;
        setPostoji(true);
        setTezina(String(d.tezina_kg).replace(".", ","));
        setVisina(String(d.visina_cm));
        setGodine(String(d.godine));
        setPol(d.pol);
        setAktivnost(d.nivo_aktivnosti);
        setCilj(d.cilj);
        setRaspodela(d.raspodela_kalorija || "vecera_najveca");
        setCiljnaTezina(d.ciljna_tezina_kg ? String(d.ciljna_tezina_kg).replace(".", ",") : "");
        setBrojTreninga(d.broj_treninga_nedeljno || 4);
      })
      .catch(() => Alert.alert("Greška", "Ne mogu da učitam podatke. Proveri vezu sa laptopom."))
      .finally(() => setLoading(false));
  }, []);

  const sacuvaj = async () => {
    const t = parseFloat(tezina.replace(",", "."));
    const v = parseFloat(visina.replace(",", "."));
    const g = parseInt(godine, 10);
    const ct = ciljnaTezina.trim() ? parseFloat(ciljnaTezina.replace(",", ".")) : undefined;
    if (!(t > 20 && t < 400) || !(v > 80 && v < 260) || !(g > 9 && g < 120) || (ct !== undefined && !(ct > 20 && ct < 400))) {
      Alert.alert("Proveri brojeve", "Težina u kg, visina u cm, godine, i ciljna težina (ako je upisuješ).");
      return;
    }
    setSaving(true);
    try {
      await saveProfile({
        tezina_kg: t,
        visina_cm: v,
        godine: g,
        pol,
        nivo_aktivnosti: aktivnost,
        cilj,
        raspodela_kalorija: raspodela,
        broj_treninga_nedeljno: brojTreninga,
        ciljna_tezina_kg: ct,
      });
      router.back();
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

  return (
    <ScrollView style={common.container} contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      {!postoji && (
        <Text style={[typography.bodySecondary, { marginBottom: 8 }]}>
          Od ovoga računam koliko kalorija ti treba dnevno. Možeš da promeniš kad god hoćeš.
        </Text>
      )}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={typography.label}>Težina (kg)</Text>
          <TextInput style={common.input} value={tezina} onChangeText={setTezina} keyboardType="decimal-pad" placeholder="80" placeholderTextColor={colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={typography.label}>Visina (cm)</Text>
          <TextInput style={common.input} value={visina} onChangeText={setVisina} keyboardType="numeric" placeholder="180" placeholderTextColor={colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={typography.label}>Godine</Text>
          <TextInput style={common.input} value={godine} onChangeText={setGodine} keyboardType="numeric" placeholder="25" placeholderTextColor={colors.textSecondary} />
        </View>
      </View>

      <Text style={typography.label}>Pol</Text>
      <Opcije<Pol> value={pol} onChange={setPol} options={[{ value: "muski", label: "Muški" }, { value: "zenski", label: "Ženski" }]} />

      <Text style={typography.label}>Šta želiš?</Text>
      <Opcije<Cilj>
        value={cilj}
        onChange={setCilj}
        kolona
        options={[
          { value: "mrsavljenje", label: "Da smršam", opis: "jedeš malo manje nego što trošiš" },
          { value: "dobijanje_mise", label: "Više mišića", opis: "jedeš koliko trošiš, više proteina" },
          { value: "odrzavanje", label: "Da ostanem isti", opis: "jedeš koliko trošiš" },
        ]}
      />

      <Text style={typography.label}>Ciljna težina (kg, nije obavezno)</Text>
      <TextInput style={common.input} value={ciljnaTezina} onChangeText={setCiljnaTezina} keyboardType="decimal-pad" placeholder="npr. 75" placeholderTextColor={colors.textSecondary} />

      <Text style={typography.label}>Koliko se krećeš tokom dana?</Text>
      <Opcije<Aktivnost>
        value={aktivnost}
        onChange={setAktivnost}
        options={[
          { value: "nizak", label: "Malo", opis: "sedim" },
          { value: "srednji", label: "Srednje", opis: "hodam" },
          { value: "visok", label: "Puno", opis: "fizički posao" },
        ]}
      />

      <Text style={typography.label}>Treninga nedeljno</Text>
      <Opcije<string>
        value={String(brojTreninga)}
        onChange={(v) => setBrojTreninga(Number(v))}
        options={["2", "3", "4", "5", "6"].map((n) => ({ value: n, label: n }))}
      />

      <Text style={typography.label}>Kada jedeš najviše?</Text>
      <Opcije<Raspodela>
        value={raspodela}
        onChange={setRaspodela}
        options={[
          { value: "dorucak_najveci", label: "Ujutru" },
          { value: "rucak_najveci", label: "U podne" },
          { value: "vecera_najveca", label: "Uveče" },
          { value: "ravnomerno", label: "Isto" },
        ]}
      />

      <TouchableOpacity style={[common.primaryButton, { marginTop: 28 }]} onPress={sacuvaj} disabled={saving}>
        <Text style={common.primaryButtonText}>{saving ? "Čuvam..." : "Sačuvaj"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  opt: {
    flex: 1,
    minWidth: 60,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  optWide: { alignItems: "flex-start", paddingHorizontal: 16 },
  optOn: { backgroundColor: colors.primary },
  optText: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.textPrimary },
  optOpis: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 2 },
});
