import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { requireOptionalNativeModule } from "expo";
import * as ImagePicker from "expo-image-picker";
import { analyzeMealPhoto, danAkcija, addLogEntry, proceniOpis, type ProcenaObroka } from "../services/api";
import { colors, fonts } from "../theme";
import { common, typography } from "../styles/common";

// Mikrofon samo ako postoji u instaliranoj verziji aplikacije (stari build bez expo-audio ne sme da pukne)
const glasDostupan = Platform.OS !== "web" && !!requireOptionalNativeModule("ExpoAudio");
const GlasSnimac: typeof import("../components/GlasSnimac").default | null = glasDostupan
  ? require("../components/GlasSnimac").default
  : null;

export default function ZamenaScreen() {
  const { datum, obrok_tip, odmah } = useLocalSearchParams<{ datum: string; obrok_tip?: string; odmah?: string }>();
  const [naziv, setNaziv] = useState("");
  const [kalorije, setKalorije] = useState("");
  const [proteini, setProteini] = useState("");
  const [info, setInfo] = useState<any>(null);
  const [glas, setGlas] = useState<ProcenaObroka | null>(null);
  const [procenjujem, setProcenjujem] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  const analyze = async (b64: string) => {
    setAnalyzing(true);
    try {
      const r = await analyzeMealPhoto(b64);
      if (!r.naziv) {
        Alert.alert("Nije prepoznato", "Na slici nisam našao hranu. Unesi ručno.");
        return;
      }
      setNaziv(r.naziv);
      setKalorije(r.kalorije != null ? String(r.kalorije) : "");
      setProteini(r.proteini_g != null ? String(r.proteini_g) : "");
      setInfo(r);
      setGlas(null);
    } catch {
      Alert.alert("Greška", "Analiza slike nije uspela. Unesi ručno.");
    } finally {
      setAnalyzing(false);
    }
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Dozvola", "Za slikanje treba dozvola za kameru. Možeš da izabereš sliku iz galerije ili uneseš ručno.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], base64: true, quality: 0.4 });
      const b64 = res.canceled ? null : res.assets?.[0]?.base64;
      if (b64) await analyze(b64);
    } catch {
      Alert.alert(
        "Kamera se nije otvorila",
        "Zatvori aplikaciju potpuno i pokušaj ponovo, ili izaberi sliku iz galerije."
      );
    }
  };

  const pickFromGallery = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.4 });
      const b64 = res.canceled ? null : res.assets?.[0]?.base64;
      if (b64) await analyze(b64);
    } catch {
      Alert.alert("Greška", "Galerija se nije otvorila. Unesi ručno.");
    }
  };

  const primeni = (r: ProcenaObroka) => {
    setNaziv(r.naziv ?? "");
    setKalorije(r.kalorije != null ? String(r.kalorije) : "");
    setProteini(r.proteini_g != null ? String(Math.round(r.proteini_g)) : "");
    setGlas(r);
    setInfo(null);
  };

  // Upisan naziv bez kalorija ("pljeskavica u lepinji") -> procena preko AI
  const proceniNaziv = async () => {
    setProcenjujem(true);
    try {
      const r = await proceniOpis(naziv.trim());
      if (!r.naziv) Alert.alert("Nisam razumeo", "Ne prepoznajem hranu u ovom opisu. Unesi kalorije ručno.");
      else primeni(r);
    } catch {
      Alert.alert("Greška", "Procena nije uspela. Unesi kalorije ručno.");
    } finally {
      setProcenjujem(false);
    }
  };

  // Iz panela "+" → "Slikaj obrok": odmah otvori kameru
  const kameraPokrenuta = useRef(false);
  useEffect(() => {
    if (odmah === "slika" && !kameraPokrenuta.current) {
      kameraPokrenuta.current = true;
      takePhoto();
    }
  }, [odmah]);

  const confirm = async () => {
    const kcal = parseInt(kalorije, 10);
    if (!naziv.trim() || isNaN(kcal) || kcal < 0 || kcal > 5000) {
      Alert.alert("Greška", "Unesi naziv i kalorije (0 do 5000).");
      return;
    }
    // Proteini nisu obavezni: prazno = nepoznato
    const p = proteini.trim() ? parseFloat(proteini.replace(",", ".")) : null;
    if (p != null && (isNaN(p) || p < 0 || p > 500)) {
      Alert.alert("Greška", "Proteini moraju biti broj od 0 do 500 g (ili ostavi prazno).");
      return;
    }
    setSaving(true);
    try {
      if (obrok_tip) {
        await danAkcija(datum as string, obrok_tip, { akcija: "zamena", naziv: naziv.trim(), kalorije: kcal, proteini_g: p });
      } else {
        await addLogEntry({ datum: datum as string, naziv: naziv.trim(), kalorije: kcal, proteini_g: p, izvor: "slobodan" });
      }
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch {
      Alert.alert("Greška", "Nije uspelo čuvanje.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={common.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={[typography.title, { marginBottom: 8 }]}>
        {obrok_tip ? "Šta si pojeo umesto toga?" : "Šta si pojeo?"}
      </Text>
      <Text style={[typography.bodySecondary, { marginBottom: 20 }]}>
        {GlasSnimac ? "Reci šta si jeo, slikaj tanjir, ili unesi ručno." : "Slikaj tanjir da dobiješ procenu, ili unesi ručno."}
      </Text>

      {GlasSnimac && !analyzing && <GlasSnimac onRezultat={primeni} autoStart={odmah === "glas"} />}

      {analyzing ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 24 }} />
      ) : (
        <View style={styles.photoRow}>
          <TouchableOpacity style={[common.secondaryButton, styles.photoBtn]} onPress={takePhoto}>
            <Text style={common.secondaryButtonText}>Slikaj</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[common.secondaryButton, styles.photoBtn]} onPress={pickFromGallery}>
            <Text style={common.secondaryButtonText}>Iz galerije</Text>
          </TouchableOpacity>
        </View>
      )}

      {!analyzing && (
        <TouchableOpacity
          style={[common.secondaryButton, { marginBottom: 20 }]}
          onPress={() => router.replace({ pathname: "/skener", params: { datum, obrok_tip } })}
        >
          <Text style={common.secondaryButtonText}>Skeniraj bar-kod sa pakovanja</Text>
        </TouchableOpacity>
      )}

      <Text style={typography.label}>Naziv</Text>
      <TextInput
        style={common.input}
        value={naziv}
        onChangeText={setNaziv}
        placeholder="npr. Pasta sa piletinom"
        placeholderTextColor={colors.textSecondary}
      />
      {naziv.trim().length > 2 && !kalorije.trim() && (
        <TouchableOpacity style={[common.outlineButton, { marginBottom: 12 }]} onPress={proceniNaziv} disabled={procenjujem}>
          <Text style={common.outlineButtonText}>{procenjujem ? "Računam..." : "Izračunaj kalorije iz naziva"}</Text>
        </TouchableOpacity>
      )}

      <Text style={typography.label}>Kalorije</Text>
      <TextInput
        style={common.input}
        value={kalorije}
        onChangeText={setKalorije}
        keyboardType="numeric"
        placeholder="npr. 650"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={typography.label}>Proteini (g, nije obavezno)</Text>
      <TextInput
        style={common.input}
        value={proteini}
        onChangeText={setProteini}
        keyboardType="numeric"
        placeholder="npr. 35"
        placeholderTextColor={colors.textSecondary}
      />

      {glas && (
        <View style={[common.card, { marginTop: 12 }]}>
          {!!glas.tekst && <Text style={[typography.bodySecondary, { marginBottom: 6 }]}>Čuo sam: „{glas.tekst}“</Text>}
          {glas.stavke.map((s, i) => (
            <View key={i} style={styles.stavka}>
              <Text style={[typography.body, { flex: 1 }]}>{s.naziv}</Text>
              <Text style={styles.stavkaKcal}>
                {s.kalorije} kcal{s.proteini_g != null ? ` · ${Math.round(s.proteini_g)} g P` : ""}
              </Text>
            </View>
          ))}
          <Text style={styles.note}>Ovo je procena. Ispravi broj ako ne odgovara. Tekst se šalje na procenu (Anthropic API), snimak se ne čuva.</Text>
        </View>
      )}

      {info && (
        <Text style={styles.note}>
          Procena sa slike
          {info.kalorije_min != null && info.kalorije_max != null
            ? `: oko ${info.kalorije_min} do ${info.kalorije_max} kcal`
            : ""}
          , pouzdanost {info.pouzdanost || "niska"}. Ispravi vrednost ako ne odgovara. Slika se šalje na analizu
          (Anthropic API), a aplikacija je ne čuva.
        </Text>
      )}

      <TouchableOpacity style={[common.primaryButton, { marginTop: 24 }]} onPress={confirm} disabled={saving}>
        <Text style={common.primaryButtonText}>{saving ? "Čuvam..." : "Potvrdi"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  photoBtn: { flex: 1 },
  note: { fontSize: 12, color: colors.textSecondary, marginTop: 12, lineHeight: 18 },
  stavka: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  stavkaKcal: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.bold },
});