import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { addManualRecipe } from "../services/api";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function RecipeManualScreen() {
  const [naziv, setNaziv] = useState("");
  const [sastojciText, setSastojciText] = useState("");
  const [koraciText, setKoraciText] = useState("");
  const [kalorije, setKalorije] = useState("");
  const [proteini, setProteini] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!naziv.trim() || !sastojciText.trim() || !koraciText.trim()) {
      Alert.alert("Greška", "Popuni naziv, sastojke i korake");
      return;
    }

    const sastojci = sastojciText
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => ({ naziv: line.trim(), kolicina: "" }));

    const koraci = koraciText
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => line.trim());

    const p = proteini.trim() ? parseFloat(proteini.replace(",", ".")) : null;
    if (p != null && (isNaN(p) || p < 0 || p > 500)) {
      Alert.alert("Greška", "Proteini moraju biti broj od 0 do 500 g (ili ostavi prazno).");
      return;
    }

    setSaving(true);
    try {
      await addManualRecipe({
        naziv_jela: naziv.trim(),
        sastojci,
        koraci,
        priblizne_kalorije: kalorije.trim() || undefined,
        proteini_g: p,
      });
      router.navigate({ pathname: "/hrana", params: { deo: "recepti" } });
    } catch (err) {
      Alert.alert("Greška", "Nije uspelo čuvanje recepta");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={[common.container, { padding: 20 }]}>
      <Text style={typography.label}>Naziv jela</Text>
      <TextInput
        style={common.input}
        value={naziv}
        onChangeText={setNaziv}
        placeholder="npr. Piletina sa pirinčem"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={typography.label}>Sastojci (jedan po liniji)</Text>
      <TextInput
        style={[common.input, styles.textArea]}
        value={sastojciText}
        onChangeText={setSastojciText}
        placeholder={"200g piletine\n1 šolja pirinča\n1 kašika ulja"}
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={5}
      />

      <Text style={typography.label}>Koraci pripreme (jedan po liniji)</Text>
      <TextInput
        style={[common.input, styles.textArea]}
        value={koraciText}
        onChangeText={setKoraciText}
        placeholder={"Isecka piletinu na kockice\nSkuvaj pirinač\nIspeci piletinu na ulju"}
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={5}
      />

      <Text style={typography.label}>Kalorije (opciono)</Text>
      <TextInput
        style={common.input}
        value={kalorije}
        onChangeText={setKalorije}
        placeholder="npr. oko 550 kcal"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={typography.label}>Proteini u gramima (opciono)</Text>
      <TextInput
        style={common.input}
        value={proteini}
        onChangeText={setProteini}
        keyboardType="numeric"
        placeholder="npr. 40"
        placeholderTextColor={colors.textSecondary}
      />

      <TouchableOpacity
        style={[common.primaryButton, { marginTop: 32, marginBottom: 40 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={common.primaryButtonText}>{saving ? "Čuvam..." : "Sačuvaj recept"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  textArea: { minHeight: 100, textAlignVertical: "top" },
});