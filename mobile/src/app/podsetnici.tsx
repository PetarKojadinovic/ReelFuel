import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Switch, Alert, ScrollView, StyleSheet } from "react-native";
import { colors } from "../theme";
import { common, typography } from "../styles/common";
import { Card, Icon, type IconName } from "../components/ui";
import { getMealTimes, setMealTimes, getRemindersOn, setRemindersOn, isValidHM } from "../services/mealTimes";
import { scheduleMealReminders, sendTestNotification, describeScheduled } from "../services/notifications";

export default function PodsetniciScreen() {
  const [on, setOn] = useState(false);
  const [dorucak, setDorucak] = useState("08:00");
  const [rucak, setRucak] = useState("13:00");
  const [vecera, setVecera] = useState("19:00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await getMealTimes();
      setDorucak(t.dorucak);
      setRucak(t.rucak);
      setVecera(t.vecera);
      setOn(await getRemindersOn());
    })();
  }, []);

  const save = async () => {
    if (!isValidHM(dorucak) || !isValidHM(rucak) || !isValidHM(vecera)) {
      Alert.alert("Greška", "Vreme mora biti u formatu HH:MM (npr. 08:00).");
      return;
    }
    setSaving(true);
    try {
      await setMealTimes({ dorucak, rucak, vecera });
      await setRemindersOn(on);
      const count = await scheduleMealReminders({ askPermission: true });
      if (on && count === 0) {
        Alert.alert(
          "Podsetnici nisu zakazani",
          "Proveri da li si dozvolio notifikacije i da li imaš napravljen jelovnik za ovu nedelju."
        );
      } else {
        Alert.alert("Sačuvano", on ? `Zakazano podsetnika: ${count}` : "Podsetnici su isključeni.");
      }
    } catch {
      Alert.alert("Greška", "Nije uspelo zakazivanje. Proveri vezu sa serverom.");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    try {
      const ok = await sendTestNotification();
      Alert.alert(
        ok ? "Poslato" : "Nije poslato",
        ok
          ? "Probna notifikacija stiže za 5 sekundi. Izađi iz aplikacije i čekaj."
          : "Notifikacije nisu dozvoljene (ili si na webu). Proveri dozvolu u podešavanjima telefona."
      );
    } catch (e: any) {
      Alert.alert("Greška", e?.message || "Nije uspelo slanje probne notifikacije.");
    }
  };

  const showScheduled = async () => {
    try {
      Alert.alert("Zakazano", await describeScheduled());
    } catch (e: any) {
      Alert.alert("Greška", e?.message || "Nije uspelo čitanje.");
    }
  };

  const obroci: { icon: IconName; label: string; value: string; set: (v: string) => void; placeholder: string }[] = [
    { icon: "sunny-outline", label: "Doručak", value: dorucak, set: setDorucak, placeholder: "08:00" },
    { icon: "restaurant-outline", label: "Ručak", value: rucak, set: setRucak, placeholder: "13:00" },
    { icon: "moon-outline", label: "Večera", value: vecera, set: setVecera, placeholder: "19:00" },
  ];

  return (
    <ScrollView style={common.container} contentContainerStyle={common.stackPadding}>
      <Card style={styles.switchRow}>
        <Icon name="notifications-outline" />
        <Text style={[typography.bodyStrong, { flex: 1 }]}>Podsetnici za obroke</Text>
        <Switch value={on} onValueChange={setOn} trackColor={{ true: colors.primary, false: colors.surfaceAlt }} thumbColor={colors.textPrimary} />
      </Card>
      <Text style={[typography.bodySecondary, { marginBottom: 16, lineHeight: 20 }]}>
        U vreme obroka stiže podsetnik: slikaj obrok, potvrdi da si jeo po planu ili preskoči. Ako ne odgovoriš, obrok iz
        plana se posle 2 sata računa kao procena i možeš ga ispraviti na ekranu Danas.
      </Text>

      <Text style={typography.sectionLabel}>Kad obično jedeš?</Text>
      <Card style={{ paddingVertical: 4 }}>
        {obroci.map((o, i) => (
          <View key={o.label} style={[styles.vremeRow, i < obroci.length - 1 && styles.vremeBorder]}>
            <Icon name={o.icon} color={colors.textSecondary} />
            <Text style={[typography.bodyStrong, { flex: 1 }]}>{o.label}</Text>
            <TextInput
              style={[common.input, styles.vremeInput]}
              value={o.value}
              onChangeText={o.set}
              placeholder={o.placeholder}
              placeholderTextColor={colors.textSecondary}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              accessibilityLabel={`${o.label}, vreme`}
            />
          </View>
        ))}
      </Card>

      <TouchableOpacity style={[common.primaryButton, { marginTop: 12 }]} onPress={save} disabled={saving}>
        <Text style={common.primaryButtonText}>{saving ? "Čuvam..." : "Sačuvaj"}</Text>
      </TouchableOpacity>

      <Text style={[typography.sectionLabel, { marginTop: 28 }]}>Provera</Text>
      <TouchableOpacity style={[common.secondaryButton, { marginBottom: 10 }]} onPress={test}>
        <Text style={common.secondaryButtonText}>Probna notifikacija (za 5 sekundi)</Text>
      </TouchableOpacity>
      <TouchableOpacity style={common.secondaryButton} onPress={showScheduled}>
        <Text style={common.secondaryButtonText}>Šta je zakazano</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  vremeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  vremeBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  vremeInput: { width: 88, marginBottom: 0, textAlign: "center", paddingVertical: 10 },
});
