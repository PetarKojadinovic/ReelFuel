import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, TextInput, Alert } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getProfile, saveProfile, getWeightSummary, addWeightEntry } from "../../services/api";
import { colors } from "../../theme";
import { common, typography } from "../../styles/common";
import WeightChart from "../../components/WeightChart";

export default function ProfilScreen() {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [weightSummary, setWeightSummary] = useState<any>(null);
  const [ciljnaTezina, setCiljnaTezina] = useState("");
  const [noviUnosTezina, setNoviUnosTezina] = useState("");
  const [loggingWeight, setLoggingWeight] = useState(false);

  const [tezina, setTezina] = useState("");
  const [visina, setVisina] = useState("");
  const [godine, setGodine] = useState("");
  const [pol, setPol] = useState<"muski" | "zenski">("muski");
  const [aktivnost, setAktivnost] = useState<"nizak" | "srednji" | "visok">("srednji");
  const [cilj, setCilj] = useState<"mrsavljenje" | "dobijanje_mise" | "odrzavanje">("mrsavljenje");
  const [raspodela, setRaspodela] = useState<"vecera_najveca" | "rucak_najveci" | "dorucak_najveci" | "ravnomerno">("vecera_najveca");
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const load = async () => {
    try {
      const data = await getProfile();
      if (data.exists) {
        setProfile(data);
        setTezina(String(data.tezina_kg));
        setVisina(String(data.visina_cm));
        setGodine(String(data.godine));
        setPol(data.pol);
        setAktivnost(data.nivo_aktivnosti);
        setCilj(data.cilj);
        setRaspodela(data.raspodela_kalorija || "vecera_najveca");
        setCiljnaTezina(data.ciljna_tezina_kg ? String(data.ciljna_tezina_kg) : "");
      }
      const summary = await getWeightSummary();
      if (summary.exists) setWeightSummary(summary);
    } catch (err) {
      // nema profila jos
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfile({
        tezina_kg: parseFloat(tezina),
        visina_cm: parseFloat(visina),
        godine: parseInt(godine),
        pol,
        nivo_aktivnosti: aktivnost,
        cilj,
        raspodela_kalorija: raspodela,
        ciljna_tezina_kg: ciljnaTezina ? parseFloat(ciljnaTezina) : undefined,
      } as any);
      await load();
      setEditing(false);
    } catch (err) {
      Alert.alert("Greška", "Nije uspelo čuvanje profila");
    } finally {
      setSaving(false);
    }
  };

  const handleLogWeight = async () => {
    if (!noviUnosTezina.trim()) return;
    setLoggingWeight(true);
    try {
      await addWeightEntry({
        datum: new Date().toISOString().slice(0, 10),
        tezina_kg: parseFloat(noviUnosTezina),
      });
      setNoviUnosTezina("");
      await load();
    } catch (err) {
      Alert.alert("Greška", "Nije uspelo čuvanje unosa");
    } finally {
      setLoggingWeight(false);
    }
  };

  const OptionButton = ({ label, active, onPress }: any) => (
    <TouchableOpacity style={[styles.optionButton, active && styles.optionButtonActive]} onPress={onPress}>
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={common.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (editing || !profile) {
    return (
      <ScrollView style={common.container} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
        <Text style={typography.title}>{profile ? "Uredi profil" : "Podesi profil"}</Text>

        <Text style={typography.label}>Težina (kg)</Text>
        <TextInput style={common.input} value={tezina} onChangeText={setTezina} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />

        <Text style={typography.label}>Visina (cm)</Text>
        <TextInput style={common.input} value={visina} onChangeText={setVisina} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />

        <Text style={typography.label}>Godine</Text>
        <TextInput style={common.input} value={godine} onChangeText={setGodine} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />

        <Text style={typography.label}>Pol</Text>
        <View style={styles.row}>
          <OptionButton label="Muški" active={pol === "muski"} onPress={() => setPol("muski")} />
          <OptionButton label="Ženski" active={pol === "zenski"} onPress={() => setPol("zenski")} />
        </View>

        <Text style={typography.label}>Nivo aktivnosti</Text>
        <View style={styles.row}>
          <OptionButton label="Nizak" active={aktivnost === "nizak"} onPress={() => setAktivnost("nizak")} />
          <OptionButton label="Srednji" active={aktivnost === "srednji"} onPress={() => setAktivnost("srednji")} />
          <OptionButton label="Visok" active={aktivnost === "visok"} onPress={() => setAktivnost("visok")} />
        </View>

        <Text style={typography.label}>Cilj</Text>
        <View style={styles.row}>
          <OptionButton label="Mršavljenje" active={cilj === "mrsavljenje"} onPress={() => setCilj("mrsavljenje")} />
          <OptionButton label="Dobijanje mišića" active={cilj === "dobijanje_mise"} onPress={() => setCilj("dobijanje_mise")} />
          <OptionButton label="Održavanje" active={cilj === "odrzavanje"} onPress={() => setCilj("odrzavanje")} />
        </View>

        <Text style={typography.label}>Ciljna težina (kg)</Text>
        <TextInput
          style={common.input}
          value={ciljnaTezina}
          onChangeText={setCiljnaTezina}
          keyboardType="numeric"
          placeholder="npr. 73"
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={typography.label}>Kada najviše jedeš?</Text>
        <View style={styles.columnOptions}>
          <OptionButton label="Najviše uveče" active={raspodela === "vecera_najveca"} onPress={() => setRaspodela("vecera_najveca")} />
          <OptionButton label="Najviše u podne" active={raspodela === "rucak_najveci"} onPress={() => setRaspodela("rucak_najveci")} />
          <OptionButton label="Najviše ujutru" active={raspodela === "dorucak_najveci"} onPress={() => setRaspodela("dorucak_najveci")} />
          <OptionButton label="Ravnomerno" active={raspodela === "ravnomerno"} onPress={() => setRaspodela("ravnomerno")} />
        </View>

        <TouchableOpacity style={{ marginTop: 16, alignItems: "center" }} onPress={() => router.push("/settings")}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>⚙️ Podešavanja servera</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[common.primaryButton, { marginTop: 24 }]} onPress={handleSave} disabled={saving}>
          <Text style={common.primaryButtonText}>{saving ? "Čuvam..." : "Sačuvaj profil"}</Text>
        </TouchableOpacity>

        {profile && (
          <TouchableOpacity style={styles.cancelButton} onPress={() => setEditing(false)}>
            <Text style={styles.cancelButtonText}>Otkaži</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  const progres = weightSummary?.progres_procenat ?? 0;

  return (
    <ScrollView style={common.container} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
      <Text style={[typography.title, { marginBottom: 20 }]}>Moj Profil</Text>

      <View style={[common.card, styles.progressCircleCard]}>
        <View style={styles.progressCircle}>
          <Text style={styles.progressCirclePct}>{progres}%</Text>
        </View>
        <View>
          <Text style={styles.progressCircleLabel}>
            Cilj: {profile.cilj === "mrsavljenje" ? "Mršavljenje" : profile.cilj === "dobijanje_mise" ? "Dobijanje mišića" : "Održavanje"}
          </Text>
          <Text style={typography.bodySecondary}>
            {profile.cilj === "mrsavljenje" ? "-0.5 kg / nedeljno" : ""}
          </Text>
        </View>
      </View>

      <Text style={typography.sectionLabel}>Praćenje težine</Text>
      <View style={common.card}>
        {weightSummary ? (
          <>
            <View style={styles.weightStatsRow}>
              <View>
                <Text style={styles.weightStatLabel}>Početna</Text>
                <Text style={styles.weightStatValue}>{weightSummary.pocetna_tezina}kg</Text>
              </View>
              <View>
                <Text style={styles.weightStatLabel}>Trenutna</Text>
                <Text style={[styles.weightStatValue, { color: colors.primary }]}>{weightSummary.trenutna_tezina}kg</Text>
              </View>
              <View>
                <Text style={styles.weightStatLabel}>Cilj</Text>
                <Text style={styles.weightStatValue}>{weightSummary.ciljna_tezina ?? "—"}kg</Text>
              </View>
            </View>
            <WeightChart istorija={weightSummary.istorija} ciljnaTezina={weightSummary.ciljna_tezina} />
          </>
        ) : (
          <Text style={typography.bodySecondary}>Još nema dovoljno podataka za grafikon.</Text>
        )}

        <View style={styles.weightInputRow}>
          <TextInput
            style={[common.input, { flex: 1, marginBottom: 0 }]}
            value={noviUnosTezina}
            onChangeText={setNoviUnosTezina}
            placeholder="Nova težina (kg)"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
          />
          <TouchableOpacity style={styles.weightInputBtn} onPress={handleLogWeight} disabled={loggingWeight}>
            <Text style={styles.weightInputBtnText}>{loggingWeight ? "..." : "Unesi"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={typography.sectionLabel}>Osnovni podaci</Text>
      <View style={common.card}>
        <DataRow label="Težina" value={`${profile.tezina_kg} kg`} />
        <DataRow label="Visina" value={`${profile.visina_cm} cm`} />
        <DataRow label="Godine" value={`${profile.godine}`} />
        <DataRow label="Pol" value={profile.pol === "muski" ? "Muški" : "Ženski"} />
        <DataRow label="Nivo aktivnosti" value={profile.nivo_aktivnosti} last />
      </View>

      <Text style={typography.sectionLabel}>Izračunato</Text>
      <View style={common.card}>
        <DataRow label="Dnevni cilj" value={`${profile.dnevni_cilj_kalorija ?? "—"} kcal`} last />
      </View>

      <TouchableOpacity style={[common.primaryButton, { marginTop: 8 }]} onPress={() => setEditing(true)}>
        <Text style={common.primaryButtonText}>Uredi profil</Text>
      </TouchableOpacity>

      
    </ScrollView>
  );
}

function DataRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[dataRowStyles.row, !last && dataRowStyles.rowBorder]}>
      <Text style={dataRowStyles.label}>{label}</Text>
      <Text style={dataRowStyles.value}>{value}</Text>
    </View>
  );
}

const dataRowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontSize: 14, color: colors.textSecondary },
  value: { fontSize: 14, color: colors.textPrimary, fontWeight: "600" },
});

const styles = StyleSheet.create({
  progressCircleCard: { flexDirection: "row", alignItems: "center", gap: 16 },
  progressCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  progressCirclePct: { color: colors.primary, fontWeight: "800", fontSize: 14 },
  progressCircleLabel: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  weightStatsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  weightStatLabel: { fontSize: 11, color: colors.textSecondary },
  weightStatValue: { fontSize: 16, fontWeight: "800", color: colors.textPrimary, marginTop: 2 },
  weightInputRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  weightInputBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 18, justifyContent: "center" },
  weightInputBtnText: { color: "#141414", fontWeight: "700" },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  columnOptions: { gap: 8 },
  optionButton: {
    flex: 1,
    minWidth: "30%",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  optionButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  optionTextActive: { color: "#141414" },
  cancelButton: { padding: 14, marginTop: 10, marginBottom: 40 },
  cancelButtonText: { color: colors.textSecondary, fontSize: 14, textAlign: "center" },
});