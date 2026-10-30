import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function ExerciseInputScreen() {
  const [url, setUrl] = useState("");

  const handleSubmit = () => {
    if (!url.trim()) {
      Alert.alert("Greška", "Unesi link pre slanja");
      return;
    }
    router.push({ pathname: "/ingest", params: { url: url.trim() } });
  };

  return (
    <View style={[common.container, { padding: 20 }]}>
      <Text style={typography.label}>Nalepi TikTok ili Instagram Reels link</Text>
      <TextInput
        style={common.input}
        value={url}
        onChangeText={setUrl}
        placeholder="https://..."
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.hint}>
        Aplikacija sama prepoznaje da li je video recept ili vežba. Obrada vežbe traje duže jer se analizira pokret.
      </Text>

      <TouchableOpacity style={[common.primaryButton, { marginTop: 20 }]} onPress={handleSubmit}>
        <Text style={common.primaryButtonText}>Pošalji</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.textSecondary, marginTop: 10, lineHeight: 18 },
});