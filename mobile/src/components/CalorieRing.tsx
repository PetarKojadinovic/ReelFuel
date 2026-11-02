import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../theme";

const SIZE = 108;
const TACAKA = 36;
const R = SIZE / 2 - 7;

/**
 * Krug napretka bez SVG biblioteke: 36 tačaka u krugu, popunjene po procentu.
 * progres 0..1 (iznad 1 = sve popunjeno, narandžasto).
 */
export default function CalorieRing({ progres, vrednost, oznaka }: { progres: number; vrednost: number; oznaka: string }) {
  const p = Math.max(0, progres);
  const popunjeno = Math.round(Math.min(p, 1) * TACAKA);
  const boja = p > 1 ? colors.warning : colors.primary;
  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(p, 1) * 100) }}>
      {Array.from({ length: TACAKA }).map((_, i) => {
        const ugao = (i / TACAKA) * 2 * Math.PI - Math.PI / 2;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                left: SIZE / 2 + R * Math.cos(ugao) - 5,
                top: SIZE / 2 + R * Math.sin(ugao) - 5,
                backgroundColor: i < popunjeno ? boja : colors.border,
              },
            ]}
          />
        );
      })}
      <Text style={styles.value}>{vrednost}</Text>
      <Text style={styles.label}>{oznaka}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, justifyContent: "center", alignItems: "center" },
  dot: { position: "absolute", width: 10, height: 10, borderRadius: 5 },
  value: { fontSize: 26, fontFamily: fonts.black, color: colors.textPrimary },
  label: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
});
