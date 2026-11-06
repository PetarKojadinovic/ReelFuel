import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getIngestPregled, saveIngestJob, odbaciIngestJob, PregledStavka } from "../services/api";
import { colors, fonts } from "../theme";
import { common, typography, spacing } from "../styles/common";
import { EmptyState, Icon, IconTile, Message, type IconName } from "../components/ui";

const OSVEZI_MS = 4000;

function opisStatusa(s: PregledStavka): string {
  switch (s.status) {
    case "u_toku":
      return s.faza || "Obrađujem...";
    case "potrebna_odluka":
      return "Recept ili vežba? Dodirni da izabereš";
    case "greska":
      return s.greska || "Obrada nije uspela";
    default:
      return s.tip === "recept" ? "Recept — spreman" : "Vežba — spremna";
  }
}

function ikona(s: PregledStavka): { name: IconName; color: string } {
  if (s.status === "greska") return { name: "alert-circle-outline", color: colors.warning };
  if (s.status === "u_toku") return { name: "hourglass-outline", color: colors.textSecondary };
  if (s.status === "potrebna_odluka") return { name: "help-circle-outline", color: colors.warning };
  return { name: s.tip === "recept" ? "restaurant-outline" : "barbell-outline", color: colors.primary };
}

export default function PregledScreen() {
  const [stavke, setStavke] = useState<PregledStavka[]>([]);
  const [loading, setLoading] = useState(true);
  const [radi, setRadi] = useState<string | null>(null); // id stavke koja se cuva/odbacuje, ili "sve"
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getIngestPregled();
      setStavke(data ?? []);
    } catch {
      Alert.alert("Greška", "Lista za pregled nije učitana. Proveri vezu sa serverom.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Dok nesto jos traje, osvezavaj listu na par sekundi
  const imaUToku = stavke.some((s) => s.status === "u_toku");
  useEffect(() => {
    if (!imaUToku) return;
    timer.current = setTimeout(load, OSVEZI_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [stavke, imaUToku, load]);

  const sacuvaj = async (s: PregledStavka) => {
    setRadi(s.id);
    try {
      await saveIngestJob(s.id);
      setStavke((prev) => prev.filter((x) => x.id !== s.id));
    } catch {
      Alert.alert("Greška", "Nije uspelo čuvanje.");
    } finally {
      setRadi(null);
    }
  };

  const odbaci = async (s: PregledStavka) => {
    setRadi(s.id);
    try {
      await odbaciIngestJob(s.id);
      setStavke((prev) => prev.filter((x) => x.id !== s.id));
    } catch {
      Alert.alert("Greška", "Nije uspelo odbacivanje.");
    } finally {
      setRadi(null);
    }
  };

  const spremne = stavke.filter((s) => s.status === "gotovo");

  const sacuvajSve = async () => {
    setRadi("sve");
    let neuspelo = 0;
    for (const s of spremne) {
      try {
        await saveIngestJob(s.id);
      } catch {
        neuspelo++;
      }
    }
    setRadi(null);
    await load();
    if (neuspelo > 0) Alert.alert("Greška", `Nije sačuvano: ${neuspelo}`);
  };

  if (loading) return <Message loading />;

  return (
    <FlatList
      style={common.container}
      data={stavke}
      keyExtractor={(s) => s.id}
      contentContainerStyle={common.stackPadding}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        stavke.length > 0 ? (
          <>
            <Text style={[typography.bodySecondary, { marginBottom: spacing.md }]}>
              Sve što je stiglo preko linka čeka ovde. Kvačica čuva u biblioteku, X odbacuje. Dodirni stavku za detalje.
            </Text>
            {spremne.length > 1 && (
              <TouchableOpacity
                style={[common.primaryButton, styles.sveBtn]}
                onPress={sacuvajSve}
                disabled={radi !== null}
              >
                <Icon name="checkmark-done" size={20} color={colors.onPrimary} />
                <Text style={common.primaryButtonText}>
                  {radi === "sve" ? "Čuvam..." : `Sačuvaj sve spremno (${spremne.length})`}
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          icon="file-tray-outline"
          title="Ništa ne čeka pregled"
          text="Podeli reel u ReelFuel ili nalepi link preko dugmeta +."
        />
      }
      renderItem={({ item }) => {
        const zauzeto = radi === item.id || radi === "sve";
        const ik = ikona(item);
        return (
          <TouchableOpacity
            style={[common.card, styles.card]}
            onPress={() => router.push({ pathname: "/ingest", params: { job_id: item.id } })}
          >
            <IconTile icon={ik.name} color={ik.color} />
            <View style={{ flex: 1 }}>
              <Text style={styles.naziv} numberOfLines={2}>
                {item.naziv || item.url}
              </Text>
              <Text style={typography.bodySecondary} numberOfLines={2}>
                {opisStatusa(item)}
              </Text>
            </View>
            {zauzeto ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <View style={styles.dugmad}>
                {item.status === "gotovo" && (
                  <TouchableOpacity
                    style={[common.checkCircle, { backgroundColor: colors.primary }]}
                    onPress={() => sacuvaj(item)}
                    accessibilityLabel="Sačuvaj"
                  >
                    <Icon name="checkmark" size={22} color={colors.onPrimary} />
                  </TouchableOpacity>
                )}
                {item.status !== "u_toku" && (
                  <TouchableOpacity
                    style={[common.checkCircle, { backgroundColor: colors.surfaceAlt }]}
                    onPress={() => odbaci(item)}
                    accessibilityLabel="Odbaci"
                  >
                    <Icon name="close" size={22} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12 },
  naziv: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.textPrimary, marginBottom: 2 },
  dugmad: { flexDirection: "row", gap: 8 },
  sveBtn: { marginBottom: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
