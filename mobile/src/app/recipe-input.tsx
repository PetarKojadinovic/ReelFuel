import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { submitRecipeLink } from "../services/api";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function RecipeInputScreen() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!url.trim()) {
      Alert.alert("Greška", "Unesi link pre slanja");
      return;
    }
    setLoading(true);
    try {
      const data = await submitRecipeLink(url);
      router.push({
        pathname: "/recipe-result",
        params: { recipe: JSON.stringify(data.recipe) },
      });
    } catch (err) {
      Alert.alert("Greška", "Nije uspelo preuzimanje ili obrada. Proveri link i konekciju.");
    } finally {
      setLoading(false);
    }
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