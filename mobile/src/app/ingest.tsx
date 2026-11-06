import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { startIngest, getIngestJob, saveIngestJob, odbaciIngestJob } from "../services/api";
import { colors } from "../theme";
import { common, typography } from "../styles/common";
import { Card, DetailHeader, Message, StatCard, TextButton } from "../components/ui";

const TIMEOUT_MS = 10 * 60 * 1000;

export default function IngestScreen() {
  // url = novi link za obradu; job_id = otvaranje postojece obrade iz liste "Spremno za pregled"
  const { url, job_id } = useLocalSearchParams<{ url?: string; job_id?: string }>();
  const [job, setJob] = useState<any>({ status: "u_toku", faza: "Šaljem link" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const startedFor = useRef<string | null>(null);
  const alive = useRef(true);

  const poll = async (id: string) => {
    const started = Date.now();
    while (alive.current) {
      const j = await getIngestJob(id);
      setJob({ ...j, id });
      if (j.status !== "u_toku") break;
      if (Date.now() - started > TIMEOUT_MS) throw new Error("Obrada predugo traje (timeout)");
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  const run = async (tip?: "recept" | "vezba") => {
    const link = url || job.url;
    setError(null);
    setJob({ status: "u_toku", faza: "Šaljem link" });
    try {
      if (!link) throw new Error("Nema linka za obradu");
      const r = await startIngest(link, tip);
      await poll(r.job_id);
    } catch (e: any) {
      console.log("INGEST GRESKA:", e?.message, e);
      if (alive.current) setError(`Greška: ${e?.message || "nepoznata"}`);
    }
  };

  const otvori = async (id: string) => {
    setError(null);
    try {
      await poll(id);
    } catch (e: any) {
      if (alive.current) setError(`Greška: ${e?.message || "nepoznata"}`);
    }
  };

  useEffect(() => {
    alive.current = true;
    const key = job_id ? `job:${job_id}` : url ? `url:${url}` : null;
    if (key && startedFor.current !== key) {
      startedFor.current = key;
      if (job_id) otvori(job_id);
      else run();
    }
    return () => {
      alive.current = false;
    };
  }, [url, job_id]);

  const handleOdbaci = async () => {
    try {
      if (job.id) await odbaciIngestJob(job.id);
    } catch {
      // nije bitno ako ne uspe - stavka ostaje u listi za pregled
    }
    router.back();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await saveIngestJob(job.id);
      if (r.tip === "recept") {
        router.replace({ pathname: "/dodaj-u-plan", params: { recipe_id: String(r.id) } });
      } else {
        router.navigate({ pathname: "/trening", params: { deo: "vezbe" } });
      }
    } catch {
      Alert.alert("Greška", "Nije uspelo čuvanje.");
    } finally {
      setSaving(false);
    }
  };

  if (error || job.status === "greska") {
    return (
      <Message
        icon="alert-circle-outline"
        iconColor={colors.warning}
        title="Nije uspelo"
        text={error || job.greska}
        action="Pokušaj ponovo"
        onAction={() => run()}
      />
    );
  }

  if (job.status === "potrebna_odluka") {
    return (
      <Message
        icon="help-circle-outline"
        title="Šta je ovo?"
        text="Nisam siguran da li je video recept ili vežba."
        action="Recept"
        onAction={() => run("recept")}
        secondary="Vežba"
        onSecondary={() => run("vezba")}
      />
    );
  }

  if (job.status === "gotovo" && job.rezultat) {
    const r = job.rezultat;
    const recept = job.tip === "recept";
    return (
      <ScrollView style={common.container} contentContainerStyle={common.stackPadding}>
        {recept ? (
          <>
            <DetailHeader icon="restaurant-outline" eyebrow="Recept" title={r.naziv_jela || "Recept"} />
            {(r.priblizne_kalorije || r.proteini_g != null) && (
              <View style={common.row}>
                {r.priblizne_kalorije ? <StatCard label="Kalorije" value={r.priblizne_kalorije} /> : null}
                {r.proteini_g != null ? <StatCard label="Proteini" value={Math.round(r.proteini_g)} unit="g" /> : null}
              </View>
            )}
            <Card>
              <Text style={[typography.heading, { marginBottom: 10 }]}>Sastojci</Text>
              {(r.sastojci ?? []).length === 0 ? (
                <Text style={typography.bodySecondary}>Sastojci nisu izvučeni iz videa.</Text>
              ) : (
                (r.sastojci ?? []).map((s: any, i: number) => (
                  <Text key={i} style={typography.listItem}>
                    • {s.kolicina} {s.naziv}
                  </Text>
                ))
              )}
            </Card>
          </>
        ) : (
          <>
            <DetailHeader icon="barbell-outline" eyebrow="Vežba" title={r.naziv_vezbe || "Vežba"} />
            <View style={common.row}>
              <StatCard label="Serije i ponavljanja" value={r.serije_i_ponavljanja || "—"} />
              {r.detektovano_ponavljanja != null ? <StatCard label="Izbrojano (AI)" value={r.detektovano_ponavljanja} /> : null}
            </View>
            {r.grupa_misica ? (
              <Card>
                <Text style={typography.bodySecondary}>Grupa mišića</Text>
                <Text style={typography.bodyStrong}>{r.grupa_misica}</Text>
              </Card>
            ) : null}
          </>
        )}
        <Text style={[typography.note, { marginBottom: 16 }]}>Izvučeno automatski, može da sadrži greške.</Text>
        <TouchableOpacity style={common.primaryButton} onPress={handleSave} disabled={saving}>
          <Text style={common.primaryButtonText}>{saving ? "Čuvam..." : "Sačuvaj"}</Text>
        </TouchableOpacity>
        <TextButton title="Odbaci" onPress={handleOdbaci} />
      </ScrollView>
    );
  }

  return (
    <Message
      loading
      title={job.faza || "Obrađujem..."}
      text={"Možeš da izađeš — rezultat će te čekati na početnoj, u „Novo iz linkova“."}
    />
  );
}
