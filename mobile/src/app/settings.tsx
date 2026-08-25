import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { getApiUrl, setApiUrl, getDefaultUrl } from "../services/apiConfig";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function SettingsScreen() {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const current = await getApiUrl();
      setUrl(current);
    })();
  }, []);

  const handleSave = async () => {
    if (!url.trim()) {
      Alert.alert("Greška", "Unesi adresu servera");
      return;
    }
    setSaving(true);
    try {
      await setApiUrl(url.trim());
      Alert.alert("Sačuvano", "Adresa servera je ažurirana.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const defaultUrl = getDefaultUrl();
    setUrl(defaultUrl);
    await setApiUrl(defaultUrl);
  };

  return (
    <View style={[common.container, { padding: 20 }]}>
      <Text style={typography.label}>Adresa backend servera</Text>
      <Text style={[typography.bodySecondary, { marginBottom: 12 }]}>
        Promeni ovo kad se tvoja lokalna IP adresa promeni (npr. nova mreža/hotspot). Pokreni{" "}
        <Text style={{ fontWeight: "700" }}>ipconfig</Text> na računaru da nađeš trenutnu IP adresu.
      </Text>
      <TextInput
        style={common.input}
        value={url}
        onChangeText={setUrl}
        placeholder="http://192.168.1.x:8000"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity style={[common.primaryButton, { marginTop: 20 }]} onPress={handleSave} disabled={saving}>
        <Text style={common.primaryButtonText}>{saving ? "Čuvam..." : "Sačuvaj i poveži"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ marginTop: 16, alignItems: "center" }} onPress={handleReset}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Vrati na podrazumevanu adresu</Text>
      </TouchableOpacity>
    </View>
  );
}