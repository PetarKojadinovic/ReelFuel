import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { analyzeMealPhoto, danAkcija, addLogEntry } from "../services/api";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function ZamenaScreen() {
  const { datum, obrok_tip } = useLocalSearchParams<{ datum: string; obrok_tip?: string }>();
  const [naziv, setNaziv] = useState("");
  const [kalorije, setKalorije] = useState("");
  const [info, setInfo] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  const analyze = async (b64: string) => {
    setAnalyzing(true);
    try {
      const r = await analyzeMealPhoto(b64);
      if (!r.naziv) {
        Alert.alert("Nije prepoznato", "Na slici nisam našao hranu. Unesi ručno.");
        return;
      }
      setNaziv(r.naziv);
      setKalorije(r.kalorije != null ? String(r.kalorije) : "");
      setInfo(r);
    } catch {
      Alert.alert("Greška", "Analiza slike nije uspela. Unesi ručno.");
    } finally {
      setAnalyzing(false);
    }
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Dozvola", "Za slikanje treba dozvola za kameru. Možeš da izabereš sliku iz galerije ili uneseš ručno.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], base64: true, quality: 0.4 });
      const b64 = res.canceled ? null : res.assets?.[0]?.base64;
      if (b64) await analyze(b64);
    } catch {
      Alert.alert(
        "Kamera se nije otvorila",
        "Zatvori aplikaciju potpuno i pokušaj ponovo, ili izaberi sliku iz galerije."
      );
    }
  };

  const pickFromGallery = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.4 });
      const b64 = res.canceled ? null : res.assets?.[0]?.base64;
      if (b64) await analyze(b64);
    } catch {
      Alert.alert("Greška", "Galerija se nije otvorila. Unesi ručno.");
    }
  };

  const confirm = async () => {
    const kcal = parseInt(kalorije, 10);
    if (!naziv.trim() || isNaN(kcal) || kcal < 0 || kcal > 5000) {
      Alert.alert("Greška", "Unesi naziv i kalorije (0 do 5000).");
      return;
    }
    setSaving(true);
    try {
      if (obrok_tip) {
        await danAkcija(datum as string, obrok_tip, { akcija: "zamena", naziv: naziv.trim(), kalorije: kcal });
      } else {
        await addLogEntry({ datum: datum as string, naziv: naziv.trim(), kalorije: kcal, izvor: "slobodan" });
      }
      router.replace("/dnevnik");
    } catch {
      Alert.alert("Greška", "Nije uspelo čuvanje.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={common.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={[typography.title, { marginBottom: 8 }]}>
          {obrok_tip ? "Šta si pojeo?" : "Dodaj obrok"}      </Text>
      <Text style={[typography.bodySecondary, { marginBottom: 20 }]}>
        Slikaj tanjir da dobiješ procenu, ili unesi ručno.
      </Text>

      {analyzing ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 24 }} />
      ) : (
        <View style={styles.photoRow}>
          <TouchableOpacity style={[common.secondaryButton, styles.photoBtn]} onPress={takePhoto}>
            <Text style={common.secondaryButtonText}>📷 Slikaj</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[common.secondaryButton, styles.photoBtn]} onPress={pickFromGallery}>
            <Text style={common.secondaryButtonText}>🖼️ Iz galerije</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={typography.label}>Naziv</Text>
      <TextInput
        style={common.input}
        value={naziv}
        onChangeText={setNaziv}
        placeholder="npr. Pasta sa piletinom"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={typography.label}>Kalorije</Text>
      <TextInput
        style={common.input}
        value={kalorije}
        onChangeText={setKalorije}
        keyboardType="numeric"
        placeholder="npr. 650"
        placeholderTextColor={colors.textSecondary}
      />

      {info && (
        <Text style={styles.note}>
          Procena sa slike
          {info.kalorije_min != null && info.kalorije_max != null
            ? `: oko ${info.kalorije_min} do ${info.kalorije_max} kcal`
            : ""}
          , pouzdanost {info.pouzdanost || "niska"}. Ispravi vrednost ako ne odgovara. Slika se šalje na analizu
          (Anthropic API), a aplikacija je ne čuva.
        </Text>
      )}

      <TouchableOpacity style={[common.primaryButton, { marginTop: 24 }]} onPress={confirm} disabled={saving}>
        <Text style={common.primaryButtonText}>{saving ? "Čuvam..." : "Potvrdi"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  photoBtn: { flex: 1 },
  note: { fontSize: 12, color: colors.textSecondary, marginTop: 12, lineHeight: 18 },
});