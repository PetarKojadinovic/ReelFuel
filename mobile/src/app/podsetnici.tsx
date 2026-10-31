import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Switch, Alert, ScrollView } from "react-native";
import { colors } from "../theme";
import { common, typography } from "../styles/common";
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
          "Proveri da li si dozvolio notifikacije i da li imaš generisan nedeljni plan ishrane."
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

  return (
    <ScrollView style={common.container} contentContainerStyle={{ padding: 20 }}>
      <View style={[common.rowBetween, { marginBottom: 8 }]}>
        <Text style={typography.title}>Podsetnici</Text>
        <Switch value={on} onValueChange={setOn} trackColor={{ true: colors.primary }} />
      </View>
      <Text style={[typography.bodySecondary, { marginBottom: 16, lineHeight: 20 }]}>
        Upiši kad obično jedeš. U to vreme stiže podsetnik da slikaš obrok ili uneseš kalorije (ili da potvrdiš obrok
        po planu, ili preskočiš). Ako ne odgovoriš, obrok iz plana se posle 2 sata računa kao pretpostavljen (procena)
        i možeš ga ispraviti u Dnevniku.
      </Text>

      <Text style={typography.label}>Doručak (HH:MM)</Text>
      <TextInput style={common.input} value={dorucak} onChangeText={setDorucak} placeholder="08:00" placeholderTextColor={colors.textSecondary} />
      <Text style={typography.label}>Ručak (HH:MM)</Text>
      <TextInput style={common.input} value={rucak} onChangeText={setRucak} placeholder="13:00" placeholderTextColor={colors.textSecondary} />
      <Text style={typography.label}>Večera (HH:MM)</Text>
      <TextInput style={common.input} value={vecera} onChangeText={setVecera} placeholder="19:00" placeholderTextColor={colors.textSecondary} />

      <TouchableOpacity style={[common.primaryButton, { marginTop: 24 }]} onPress={save} disabled={saving}>
        <Text style={common.primaryButtonText}>{saving ? "Čuvam..." : "Sačuvaj"}</Text>
      </TouchableOpacity>

      <Text style={[typography.sectionLabel, { marginTop: 28 }]}>Provera</Text>
      <TouchableOpacity style={[common.secondaryButton, { marginBottom: 10 }]} onPress={test}>
        <Text style={common.secondaryButtonText}>🔔 Probna notifikacija (5 sekundi)</Text>
      </TouchableOpacity>
      <TouchableOpacity style={common.secondaryButton} onPress={showScheduled}>
        <Text style={common.secondaryButtonText}>📋 Šta je zakazano</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}