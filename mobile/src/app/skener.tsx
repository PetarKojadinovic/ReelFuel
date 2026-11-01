import { useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { requireOptionalNativeModule } from "expo";
import type * as CameraT from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { getProizvod, procitajEtiketu, danAkcija, addLogEntry, type Proizvod } from "../services/api";
import { getTodayDate } from "../utils/date";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

type Faza = "skeniram" | "trazim" | "nadjen" | "nije_nadjen" | "citam";

const BARKOD_TIPOVI = ["ean13", "ean8", "upc_a", "upc_e", "qr"] as const;

/** Iz skeniranog koda izvuci bar-kod proizvoda (EAN/UPC, ili GTIN iz GS1 QR koda). */
function izvuciBarkod(r: BarcodeScanningResult): string | null {
  const data = (r.data || "").trim();
  if (/^\d{8,14}$/.test(data)) return data;
  // GS1 Digital Link QR: https://.../01/<14 cifara>/...  ili (01)<14 cifara>
  const m = data.match(/(?:\/01\/|\(01\)|^01)(\d{14})/);
  // GTIN-14 sa vodećom nulom = EAN-13 (tako ga čuva Open Food Facts)
  if (m) return m[1].startsWith("0") ? m[1].slice(1) : m[1];
  return null;
}

// Kameru učitavamo samo ako postoji u instaliranoj verziji aplikacije.
// Stari build bez expo-camera bi inače pukao već pri pokretanju (Expo Router u dev režimu učita sve ekrane).
const kameraDostupna = Platform.OS !== "web" && !!requireOptionalNativeModule("ExpoCamera");
const Kamera: typeof CameraT | null = kameraDostupna ? require("expo-camera") : null;

export default function SkenerScreen() {
  if (Platform.OS === "web") {
    return (
      <View style={[common.centered, { padding: 24 }]}>
        <Text style={[typography.body, { textAlign: "center" }]}>Skeniranje bar-koda radi samo u aplikaciji na telefonu.</Text>
      </View>
    );
  }
  if (!Kamera) {
    return (
      <View style={[common.centered, { padding: 24 }]}>
        <Text style={[typography.body, { textAlign: "center" }]}>
          Za skeniranje treba nova verzija aplikacije (novi development build). Instaliraj novi APK pa probaj ponovo.
        </Text>
      </View>
    );
  }
  return <Skener kamera={Kamera} />;
}

function Skener({ kamera }: { kamera: typeof CameraT }) {
  const { CameraView, useCameraPermissions } = kamera;
  const params = useLocalSearchParams<{ datum?: string; obrok_tip?: string }>();
  const datum = params.datum || getTodayDate();
  const obrokTip = params.obrok_tip;

  const [permission, requestPermission] = useCameraPermissions();
  const [faza, setFaza] = useState<Faza>("skeniram");
  const [barkod, setBarkod] = useState("");
  const [proizvod, setProizvod] = useState<Proizvod | null>(null);
  const [grami, setGrami] = useState("");
  const [nazivRucno, setNazivRucno] = useState("");
  const [saving, setSaving] = useState(false);
  const zakljucano = useRef(false);

  const traziProizvod = async (kod: string) => {
    setBarkod(kod);
    setFaza("trazim");
    try {
      const p = await getProizvod(kod);
      if (p.pronadjen) {
        setProizvod(p);
        setGrami(String(p.porcija_g ? Math.round(p.porcija_g) : 100));
        setFaza("nadjen");
      } else {
        setFaza("nije_nadjen");
      }
    } catch (e: any) {
      Alert.alert("Greška", e?.message || "Ne mogu da dobijem podatke sa servera.");
      skenirajPonovo();
    }
  };

  const onScanned = (r: BarcodeScanningResult) => {
    if (zakljucano.current) return;
    const kod = izvuciBarkod(r);
    if (!kod) {
      zakljucano.current = true;
      Alert.alert("Nepoznat kod", "Ovaj QR kod ne sadrži bar-kod proizvoda. Skeniraj bar-kod (crtice) na pakovanju.", [
        { text: "OK", onPress: () => (zakljucano.current = false) },
      ]);
      return;
    }
    zakljucano.current = true;
    traziProizvod(kod);
  };

  const skenirajPonovo = () => {
    setProizvod(null);
    setBarkod("");
    setGrami("");
    setNazivRucno("");
    setFaza("skeniram");
    zakljucano.current = false;
  };

  const slikajEtiketu = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Dozvola", "Za slikanje tabele treba dozvola za kameru.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], base64: true, quality: 0.6 });
      const b64 = res.canceled ? null : res.assets?.[0]?.base64;
      if (!b64) return;
      setFaza("citam");
      const p = await procitajEtiketu(barkod, b64, nazivRucno.trim() || undefined);
      if (p.pronadjen) {
        setProizvod(p);
        setGrami(String(p.porcija_g ? Math.round(p.porcija_g) : 100));
        setFaza("nadjen");
      } else {
        Alert.alert("Nije pročitano", "Na slici ne vidim kalorije. Slikaj tabelu nutritivnih vrednosti izbliza i oštro.");
        setFaza("nije_nadjen");
      }
    } catch (e: any) {
      Alert.alert("Greška", e?.message || "Čitanje nije uspelo.");
      setFaza("nije_nadjen");
    }
  };

  const g = parseFloat(grami.replace(",", "."));
  const kcal = proizvod?.kcal_100g && g > 0 ? Math.round((proizvod.kcal_100g * g) / 100) : null;

  const sacuvaj = async () => {
    if (!proizvod || kcal == null || !(g > 0) || kcal > 5000) {
      Alert.alert("Greška", "Unesi koliko grama si pojeo.");
      return;
    }
    const naziv = `${proizvod.naziv || "Proizvod"} (${Math.round(g)} g)`;
    setSaving(true);
    try {
      if (obrokTip) {
        await danAkcija(datum, obrokTip, { akcija: "zamena", naziv, kalorije: kcal });
      } else {
        await addLogEntry({ datum, naziv, kalorije: kcal, izvor: "slobodan" });
      }
      router.replace("/dnevnik");
    } catch {
      Alert.alert("Greška", "Nije uspelo čuvanje.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- prikazi ----------

  if (!permission) {
    return (
      <View style={common.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[common.centered, { padding: 24 }]}>
        <Text style={[typography.body, { textAlign: "center", marginBottom: 20 }]}>
          Za skeniranje bar-koda treba dozvola za kameru.
        </Text>
        <TouchableOpacity style={[common.primaryButton, { alignSelf: "stretch" }]} onPress={requestPermission}>
          <Text style={common.primaryButtonText}>Dozvoli kameru</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (faza === "skeniram") {
    return (
      <View style={common.container}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...BARKOD_TIPOVI] }}
          onBarcodeScanned={onScanned}
        />
        <View style={styles.okvir} pointerEvents="none" />
        <View style={styles.uputstvo}>
          <Text style={styles.uputstvoText}>Usmeri kameru na bar-kod sa pakovanja</Text>
          <TouchableOpacity onPress={() => router.replace({ pathname: "/zamena", params: { datum, obrok_tip: obrokTip } })}>
            <Text style={[styles.uputstvoText, { textDecorationLine: "underline", marginTop: 10 }]}>Unesi ručno</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (faza === "trazim" || faza === "citam") {
    return (
      <View style={common.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[typography.bodySecondary, { marginTop: 16 }]}>
          {faza === "trazim" ? "Tražim proizvod..." : "Čitam tabelu sa slike..."}
        </Text>
      </View>
    );
  }

  if (faza === "nije_nadjen") {
    return (
      <ScrollView style={common.container} contentContainerStyle={{ padding: 20 }}>
        <Text style={[typography.title, { marginBottom: 8 }]}>Proizvod nije u bazi</Text>
        <Text style={[typography.bodySecondary, { marginBottom: 20 }]}>
          Bar-kod {barkod}. Slikaj tabelu nutritivnih vrednosti sa pakovanja, a ja ću pročitati kalorije i zapamtiti
          proizvod za sledeći put.
        </Text>
        <Text style={typography.label}>Naziv proizvoda (opciono)</Text>
        <TextInput
          style={common.input}
          value={nazivRucno}
          onChangeText={setNazivRucno}
          placeholder="npr. Plazma keks"
          placeholderTextColor={colors.textSecondary}
        />
        <TouchableOpacity style={[common.primaryButton, { marginTop: 16 }]} onPress={slikajEtiketu}>
          <Text style={common.primaryButtonText}>📷 Slikaj tabelu</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[common.secondaryButton, { marginTop: 12 }]}
          onPress={() => router.replace({ pathname: "/zamena", params: { datum, obrok_tip: obrokTip } })}
        >
          <Text style={common.secondaryButtonText}>Unesi ručno</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 16, alignItems: "center" }} onPress={skenirajPonovo}>
          <Text style={typography.bodySecondary}>↩︎ Skeniraj ponovo</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // faza === "nadjen"
  const opcije: { label: string; g: number }[] = [];
  if (proizvod?.porcija_g) opcije.push({ label: `1 porcija (${Math.round(proizvod.porcija_g)} g)`, g: proizvod.porcija_g });
  opcije.push({ label: "50 g", g: 50 }, { label: "100 g", g: 100 });
  if (proizvod?.paket_g) opcije.push({ label: `Ceo paket (${Math.round(proizvod.paket_g)} g)`, g: proizvod.paket_g });

  return (
    <ScrollView style={common.container} contentContainerStyle={{ padding: 20 }}>
      <View style={common.card}>
        <Text style={[typography.body, { fontWeight: "800", fontSize: 18 }]}>{proizvod?.naziv}</Text>
        <Text style={[typography.bodySecondary, { marginTop: 4 }]}>
          {proizvod?.kcal_100g} kcal / 100 g ·{" "}
          {proizvod?.izvor === "etiketa" ? "pročitano sa pakovanja" : "Open Food Facts"}
        </Text>
      </View>

      <Text style={typography.label}>Koliko si pojeo?</Text>
      <View style={styles.opcije}>
        {opcije.map((o) => {
          const active = Math.round(g) === Math.round(o.g);
          return (
            <TouchableOpacity
              key={o.label}
              style={[styles.opcija, active && styles.opcijaActive]}
              onPress={() => setGrami(String(Math.round(o.g)))}
            >
              <Text style={[styles.opcijaText, active && styles.opcijaTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={typography.label}>Grama</Text>
      <TextInput style={common.input} value={grami} onChangeText={setGrami} keyboardType="numeric" />

      <View style={[common.card, { alignItems: "center", marginTop: 8 }]}>
        <Text style={styles.kcal}>{kcal ?? "—"} kcal</Text>
        <Text style={typography.bodySecondary}>
          {obrokTip ? "upisaće se umesto planiranog obroka" : "dodaje se u današnji dnevnik"}
        </Text>
      </View>

      <TouchableOpacity style={[common.primaryButton, { marginTop: 16 }]} onPress={sacuvaj} disabled={saving}>
        <Text style={common.primaryButtonText}>{saving ? "Čuvam..." : "Upiši u dnevnik"}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ marginTop: 16, alignItems: "center" }} onPress={skenirajPonovo}>
        <Text style={typography.bodySecondary}>↩︎ Skeniraj drugi proizvod</Text>
      </TouchableOpacity>
      <Text style={styles.napomena}>
        Kalorije su sa pakovanja ili iz otvorene baze Open Food Facts i mogu se razlikovati od stvarnih.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  okvir: {
    position: "absolute",
    top: "30%",
    left: "10%",
    right: "10%",
    height: 160,
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: 16,
  },
  uputstvo: { position: "absolute", bottom: 60, left: 20, right: 20, alignItems: "center" },
  uputstvoText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    textShadowColor: "#000",
    textShadowRadius: 6,
  },
  opcije: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opcija: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  opcijaActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  opcijaText: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },
  opcijaTextActive: { color: colors.background },
  kcal: { fontSize: 30, fontWeight: "800", color: colors.primary },
  napomena: { fontSize: 12, color: colors.textSecondary, marginTop: 20, lineHeight: 18 },
});
