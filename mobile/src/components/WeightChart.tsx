import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

type Entry = { datum: string; tezina_kg: number };

export default function WeightChart({
  istorija,
  ciljnaTezina,
}: {
  istorija: Entry[];
  ciljnaTezina?: number | null;
}) {
  if (istorija.length < 2) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Potrebna su bar 2 unosa da se prikaže grafikon.</Text>
      </View>
    );
  }

  const values = istorija.map((e) => e.tezina_kg);
  const allValues = ciljnaTezina ? [...values, ciljnaTezina] : values;
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const chartHeight = 140;

  const targetHeightPct = ciljnaTezina != null ? ((ciljnaTezina - min) / range) * 0.8 + 0.15 : null;

  return (
    <View style={styles.container}>
      <View style={styles.chartArea}>
        {targetHeightPct != null && (
          <View
            style={[
              styles.targetLine,
              { bottom: chartHeight * targetHeightPct },
            ]}
          />
        )}

        {istorija.map((entry, i) => {
          const heightPct = ((entry.tezina_kg - min) / range) * 0.8 + 0.15;
          return (
            <View key={i} style={styles.barWrap}>
              <Text style={styles.barValue}>{entry.tezina_kg}</Text>
              <View style={styles.barColumn}>
                <View style={[styles.bar, { height: chartHeight * heightPct }]} />
              </View>
              <Text style={styles.barDate}>{entry.datum.slice(5)}</Text>
            </View>
          );
        })}
      </View>

      {ciljnaTezina != null && (
        <View style={styles.legendRow}>
          <View style={styles.legendDash} />
          <Text style={styles.legendText}>Cilj: {ciljnaTezina}kg</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  emptyWrap: { paddingVertical: 20, alignItems: "center" },
  emptyText: { color: colors.textSecondary, fontSize: 13 },
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 190,
    gap: 6,
    position: "relative",
  },
  targetLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  barWrap: { flex: 1, alignItems: "center" },
  barValue: { fontSize: 10, color: colors.textPrimary, fontWeight: "700", marginBottom: 4 },
  barColumn: { height: 140, justifyContent: "flex-end" },
  bar: {
    width: "70%",
    minWidth: 4,
    backgroundColor: colors.primary,
    borderRadius: 4,
    alignSelf: "center",
  },
  barDate: { fontSize: 9, color: colors.textSecondary, marginTop: 6 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  legendDash: { width: 14, height: 0, borderStyle: "dashed", borderWidth: 1, borderColor: colors.secondary },
  legendText: { fontSize: 11, color: colors.textSecondary },
});