import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from "react-native";
import {
  getShoppingList,
  generateShoppingList,
  generateShoppingListFromRecipe,
  toggleShoppingItem,
  deleteShoppingItem,
} from "../../services/api";
import { colors } from "../../theme";
import { common, typography } from "../../styles/common";
import { Icon, EmptyState } from "../ui";
import RecipePicker from "../RecipePicker";

export default function Kupovina({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getShoppingList();
      setItems(d?.items ?? []);
    } catch {
      setItems((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const izJelovnika = async () => {
    setBusy(true);
    try {
      const d = await generateShoppingList();
      setItems(d?.items ?? []);
    } catch {
      Alert.alert("Greška", "Nije uspelo. Proveri da li imaš jelovnik za ovu nedelju.");
    } finally {
      setBusy(false);
    }
  };

  const izRecepta = async (r: any) => {
    setPicker(false);
    setBusy(true);
    try {
      const d = await generateShoppingListFromRecipe(r.id);
      setItems(d?.items ?? []);
    } catch {
      Alert.alert("Greška", "Dodavanje sastojaka nije uspelo.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id: number) => {
    setItems((prev) => (prev ?? []).map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
    try {
      await toggleShoppingItem(id);
    } catch {
      load();
    }
  };

  const obrisi = async (id: number) => {
    setItems((prev) => (prev ?? []).filter((i) => i.id !== id));
    try {
      await deleteShoppingItem(id);
    } catch {
      load();
    }
  };

  const obrisiKupljeno = () => {
    const kupljeno = (items ?? []).filter((i) => i.checked);
    Alert.alert("Očisti listu", `Da sklonim ${kupljeno.length} kupljenih stvari?`, [
      { text: "Ne", style: "cancel" },
      {
        text: "Skloni",
        onPress: async () => {
          setItems((prev) => (prev ?? []).filter((i) => !i.checked));
          await Promise.all(kupljeno.map((i) => deleteShoppingItem(i.id).catch(() => null)));
          load();
        },
      },
    ]);
  };

  if (items == null) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  const zaKupiti = items.filter((i) => !i.checked);
  const kupljeno = items.filter((i) => i.checked);

  const Stavka = ({ item }: { item: any }) => (
    <TouchableOpacity style={[common.card, styles.row]} onPress={() => toggle(item.id)} accessibilityRole="checkbox" accessibilityState={{ checked: item.checked }}>
      <View style={[styles.box, item.checked && styles.boxOn]}>
        {item.checked && <Icon name="checkmark" size={18} color={colors.onPrimary} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyStrong, item.checked && styles.done]}>{item.naziv}</Text>
        {item.kolicina ? <Text style={typography.bodySecondary}>{item.kolicina}</Text> : null}
      </View>
      <TouchableOpacity onPress={() => obrisi(item.id)} style={{ padding: 6 }} accessibilityLabel={`Obriši ${item.naziv}`}>
        <Icon name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View>
      <View style={[common.row, { marginBottom: 16 }]}>
        <TouchableOpacity style={[common.primaryButton, styles.flex]} onPress={izJelovnika} disabled={busy}>
          <Text style={common.primaryButtonText}>{busy ? "Radim..." : "Iz jelovnika"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[common.secondaryButton, styles.flex]} onPress={() => setPicker(true)} disabled={busy}>
          <Text style={common.secondaryButtonText}>Iz recepta</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 && (
        <EmptyState icon="cart-outline" title="Lista je prazna" text="Napravi listu iz jelovnika za ovu nedelju ili dodaj sastojke jednog recepta." />
      )}

      {zaKupiti.length > 0 && <Text style={typography.sectionLabel}>Treba kupiti · {zaKupiti.length}</Text>}
      {zaKupiti.map((i) => (
        <Stavka key={i.id} item={i} />
      ))}

      {kupljeno.length > 0 && (
        <>
          <View style={[common.rowBetween, { marginTop: 8 }]}>
            <Text style={typography.sectionLabel}>Kupljeno · {kupljeno.length}</Text>
            <TouchableOpacity onPress={obrisiKupljeno} style={{ padding: 8 }}>
              <Text style={typography.bodySecondary}>Skloni sve</Text>
            </TouchableOpacity>
          </View>
          {kupljeno.map((i) => (
            <Stavka key={i.id} item={i} />
          ))}
        </>
      )}

      <RecipePicker
        visible={picker}
        title="Sastojci iz recepta"
        subtitle="Dodajem sastojke koji još nisu na listi."
        onPick={izRecepta}
        onClose={() => setPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  box: { width: 28, height: 28, borderRadius: 9, borderWidth: 2, borderColor: colors.border, justifyContent: "center", alignItems: "center" },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  done: { textDecorationLine: "line-through", color: colors.textSecondary },
});
