import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { getShoppingList, generateShoppingList, toggleShoppingItem, deleteShoppingItem } from "../services/api";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function ShoppingListScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const load = async () => {
    try {
      const data = await getShoppingList();
      setItems(data.items);
    } catch (err) {
      // tiho
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await generateShoppingList();
      setItems(data.items);
    } catch (err) {
      Alert.alert("Greška", "Nije uspelo generisanje liste. Proveri da li imaš generisan nedeljni plan ishrane.");
    } finally {
      setGenerating(false);
    }
  };

  const handleToggle = async (id: number) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
    try {
      await toggleShoppingItem(id);
    } catch (err) {
      load();
    }
  };

  const handleDelete = async (id: number) => {
    await deleteShoppingItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  if (loading) {
    return (
      <View style={common.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const kupljeno = items.filter((i) => i.checked).length;

  return (
    <FlatList
      style={common.container}
      data={items}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={{ padding: 20, paddingTop: 20 }}
      ListHeaderComponent={
        <>
          <Text style={[typography.title, { marginBottom: 8 }]}>Lista za Kupovinu</Text>

          {items.length > 0 && (
            <Text style={[typography.bodySecondary, { marginBottom: 16 }]}>
              {kupljeno} / {items.length} kupljeno
            </Text>
          )}

          <TouchableOpacity
            style={[common.primaryButton, { marginBottom: 20 }]}
            onPress={handleGenerate}
            disabled={generating}
          >
            <Text style={common.primaryButtonText}>
              {generating ? "Generišem..." : items.length > 0 ? "🔄 Regeneriši iz plana" : "✨ Generiši iz nedeljnog plana"}
            </Text>
          </TouchableOpacity>
        </>
      }
      ListEmptyComponent={
        <Text style={[common.emptyText, { lineHeight: 20 }]}>
          Nema stavki. Generiši listu iz svog trenutnog nedeljnog plana ishrane.
        </Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={[common.card, styles.itemRow]} onPress={() => handleToggle(item.id)}>
          <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
            {item.checked && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>{item.naziv}</Text>
            {item.kolicina && <Text style={typography.bodySecondary}>{item.kolicina}</Text>}
          </View>
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            <Text style={common.deleteText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  itemRow: { flexDirection: "row", alignItems: "center" },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: "#141414", fontSize: 14, fontWeight: "700" },
  itemName: { fontSize: 15, color: colors.textPrimary, fontWeight: "600" },
  itemNameChecked: { textDecorationLine: "line-through", color: colors.textSecondary },
});