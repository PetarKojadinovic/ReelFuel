import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { getApiMode, setApiMode, getAutoUrl, getManualUrl, setApiUrl, getApiUrl, type ApiMode } from "../services/apiConfig";
import { getProfile } from "../services/api";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function SettingsScreen() {
  const [mode, setMode] = useState<ApiMode>("auto");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState<string | null>(null);
  const autoUrl = getAutoUrl();

  useEffect(() => {
    (async () => {
      setMode(await getApiMode());
      setUrl(await getManualUrl());
    })();
  }, []);

  const testiraj = async () => {
    setTest("Proveravam...");
    try {
      await getProfile();
      setTest(`✅ Povezano: ${await getApiUrl()}`);
    } catch {
      setTest(`❌ Nema veze sa ${await getApiUrl()}. Da li je backend pokrenut (start.ps1)?`);
    }
  };

  const izaberiAuto = async () => {
    await setApiMode("auto");
    setMode("auto");
    setTest(null);
  };

  const handleSaveManual = async () => {
    if (!/^https?:\/\/\S+$/.test(url.trim())) {
      Alert.alert("Greška", "Adresa mora počinjati sa http:// ili https://");
      return;
    }
    setSaving(true);
    try {
      await setApiUrl(url.trim().replace(/\/$/, ""));
      setMode("rucno");
      Alert.alert("Sačuvano", "Koristi se ručno upisana adresa.", [{ text: "OK", onPress: () => router.back() }]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={common.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={typography.label}>Adresa backend servera</Text>

      <TouchableOpacity style={[styles.opcija, mode === "auto" && styles.opcijaActive]} onPress={izaberiAuto}>
        <Text style={typography.body}>🔄 Automatski (preporučeno)</Text>
        <Text style={[typography.bodySecondary, { marginTop: 4 }]}>
          {autoUrl
            ? `Backend na istom računaru kao Expo: ${autoUrl}. Radi i kad promeniš mrežu ili hotspot.`
            : "Nije dostupno u ovoj verziji aplikacije — upiši adresu ručno."}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.opcija, mode === "rucno" && styles.opcijaActive]} onPress={() => setMode("rucno")}>
        <Text style={typography.body}>✏️ Ručno</Text>
        <Text style={[typography.bodySecondary, { marginTop: 4 }]}>Za backend na drugom računaru ili serveru.</Text>
      </TouchableOpacity>

      {mode === "rucno" && (
        <>
          <TextInput
            style={[common.input, { marginTop: 12 }]}
            value={url}
            onChangeText={setUrl}
            placeholder="http://192.168.1.x:8000"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={[common.primaryButton, { marginTop: 8 }]} onPress={handleSaveManual} disabled={saving}>
            <Text style={common.primaryButtonText}>{saving ? "Čuvam..." : "Sačuvaj ručnu adresu"}</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={[common.secondaryButton, { marginTop: 20 }]} onPress={testiraj}>
        <Text style={common.secondaryButtonText}>Testiraj vezu</Text>
      </TouchableOpacity>
      {test && <Text style={[typography.bodySecondary, { marginTop: 12 }]}>{test}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  opcija: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  opcijaActive: { borderColor: colors.primary },
});
