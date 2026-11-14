import { Platform, StyleSheet, Text, TurboModuleRegistry, View } from "react-native";
import { colors } from "../theme";
import { spacing, typography } from "../styles/common";

/**
 * Crtež tela (spreda i otpozadi) sa obojenim mišićima vežbe.
 * Glavni mišići: primary, pomoćni: secondary.
 *
 * react-native-svg ima native deo -> stari build ga nema. Zato se biblioteka učitava LENJO,
 * tek kad je native modul tu (inače bi pukla cela aplikacija, vidi AGENTS.md 7.11).
 */
function ucitajBody(): any | null {
  if (Platform.OS !== "web" && !TurboModuleRegistry.get("RNSVGSvgViewModule")) return null;
  try {
    return require("react-native-body-highlighter").default;
  } catch {
    return null;
  }
}

export default function TeloMisici({ glavni, sporedni }: { glavni: string[]; sporedni: string[] }) {
  const Body = ucitajBody();
  if (!Body || glavni.length + sporedni.length === 0) return null;

  const data = [
    ...glavni.map((slug) => ({ slug, intensity: 1 })),
    ...sporedni.map((slug) => ({ slug, intensity: 2 })),
  ];
  const zajedno = {
    data,
    colors: [colors.primary, colors.secondary],
    scale: 0.62,
    border: "none",
    defaultFill: colors.surfaceAlt,
  };

  return (
    <View accessible accessibilityLabel="Crtež tela sa obojenim mišićima">
      <View style={styles.red}>
        <View style={styles.strana}>
          <Body {...zajedno} side="front" />
          <Text style={typography.note}>Spreda</Text>
        </View>
        <View style={styles.strana}>
          <Body {...zajedno} side="back" />
          <Text style={typography.note}>Otpozadi</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  red: { flexDirection: "row", justifyContent: "space-around", marginTop: spacing.sm },
  strana: { alignItems: "center" },
});
