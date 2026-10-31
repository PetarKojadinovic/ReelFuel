import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { startIngest, getIngestJob, saveIngestJob } from "../services/api";
import { colors } from "../theme";
import { common, typography } from "../styles/common";

const TIMEOUT_MS = 10 * 60 * 1000;

export default function IngestScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const [job, setJob] = useState<any>({ status: "u_toku", faza: "Šaljem link" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const startedFor = useRef<string | null>(null);
  const alive = useRef(true);

  const run = async (tip?: "recept" | "vezba") => {
    setError(null);
    setJob({ status: "u_toku", faza: "Šaljem link" });
    try {
      const { job_id } = await startIngest(url as string, tip);
      const started = Date.now();
      while (alive.current) {
        const j = await getIngestJob(job_id);
        setJob({ ...j, id: job_id });
        if (j.status !== "u_toku") break;
        if (Date.now() - started > TIMEOUT_MS) throw new Error("Obrada predugo traje (timeout)");
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (e: any) {
      console.log("INGEST GRESKA:", e?.message, e);
      if (alive.current) setError(`Greška: ${e?.message || "nepoznata"}`);
    }
  };

  useEffect(() => {
    alive.current = true;
    if (url && startedFor.current !== url) {
      startedFor.current = url;
      run();
    }
    return () => {
      alive.current = false;
    };
  }, [url]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await saveIngestJob(job.id);
      if (r.tip === "recept") {
        router.replace({ pathname: "/dodaj-u-plan", params: { recipe_id: String(r.id) } });
      } else {
        router.replace("/exercises");
      }
    } catch {
      Alert.alert("Greška", "Nije uspelo čuvanje.");
    } finally {
      setSaving(false);
    }
  };

  if (error || job.status === "greska") {
    return (
      <View style={[common.centered, { padding: 20 }]}>
        <Text style={[typography.body, { textAlign: "center", marginBottom: 20 }]}>
          {error || job.greska}
        </Text>
        <TouchableOpacity style={common.primaryButton} onPress={() => run()}>
          <Text style={common.primaryButtonText}>Pokušaj ponovo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (job.status === "potrebna_odluka") {
    return (
      <View style={[common.centered, { padding: 20 }]}>
        <Text style={[typography.title, { marginBottom: 8 }]}>Šta je ovo?</Text>
        <Text style={[typography.bodySecondary, { marginBottom: 24, textAlign: "center" }]}>
          Nisam siguran da li je video recept ili vežba.
        </Text>
        <TouchableOpacity
          style={[common.primaryButton, { width: "100%", marginBottom: 12 }]}
          onPress={() => run("recept")}
        >
          <Text style={common.primaryButtonText}>🍳 Recept</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[common.secondaryButton, { width: "100%" }]} onPress={() => run("vezba")}>
          <Text style={common.secondaryButtonText}>💪 Vežba</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (job.status === "gotovo" && job.rezultat) {
    const r = job.rezultat;
    return (
      <ScrollView style={common.container} contentContainerStyle={{ padding: 20 }}>
        {job.tip === "recept" ? (
          <>
            <Text style={[typography.title, { marginBottom: 16 }]}>{r.naziv_jela}</Text>
            <View style={common.card}>
              <Text style={styles.section}>Sastojci</Text>
              {(r.sastojci || []).map((s: any, i: number) => (
                <Text key={i} style={styles.item}>
                  • {s.kolicina} {s.naziv}
                </Text>
              ))}
            </View>
            {r.priblizne_kalorije && <Text style={styles.calories}>Kalorije: {r.priblizne_kalorije}</Text>}
          </>
        ) : (
          <>
            <Text style={[typography.title, { marginBottom: 16 }]}>{r.naziv_vezbe}</Text>
            <View style={common.card}>
              <Text style={styles.item}>Grupa mišića: {r.grupa_misica}</Text>
              <Text style={styles.item}>Serije i ponavljanja: {r.serije_i_ponavljanja}</Text>
              {r.detektovano_ponavljanja != null && (
                <Text style={styles.item}>Detektovano ponavljanja (AI): {r.detektovano_ponavljanja}</Text>
              )}
            </View>
          </>
        )}
        <Text style={[typography.bodySecondary, { marginBottom: 16 }]}>
          Izvučeno automatski, može da sadrži greške.
        </Text>
        <TouchableOpacity style={common.primaryButton} onPress={handleSave} disabled={saving}>
          <Text style={common.primaryButtonText}>{saving ? "Čuvam..." : "Sačuvaj"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 14, alignItems: "center" }} onPress={() => router.back()}>
          <Text style={typography.bodySecondary}>Odbaci</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={[common.centered, { padding: 20 }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[typography.body, { marginTop: 20 }]}>{job.faza || "Obrađujem..."}</Text>
      <Text style={[typography.bodySecondary, { marginTop: 8, textAlign: "center" }]}>
        Ostani na ovom ekranu dok se obrada ne završi.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 16, fontWeight: "700", color: colors.primary, marginBottom: 10 },
  item: { fontSize: 15, color: colors.textPrimary, marginBottom: 6, lineHeight: 22 },
  calories: { fontSize: 16, fontWeight: "700", color: colors.primary, marginBottom: 12 },
});