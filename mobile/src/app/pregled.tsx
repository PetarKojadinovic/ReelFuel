import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getIngestPregled, saveIngestJob, odbaciIngestJob, PregledStavka } from "../services/api";
import { colors } from "../theme";
import { common, typography, spacing } from "../styles/common";

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

function ikona(s: PregledStavka): string {
  if (s.status === "greska") return "⚠️";
  if (s.status === "u_toku") return "⏳";
  if (s.status === "potrebna_odluka") return "❓";
  return s.tip === "recept" ? "🍳" : "💪";
}

export default function PregledScreen() {
  const [stavke, setStavke] = useState<PregledStavka[]>([]);
  const [loading, setLoading] = useState(true);
  const [radi, setRadi] = useState<string | null>(null); // id stavke koja se cuva/odbacuje, ili "sve"
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getIngestPregled();
      setStavke(data);
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

  if (loading) {
    return (
      <View style={common.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={common.container}
      data={stavke}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <>
          <Text style={[typography.bodySecondary, { marginBottom: spacing.md }]}>
            Sve što je stiglo preko linka čeka ovde. ✓ čuva u biblioteku, ✕ odbacuje. Dodirni stavku za detalje.
          </Text>
          {spremne.length > 1 && (
            <TouchableOpacity
              style={[common.primaryButton, { marginBottom: spacing.md }]}
              onPress={sacuvajSve}
              disabled={radi !== null}
            >
              <Text style={common.primaryButtonText}>
                {radi === "sve" ? "Čuvam..." : `✓ Sačuvaj sve spremno (${spremne.length})`}
              </Text>
            </TouchableOpacity>
          )}
        </>
      }
      ListEmptyComponent={<Text style={common.emptyText}>Ništa ne čeka pregled. Podeli reel u ReelFuel!</Text>}
      renderItem={({ item }) => {
        const zauzeto = radi === item.id || radi === "sve";
        return (
          <TouchableOpacity
            style={[common.card, styles.card]}
            onPress={() => router.push({ pathname: "/ingest", params: { job_id: item.id } })}
          >
            <Text style={styles.ikona}>{ikona(item)}</Text>
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
                  <TouchableOpacity style={styles.ok} onPress={() => sacuvaj(item)}>
                    <Text style={styles.okText}>✓</Text>
                  </TouchableOpacity>
                )}
                {item.status !== "u_toku" && (
                  <TouchableOpacity style={styles.ne} onPress={() => odbaci(item)}>
                    <Text style={styles.neText}>✕</Text>
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
  ikona: { fontSize: 24 },
  naziv: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 },
  dugmad: { flexDirection: "row", gap: 8 },
  ok: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  okText: { fontSize: 18, fontWeight: "800", color: colors.background },
  ne: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  neText: { fontSize: 16, fontWeight: "800", color: colors.danger },
});
