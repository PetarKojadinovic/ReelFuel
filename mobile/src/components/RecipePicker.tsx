import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, Modal, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { listRecipes } from "../services/api";
import { colors, fonts } from "../theme";
import { common, typography } from "../styles/common";
import { Icon } from "./ui";

/** Panel odozdo sa listom recepata. Koristi se za zamenu obroka u jelovniku i za listu za kupovinu. */
export default function RecipePicker({
  visible,
  title,
  subtitle,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onPick: (recipe: any) => void;
  onClose: () => void;
}) {
  const [recipes, setRecipes] = useState<any[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    setRecipes(null);
    listRecipes()
      .then((d) => setRecipes(d?.recipes ?? []))
      .catch(() => setRecipes([]));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Zatvori">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={[typography.heading, { fontSize: 22 }]}>{title}</Text>
          {subtitle ? <Text style={[typography.bodySecondary, { marginTop: 4, marginBottom: 8 }]}>{subtitle}</Text> : null}

          {recipes == null ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={recipes}
              keyExtractor={(r) => String(r.id)}
              style={{ marginTop: 8 }}
              ListEmptyComponent={<Text style={common.emptyText}>Nemaš sačuvanih recepata. Dodaj ih dugmetom + (Link).</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.row} onPress={() => onPick(item)}>
                  <View style={styles.icon}>
                    <Icon name="restaurant-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.bodyStrong} numberOfLines={2}>{item.naziv_jela}</Text>
                    {item.priblizne_kalorije || item.proteini_g != null ? (
                      <Text style={typography.bodySecondary}>
                        {[item.priblizne_kalorije, item.proteini_g != null ? `${Math.round(item.proteini_g)} g proteina` : null].filter(Boolean).join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                  <Icon name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            />
          )}

          <TouchableOpacity style={[common.outlineButton, { marginTop: 12 }]} onPress={onClose}>
            <Text style={common.outlineButtonText}>Zatvori</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 34,
    maxHeight: "80%",
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: "center", marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" },
  name: { fontFamily: fonts.extrabold },
});
