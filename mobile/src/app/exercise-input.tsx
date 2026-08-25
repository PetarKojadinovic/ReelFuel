import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { submitExerciseLink } from "../services/api";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function ExerciseInputScreen() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!url.trim()) {
      Alert.alert("Greška", "Unesi link pre slanja");
      return;
    }
    setLoading(true);
    try {
      const data = await submitExerciseLink(url);
      router.push({
        pathname: "/exercise-result",
        params: { exercise: JSON.stringify({ ...data.exercise, id: data.exercise_id, detektovano_ponavljanja: data.pose_analysis?.detektovano_ponavljanja }) },
      });
    } catch (err) {
      Alert.alert("Greška", "Nije uspelo preuzimanje ili obrada. Ovo može potrajati duže nego kod recepata — probaj ponovo ako je isteklo vreme.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[common.container, { padding: 20 }]}>
      <Text style={typography.label}>Nalepi TikTok ili Instagram Reels link vežbe</Text>
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
        Napomena: obrada vežbe traje duže od recepta (analiza pokreta iz videa) — obično 30-90 sekundi.
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <TouchableOpacity style={[common.primaryButton, { marginTop: 20 }]} onPress={handleSubmit}>
          <Text style={common.primaryButtonText}>Pošalji</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.textSecondary, marginTop: 10, lineHeight: 18 },
});