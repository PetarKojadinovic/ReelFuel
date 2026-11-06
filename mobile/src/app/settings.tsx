import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from "react-native";
import { router } from "expo-router";
import { getApiMode, setApiMode, getAutoUrl, getManualUrl, setApiUrl, getApiUrl, type ApiMode } from "../services/apiConfig";
import { getProfile } from "../services/api";
import { colors } from "../theme";
import { common, typography } from "../styles/common";
import { Card, Icon } from "../components/ui";

export default function SettingsScreen() {
  const [mode, setMode] = useState<ApiMode>("auto");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState<{ ok: boolean | null; text: string } | null>(null);
  const autoUrl = getAutoUrl();

  useEffect(() => {
    (async () => {
      setMode(await getApiMode());
      setUrl(await getManualUrl());
    })();
  }, []);

  const testiraj = async () => {
    setTest({ ok: null, text: "Proveravam..." });
    try {
      await getProfile();
      setTest({ ok: true, text: `Povezano: ${await getApiUrl()}` });
    } catch {
      setTest({ ok: false, text: `Nema veze sa ${await getApiUrl()}. Da li je backend pokrenut (start.bat)?` });
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

  const Opcija = ({ value, title, text, onPress }: { value: ApiMode; title: string; text: string; onPress: () => void }) => {
    const active = mode === value;
    return (
      <TouchableOpacity
        style={[common.option, active && common.optionActive]}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
      >
        <Icon name={active ? "radio-button-on" : "radio-button-off"} color={active ? colors.primary : colors.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={typography.bodyStrong}>{title}</Text>
          <Text style={[typography.bodySecondary, { marginTop: 2 }]}>{text}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={common.container} contentContainerStyle={common.stackPadding}>
      <Text style={typography.sectionLabel}>Gde je backend?</Text>

      <Opcija
        value="auto"
        title="Automatski (preporučeno)"
        text={
          autoUrl
            ? `Isti računar kao Expo: ${autoUrl}. Radi i kad promeniš mrežu ili hotspot.`
            : "Nije dostupno u ovoj verziji aplikacije — upiši adresu ručno."
        }
        onPress={izaberiAuto}
      />
      <Opcija value="rucno" title="Ručno" text="Za backend na drugom računaru ili serveru." onPress={() => setMode("rucno")} />

      {mode === "rucno" && (
        <>
          <TextInput
            style={[common.input, { marginTop: 4 }]}
            value={url}
            onChangeText={setUrl}
            placeholder="http://192.168.1.x:8000"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={[common.primaryButton, { marginTop: 4 }]} onPress={handleSaveManual} disabled={saving}>
            <Text style={common.primaryButtonText}>{saving ? "Čuvam..." : "Sačuvaj ručnu adresu"}</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={[common.secondaryButton, { marginTop: 20 }]} onPress={testiraj}>
        <Text style={common.secondaryButtonText}>Testiraj vezu</Text>
      </TouchableOpacity>
      {test && (
        <Card style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon
            name={test.ok === null ? "time-outline" : test.ok ? "checkmark-circle" : "alert-circle"}
            color={test.ok === null ? colors.textSecondary : test.ok ? colors.primary : colors.warning}
          />
          <Text style={[typography.body, { flex: 1 }]}>{test.text}</Text>
        </Card>
      )}
    </ScrollView>
  );
}
