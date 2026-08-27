import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert, Modal } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  getShoppingList,
  generateShoppingList,
  generateShoppingListFromRecipe,
  toggleShoppingItem,
  deleteShoppingItem,
  listRecipes,
} from "../services/api";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

export default function ShoppingListScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

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

  const openRecipePicker = async () => {
    setPickerVisible(true);
    setLoadingRecipes(true);
    try {
      const data = await listRecipes();
      setRecipes(data.recipes);
    } catch (err) {
      Alert.alert("Greška", "Nije uspelo učitavanje recepata.");
    } finally {
      setLoadingRecipes(false);
    }
  };

  const handlePickRecipe = async (recipeId: number) => {
    setPickerVisible(false);
    setGenerating(true);
    try {
      const data = await generateShoppingListFromRecipe(recipeId);
      setItems(data.items);
    } catch (err) {
      Alert.alert("Greška", "Nije uspelo generisanje liste iz recepta.");
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
    <>
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
              style={[common.primaryButton, { marginBottom: 10 }]}
              onPress={handleGenerate}
              disabled={generating}
            >
              <Text style={common.primaryButtonText}>
                {generating ? "Generišem..." : "✨ Generiši iz nedeljnog plana"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[common.primaryButton, { marginBottom: 20 }]}
              onPress={openRecipePicker}
              disabled={generating}
            >
              <Text style={common.primaryButtonText}>🍽️ Generiši iz jednog recepta</Text>
            </TouchableOpacity>
          </>
        }
        ListEmptyComponent={
          <Text style={[common.emptyText, { lineHeight: 20 }]}>
            Nema stavki. Generiši listu iz nedeljnog plana ili jednog recepta.
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

      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[typography.title, { marginBottom: 12 }]}>Izaberi recept</Text>

            {loadingRecipes ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <FlatList
                data={recipes}
                keyExtractor={(r) => r.id.toString()}
                ListEmptyComponent={
                  <Text style={common.emptyText}>Nemaš sačuvanih recepata.</Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.recipeRow} onPress={() => handlePickRecipe(item.id)}>
                    <Text style={styles.recipeName}>{item.naziv_jela}</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity style={{ marginTop: 16, alignItems: "center" }} onPress={() => setPickerVisible(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Zatvori</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "70%",
  },
  recipeRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  recipeName: { fontSize: 15, color: colors.textPrimary, fontWeight: "600" },
});