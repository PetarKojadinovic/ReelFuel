import { useCallback, useEffect, useState } from "react";
import { ScrollView, RefreshControl } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { colors } from "../../theme";
import { common } from "../../styles/common";
import { ScreenTitle, Segment } from "../../components/ui";
import Raspored from "../../components/trening/Raspored";
import MojeVezbe from "../../components/trening/MojeVezbe";

type Deo = "raspored" | "vezbe";

export default function TreningScreen() {
  const params = useLocalSearchParams<{ deo?: string }>();
  const [deo, setDeo] = useState<Deo>("raspored");
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (params.deo === "raspored" || params.deo === "vezbe") setDeo(params.deo);
  }, [params.deo]);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <ScrollView
      style={common.container}
      contentContainerStyle={common.screenPadding}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <ScreenTitle title="Trening" />
      <Segment<Deo>
        value={deo}
        onChange={setDeo}
        options={[
          { value: "raspored", label: "Raspored" },
          { value: "vezbe", label: "Moje vežbe" },
        ]}
      />
      {deo === "raspored" ? <Raspored refreshKey={refreshKey} /> : <MojeVezbe refreshKey={refreshKey} />}
    </ScrollView>
  );
}
