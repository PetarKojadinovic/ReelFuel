import { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, Image, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { colors } from "../theme";
import { common, typography, radius, spacing } from "../styles/common";
import { Card, DetailHeader, StatCard, Icon, TextButton } from "../components/ui";
import { getExerciseDetails, searchExerciseCatalog, setExerciseCatalog, getCatalogByName, setCatalogByName } from "../services/api";

type Katalog = {
  id: string;
  naziv: string;
  naziv_en: string;
  glavni_misici: string[];
  sporedni_misici: string[];
  oprema?: string | null;
  nivo?: string | null;
  kategorija?: string | null;
  koraci: string[];
  slike: string[];
};

type Rezultat = { id: string; naziv_en: string; glavni_misici: string[]; oprema?: string | null; slika?: string | null };

export default function ExerciseResultScreen() {
  const { exercise: exerciseParam } = useLocalSearchParams();

  let pocetna: any = {};
  try {
    pocetna = JSON.parse(exerciseParam as string) || {};
  } catch {
    pocetna = {};
  }
  // Sačuvana vežba ima id; vežba iz plana treninga ima samo naziv (pa se opis traži po nazivu)
  const id: number | undefined = typeof pocetna.id === "number" ? pocetna.id : undefined;
  const naziv: string = typeof pocetna.naziv_vezbe === "string" ? pocetna.naziv_vezbe.trim() : "";
  const moze = id != null || naziv !== "";

  const [exercise, setExercise] = useState<any>(pocetna);
  const [katalog, setKatalog] = useState<Katalog | null>(null);
  const [ucitava, setUcitava] = useState(moze);
  const [greska, setGreska] = useState(false);
  const [biram, setBiram] = useState(false);

  const primeni = (d: any) => {
    if (d?.exercise) setExercise(d.exercise);
    setKatalog(d?.katalog ?? null);
    setGreska(!!d?.greska_povezivanja);
  };

  const ucitaj = useCallback(async () => {
    if (!moze) return;
    setUcitava(true);
    try {
      if (id != null) {
        try {
          primeni(await getExerciseDetails(id));
          return;
        } catch (e) {
          if (!naziv) throw e; // npr. vežba obrisana iz "Moje vežbe" -> probaj po nazivu
        }
      }
      primeni(await getCatalogByName(naziv, pocetna.grupa_misica));
    } catch {
      setGreska(true);
    } finally {
      setUcitava(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, naziv, moze]);

  useEffect(() => {
    ucitaj();
  }, [ucitaj]);

  const izaberi = async (katalogId: string | null) => {
    if (!moze) return;
    setUcitava(true);
    setBiram(false);
    try {
      primeni(id != null ? await setExerciseCatalog(id, katalogId) : await setCatalogByName(naziv, katalogId));
    } catch {
      Alert.alert("Greška", "Izbor nije sačuvan. Proveri vezu sa laptopom.");
    } finally {
      setUcitava(false);
    }
  };

  return (
    <ScrollView style={common.container} contentContainerStyle={common.stackPadding} keyboardShouldPersistTaps="handled">
      <DetailHeader icon="barbell-outline" eyebrow="Vežba" title={exercise.naziv_vezbe || "Nepoznata vežba"} />

      <View style={common.row}>
        <StatCard label="Serije i ponavljanja" value={exercise.serije_i_ponavljanja || "—"} />
        {exercise.detektovano_ponavljanja != null ? (
          <StatCard label="Izbrojano (AI)" value={exercise.detektovano_ponavljanja} />
        ) : null}
      </View>

      {!katalog && exercise.grupa_misica ? (
        <Card>
          <Text style={typography.bodySecondary}>Grupa mišića</Text>
          <Text style={typography.bodyStrong}>{exercise.grupa_misica}</Text>
        </Card>
      ) : null}

      {ucitava ? (
        <Card style={styles.centerRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={typography.bodySecondary}>Tražim opis vežbe...</Text>
        </Card>
      ) : biram ? (
        <Biranje onIzbor={izaberi} onOdustani={() => setBiram(false)} pocetniUpit={katalog?.naziv_en ?? ""} />
      ) : katalog ? (
        <Opis katalog={katalog} onPromeni={() => setBiram(true)} />
      ) : moze ? (
        <Card>
          <Text style={typography.bodyStrong}>{greska ? "Ne mogu da nađem opis" : "Nema je u katalogu"}</Text>
          <Text style={[typography.bodySecondary, { marginTop: 4 }]}>
            {greska ? "Laptop ili AI ne odgovara. Pokušaj ponovo." : "Možeš sam da potražiš sličnu vežbu (naziv na engleskom)."}
          </Text>
          <View style={[common.row, { marginTop: spacing.md }]}>
            {greska ? (
              <TouchableOpacity style={[common.primaryButton, styles.flex]} onPress={ucitaj}>
                <Text style={common.primaryButtonText}>Pokušaj ponovo</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[common.secondaryButton, styles.flex]} onPress={() => setBiram(true)}>
              <Text style={common.secondaryButtonText}>Potraži</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function Opis({ katalog, onPromeni }: { katalog: Katalog; onPromeni: () => void }) {
  const podaci = [katalog.oprema, katalog.nivo, katalog.kategorija].filter(Boolean).join(" · ");
  return (
    <View>
      {katalog.slike.length > 0 && (
        <View style={styles.slike}>
          {katalog.slike.slice(0, 2).map((url, i) => (
            <Image
              key={url}
              source={{ uri: url }}
              style={styles.slika}
              resizeMode="cover"
              accessibilityLabel={i === 0 ? "Početni položaj" : "Krajnji položaj"}
            />
          ))}
        </View>
      )}

      <Card>
        <Text style={typography.eyebrow}>Mišići</Text>
        <View style={[common.chipRow, { marginTop: spacing.sm }]}>
          {katalog.glavni_misici.map((m) => (
            <View key={m} style={[common.badge, styles.misicGlavni]}>
              <Text style={[common.badgeText, { color: colors.onPrimary }]}>{m}</Text>
            </View>
          ))}
          {katalog.sporedni_misici.map((m) => (
            <View key={m} style={common.badge}>
              <Text style={common.badgeText}>{m}</Text>
            </View>
          ))}
        </View>
        {katalog.sporedni_misici.length > 0 && (
          <Text style={[typography.note, { marginTop: spacing.sm }]}>Zeleno: glavni mišići. Ostalo: pomažu.</Text>
        )}
        {podaci ? <Text style={[typography.bodySecondary, { marginTop: spacing.sm }]}>{podaci}</Text> : null}
      </Card>

      <Text style={typography.sectionLabel}>Kako se radi</Text>
      <Card>
        {katalog.koraci.map((k, i) => (
          <View key={i} style={styles.korak}>
            <Text style={styles.korakBroj}>{i + 1}</Text>
            <Text style={[typography.listItem, styles.flex]}>{k}</Text>
          </View>
        ))}
      </Card>

      <Text style={typography.note}>
        {katalog.naziv !== katalog.naziv_en ? `${katalog.naziv} (${katalog.naziv_en}). ` : ""}
        Opis i slike: free-exercise-db (javni domen).
      </Text>
      <TextButton title="Nije ta vežba?" onPress={onPromeni} />
    </View>
  );
}

function Biranje({
  onIzbor,
  onOdustani,
  pocetniUpit,
}: {
  onIzbor: (id: string | null) => void;
  onOdustani: () => void;
  pocetniUpit: string;
}) {
  const [upit, setUpit] = useState(pocetniUpit);
  const [rezultati, setRezultati] = useState<Rezultat[] | null>(null);
  const [trazi, setTrazi] = useState(false);

  useEffect(() => {
    if (!upit.trim()) {
      setRezultati(null);
      return;
    }
    let aktivno = true;
    const t = setTimeout(async () => {
      setTrazi(true);
      try {
        const d = await searchExerciseCatalog(upit.trim());
        if (aktivno) setRezultati(d?.rezultati ?? []);
      } catch {
        if (aktivno) setRezultati([]);
      } finally {
        if (aktivno) setTrazi(false);
      }
    }, 350);
    return () => {
      aktivno = false;
      clearTimeout(t);
    };
  }, [upit]);

  return (
    <View>
      <Text style={typography.sectionLabel}>Izaberi vežbu</Text>
      <TextInput
        style={common.input}
        value={upit}
        onChangeText={setUpit}
        placeholder="npr. squat, bench press, listovi"
        placeholderTextColor={colors.textSecondary}
        autoCorrect={false}
        autoCapitalize="none"
      />
      <Text style={[typography.note, { marginBottom: spacing.sm }]}>Nazivi su na engleskom. Možeš da tražiš i po mišiću.</Text>

      {trazi && <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />}
      {!trazi && rezultati?.length === 0 && <Text style={typography.bodySecondary}>Ništa nije nađeno.</Text>}
      {(rezultati ?? []).map((r) => (
        <TouchableOpacity key={r.id} style={common.option} onPress={() => onIzbor(r.id)}>
          {r.slika ? (
            <Image source={{ uri: r.slika }} style={styles.mala} />
          ) : (
            <View style={styles.mala}>
              <Icon name="barbell-outline" color={colors.primary} />
            </View>
          )}
          <View style={styles.flex}>
            <Text style={typography.bodyStrong} numberOfLines={2}>{r.naziv_en}</Text>
            <Text style={typography.bodySecondary} numberOfLines={1}>
              {[r.glavni_misici.join(", "), r.oprema].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </TouchableOpacity>
      ))}

      <View style={[common.row, { marginTop: spacing.sm }]}>
        <TouchableOpacity style={[common.secondaryButton, styles.flex]} onPress={() => onIzbor(null)}>
          <Text style={common.secondaryButtonText}>Nema je ovde</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[common.secondaryButton, styles.flex]} onPress={onOdustani}>
          <Text style={common.secondaryButtonText}>Odustani</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  slike: { flexDirection: "row", gap: spacing.sm, marginBottom: 10 },
  slika: { flex: 1, aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt },
  mala: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  misicGlavni: { backgroundColor: colors.primary },
  korak: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  korakBroj: { ...typography.bodyStrong, color: colors.primary, width: 20, lineHeight: 22 },
});
