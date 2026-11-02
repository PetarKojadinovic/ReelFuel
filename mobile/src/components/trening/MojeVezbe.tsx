import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { router } from "expo-router";
import { listExercises, deleteExercise } from "../../services/api";
import { colors } from "../../theme";
import { common, typography } from "../../styles/common";
import { Icon, EmptyState } from "../ui";

export default function MojeVezbe({ refreshKey }: { refreshKey: number }) {
  const [list, setList] = useState<any[] | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await listExercises();
      setList(d?.exercises ?? []);
    } catch {
      setList((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const obrisi = (e: any) => {
    Alert.alert("Obriši vežbu", `Da obrišem "${e.naziv_vezbe}"?`, [
      { text: "Ne", style: "cancel" },
      {
        text: "Obriši",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteExercise(e.id);
            setList((prev) => (prev ?? []).filter((x) => x.id !== e.id));
          } catch {
            Alert.alert("Greška", "Brisanje nije uspelo.");
          }
        },
      },
    ]);
  };

  if (list == null) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  return (
    <View>
      <View style={[common.row, { marginBottom: 16 }]}>
        <TouchableOpacity style={[common.primaryButton, styles.flex]} onPress={() => router.push("/dodaj")}>
          <Text style={common.primaryButtonText}>Iz linka</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[common.secondaryButton, styles.flex]} onPress={() => router.push("/exercise-manual")}>
          <Text style={common.secondaryButtonText}>Upiši sam</Text>
        </TouchableOpacity>
      </View>

      {list.length === 0 && (
        <EmptyState
          icon="barbell-outline"
          title="Još nemaš sačuvanih vežbi"
          text="Podeli reel sa vežbom u ReelFuel. Sačuvane vežbe ulaze u tvoj plan treninga."
        />
      )}

      {list.map((e) => (
        <TouchableOpacity
          key={e.id}
          style={[common.card, styles.row]}
          onPress={() => router.push({ pathname: "/exercise-result", params: { exercise: JSON.stringify(e) } })}
        >
          <View style={styles.icon}>
            <Icon name="barbell-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={typography.bodyStrong} numberOfLines={2}>{e.naziv_vezbe}</Text>
            <Text style={typography.bodySecondary}>
              {e.grupa_misica}
              {e.serije_i_ponavljanja ? ` · ${e.serije_i_ponavljanja}` : ""}
            </Text>
          </View>
          <TouchableOpacity onPress={() => obrisi(e)} style={{ padding: 8 }} accessibilityLabel={`Obriši ${e.naziv_vezbe}`}>
            <Icon name="trash-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" },
});
