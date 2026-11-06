import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { requireOptionalNativeModule } from "expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addWeightEntry } from "../services/api";
import { izvuciPodrzanLink, podrzanLinkIzClipboarda, zapamtiLink } from "../services/clipboardLink";
import { getTodayDate } from "../utils/date";
import { colors, fonts } from "../theme";
import { common, typography } from "../styles/common";
import { Icon, IconName } from "../components/ui";

// Unos glasom samo ako instalirani build ima expo-audio
const glasDostupan = Platform.OS !== "web" && !!requireOptionalNativeModule("ExpoAudio");

/** Panel "Šta dodaješ?" — otvara ga dugme + u donjem meniju. Jedno mesto za sav unos. */
export default function DodajSheet() {
  const insets = useSafeAreaInsets();
  const today = getTodayDate();
  const [clipLink, setClipLink] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [tezina, setTezina] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    podrzanLinkIzClipboarda().then(setClipLink).catch(() => {});
  }, []);

  const zatvori = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const obradi = (url: string) => {
    zapamtiLink(url);
    router.replace({ pathname: "/ingest", params: { url } });
  };

  const obradiUneti = () => {
    const url = izvuciPodrzanLink(link.trim());
    if (!url) {
      Alert.alert("Link", "Nalepi link sa Instagrama ili TikToka (npr. instagram.com/reel/...).");
      return;
    }
    obradi(url);
  };

  const sacuvajTezinu = async () => {
    const t = parseFloat((tezina ?? "").replace(",", "."));
    if (!(t > 20 && t < 400)) {
      Alert.alert("Težina", "Upiši težinu u kilogramima, npr. 81,5");
      return;
    }
    setSaving(true);
    try {
      await addWeightEntry({ datum: today, tezina_kg: t });
      zatvori();
    } catch {
      Alert.alert("Greška", "Nije sačuvano. Proveri vezu sa laptopom.");
    } finally {
      setSaving(false);
    }
  };

  const Tile = ({ icon, title, text, onPress }: { icon: IconName; title: string; text: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.tile} onPress={onPress}>
      <Icon name={icon} size={30} color={colors.primary} />
      <View>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileText}>{text}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Pressable style={styles.overlay} onPress={zatvori} accessibilityLabel="Zatvori">
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={common.rowBetween}>
            <Text style={[typography.heading, { fontSize: 24 }]}>Šta dodaješ?</Text>
            <TouchableOpacity onPress={zatvori} style={{ padding: 6 }} accessibilityLabel="Zatvori">
              <Icon name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {clipLink && (
            <View style={[common.highlightCard, { marginTop: 14, gap: 10 }]}>
              <Text style={[typography.bodySecondary, { color: colors.highlightText, fontFamily: fonts.bold }]}>Našao sam link koji si kopirao</Text>
              <Text style={typography.bodyStrong} numberOfLines={1}>{clipLink.replace(/^https?:\/\/(www\.)?/, "")}</Text>
              <TouchableOpacity style={[common.primaryButton, { minHeight: 48 }]} onPress={() => obradi(clipLink)}>
                <Text style={common.primaryButtonText}>Napravi recept ili vežbu od ovoga</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[common.row, { marginTop: 14 }]}>
            <TextInput
              style={[common.input, { flex: 1, marginBottom: 0 }]}
              value={link}
              onChangeText={setLink}
              placeholder="Nalepi link reela"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onSubmitEditing={obradiUneti}
              returnKeyType="go"
            />
            <TouchableOpacity style={[common.primaryButton, { paddingHorizontal: 18 }]} onPress={obradiUneti} accessibilityLabel="Obradi link">
              <Icon name="arrow-forward" size={22} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>

          {glasDostupan && (
          <TouchableOpacity
            style={[common.primaryButton, { flexDirection: "row", gap: 10, minHeight: 56, marginTop: 14 }]}
            onPress={() => router.replace({ pathname: "/zamena", params: { datum: today, odmah: "glas" } })}
            accessibilityLabel="Reci šta si jeo"
          >
            <Icon name="mic-outline" size={24} color={colors.onPrimary} />
            <Text style={common.primaryButtonText}>Reci šta si jeo</Text>
          </TouchableOpacity>
          )}

          <View style={styles.grid}>
            <Tile icon="camera-outline" title="Slikaj obrok" text="Procena kalorija sa slike" onPress={() => router.replace({ pathname: "/zamena", params: { datum: today, odmah: "slika" } })} />
            <Tile icon="barcode-outline" title="Bar-kod" text="Skeniraj pakovanje" onPress={() => router.replace({ pathname: "/skener", params: { datum: today } })} />
            <Tile icon="chatbubble-ellipses-outline" title="Pitaj" text={'„Pojeo sam pljeskavicu"'} onPress={() => router.replace("/chat")} />
            <Tile icon="create-outline" title="Upiši ručno" text="Naziv i kalorije" onPress={() => router.replace({ pathname: "/zamena", params: { datum: today } })} />
          </View>

          {tezina == null ? (
            <TouchableOpacity style={common.outlineButton} onPress={() => setTezina("")}>
              <Icon name="scale-outline" size={20} />
              <Text style={common.outlineButtonText}>Upiši današnju težinu</Text>
            </TouchableOpacity>
          ) : (
            <View style={common.row}>
              <TextInput
                style={[common.input, { flex: 1, marginBottom: 0 }]}
                value={tezina}
                onChangeText={setTezina}
                placeholder="Težina u kg, npr. 81,5"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                autoFocus
              />
              <TouchableOpacity style={[common.primaryButton, { paddingHorizontal: 18 }]} onPress={sacuvajTezinu} disabled={saving}>
                <Text style={[common.primaryButtonText, { fontSize: 15 }]}>{saving ? "..." : "Sačuvaj"}</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: "center", marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginVertical: 14 },
  tile: {
    width: "47.5%",
    flexGrow: 1,
    minHeight: 120,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    padding: 16,
    justifyContent: "space-between",
  },
  tileTitle: { fontSize: 16, fontFamily: fonts.black, color: colors.textPrimary },
  tileText: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
});
