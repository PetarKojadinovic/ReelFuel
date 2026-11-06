import { ScrollView, View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { common, typography } from "../styles/common";
import { Card, DetailHeader, StatCard } from "../components/ui";

export default function ExerciseResultScreen() {
  const { exercise: exerciseParam } = useLocalSearchParams();

  let exercise: any = {};
  try {
    exercise = JSON.parse(exerciseParam as string) || {};
  } catch {
    exercise = {};
  }

  return (
    <ScrollView style={common.container} contentContainerStyle={common.stackPadding}>
      <DetailHeader icon="barbell-outline" eyebrow="Vežba" title={exercise.naziv_vezbe || "Nepoznata vežba"} />

      <View style={common.row}>
        <StatCard label="Serije i ponavljanja" value={exercise.serije_i_ponavljanja || "—"} />
        {exercise.detektovano_ponavljanja != null ? (
          <StatCard label="Izbrojano (AI)" value={exercise.detektovano_ponavljanja} />
        ) : null}
      </View>

      {exercise.grupa_misica ? (
        <Card>
          <Text style={typography.bodySecondary}>Grupa mišića</Text>
          <Text style={typography.bodyStrong}>{exercise.grupa_misica}</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}
