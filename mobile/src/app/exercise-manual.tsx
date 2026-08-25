import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { addManualExercise } from "../services/api";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function ExerciseManualScreen() {
  const [naziv, setNaziv] = useState("");
  const [grupaMisica, setGrupaMisica] = useState("");
  const [serijePonavljanja, setSerijePonavljanja] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!naziv.trim() || !grupaMisica.trim() || !serijePonavljanja.trim()) {
      Alert.alert("Greška", "Popuni sva polja");
      return;
    }

    setSaving(true);
    try {
      await addManualExercise({
        naziv_vezbe: naziv.trim(),
        grupa_misica: grupaMisica.trim(),
        serije_i_ponavljanja: serijePonavljanja.trim(),
      });
      router.replace("/exercises");
    } catch (err) {
      Alert.alert("Greška", "Nije uspelo čuvanje vežbe");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={[common.container, { padding: 20 }]}>
      <Text style={typography.label}>Naziv vežbe</Text>
      <TextInput
        style={common.input}
        value={naziv}
        onChangeText={setNaziv}
        placeholder="npr. Čučnjevi sa šipkom"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={typography.label}>Grupa mišića</Text>
      <TextInput
        style={common.input}
        value={grupaMisica}
        onChangeText={setGrupaMisica}
        placeholder="npr. Noge, Grudi, Leđa..."
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={typography.label}>Serije i ponavljanja</Text>
      <TextInput
        style={common.input}
        value={serijePonavljanja}
        onChangeText={setSerijePonavljanja}
        placeholder="npr. 4 serije x 10 ponavljanja"
        placeholderTextColor={colors.textSecondary}
      />

      <TouchableOpacity
        style={[common.primaryButton, { marginTop: 32, marginBottom: 40 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={common.primaryButtonText}>{saving ? "Čuvam..." : "Sačuvaj vežbu"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}