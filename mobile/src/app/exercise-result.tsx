import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function ExerciseResultScreen() {
  const { exercise: exerciseParam } = useLocalSearchParams();
  const exercise = JSON.parse(exerciseParam as string);

  return (
    <View style={[common.container, { padding: 20 }]}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>💪</Text>
      </View>

      <Text style={[typography.title, { marginBottom: 12 }]}>
        {exercise.naziv_vezbe || "Nepoznata vežba"}
      </Text>

      <View style={styles.tagsRow}>
        {exercise.grupa_misica && (
          <View style={common.badge}>
            <Text style={common.badgeText}>{exercise.grupa_misica}</Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={[common.card, styles.statCard]}>
          <Text style={typography.bodySecondary}>Serije/ponavljanja</Text>
          <Text style={styles.statValue}>{exercise.serije_i_ponavljanja || "—"}</Text>
        </View>
        {exercise.detektovano_ponavljanja != null && (
          <View style={[common.card, styles.statCard]}>
            <Text style={typography.bodySecondary}>Detektovano (AI)</Text>
            <Text style={styles.statValue}>{exercise.detektovano_ponavljanja}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { fontSize: 32 },
  tagsRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, marginBottom: 0 },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.textPrimary, marginTop: 4 },
});