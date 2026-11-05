import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from "react-native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { proceniGlas, type ProcenaObroka } from "../services/api";
import { colors } from "../theme";
import { common, typography } from "../styles/common";
import { Icon } from "./ui";

// OVAJ FAJL SE UČITAVA LENJO (require) samo kad postoji native modul ExpoAudio.
// Ne importuj ga direktno iz ekrana — stari build bez expo-audio bi pukao (vidi AGENTS.md, zamka 11).

const MAX_MS = 60_000;

type Stanje = "spreman" | "snima" | "obrada";

export default function GlasSnimac({
  onRezultat,
  autoStart = false,
}: {
  onRezultat: (r: ProcenaObroka) => void;
  autoStart?: boolean;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const status = useAudioRecorderState(recorder, 250);
  const [stanje, setStanje] = useState<Stanje>("spreman");
  const pokrenuto = useRef(false);

  const pocni = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Dozvola", "Za unos glasom treba dozvola za mikrofon. Možeš i da upišeš ručno.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStanje("snima");
    } catch {
      setStanje("spreman");
      Alert.alert("Greška", "Mikrofon nije mogao da se uključi. Upiši ručno.");
    }
  };

  const zavrsi = async () => {
    if (stanje !== "snima") return;
    setStanje("obrada");
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      const uri = recorder.uri;
      if (!uri) throw new Error("nema snimka");
      const r = await proceniGlas(uri);
      if (!r.naziv) {
        Alert.alert(
          "Nisam razumeo",
          r.tekst ? `Čuo sam: „${r.tekst}“, ali tu nema hrane. Probaj ponovo ili upiši ručno.` : "Nisam čuo ništa. Probaj ponovo, malo glasnije."
        );
      } else {
        onRezultat(r);
      }
    } catch (e: any) {
      Alert.alert("Greška", e?.message || "Prepoznavanje nije uspelo. Upiši ručno.");
    } finally {
      setStanje("spreman");
    }
  };

  // Najviše 60 s snimanja
  useEffect(() => {
    if (stanje === "snima" && status.durationMillis >= MAX_MS) zavrsi();
  }, [status.durationMillis, stanje]);

  useEffect(() => {
    if (autoStart && !pokrenuto.current) {
      pokrenuto.current = true;
      pocni();
    }
  }, [autoStart]);

  if (stanje === "obrada") {
    return (
      <View style={[common.card, styles.box]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={typography.bodySecondary}>Slušam i računam kalorije...</Text>
      </View>
    );
  }

  if (stanje === "snima") {
    const s = Math.floor((status.durationMillis || 0) / 1000);
    return (
      <TouchableOpacity style={[common.primaryButton, styles.big]} onPress={zavrsi} accessibilityLabel="Završi snimanje">
        <Icon name="stop" size={24} color={colors.onPrimary} />
        <Text style={common.primaryButtonText}>Gotovo · 0:{String(s).padStart(2, "0")}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={[common.secondaryButton, styles.big]} onPress={pocni} accessibilityLabel="Reci šta si jeo">
      <Icon name="mic-outline" size={24} color={colors.primary} />
      <Text style={common.secondaryButtonText}>Reci šta si jeo</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  big: { flexDirection: "row", gap: 10, minHeight: 56, marginBottom: 12 },
  box: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
});
