import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { listExercises, deleteExercise } from "../services/api";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const load = async () => {
    try {
      const data = await listExercises();
      setExercises(data.exercises);
    } catch (err) {
      // tiho
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: number, naziv: string) => {
    Alert.alert("Obriši vežbu", `Da li sigurno želiš da obrišeš "${naziv}"?`, [
      { text: "Otkaži", style: "cancel" },
      {
        text: "Obriši",
        style: "destructive",
        onPress: async () => {
          await deleteExercise(id);
          setExercises((prev) => prev.filter((e) => e.id !== id));
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={common.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={common.container}
      data={exercises}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={common.screenPadding}
      ListHeaderComponent={
        <>
          <Text style={[typography.title, { marginBottom: 20 }]}>Moje Vežbe</Text>
          <View style={styles.headerRow}>
            <TouchableOpacity style={common.primaryButton} onPress={() => router.push("/exercise-input")}>
              <Text style={common.primaryButtonText}>🔗 Sa linka</Text>
            </TouchableOpacity>
            <TouchableOpacity style={common.secondaryButton} onPress={() => router.push("/exercise-manual")}>
              <Text style={common.secondaryButtonText}>✏️ Ručno</Text>
            </TouchableOpacity>
          </View>
        </>
      }
      ListEmptyComponent={
        <Text style={common.emptyText}>Još nemaš sačuvanih vežbi. Dodaj prvu iznad!</Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[common.card, styles.card]}
          onPress={() => router.push({ pathname: "/exercise-result", params: { exercise: JSON.stringify(item) } })}
        >
          <View style={styles.cardIconWrap}>
            <Text style={styles.cardIcon}>💪</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.naziv_vezbe}</Text>
            <Text style={typography.bodySecondary}>
              {item.grupa_misica} {item.serije_i_ponavljanja ? `· ${item.serije_i_ponavljanja}` : ""}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleDelete(item.id, item.naziv_vezbe)} style={styles.deleteBtn}>
            <Text style={common.deleteText}>🗑</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  card: { flexDirection: "row", alignItems: "center", padding: 14 },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardIcon: { fontSize: 20 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  deleteBtn: { padding: 8 },
});