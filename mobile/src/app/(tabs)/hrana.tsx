import { useCallback, useEffect, useState } from "react";
import { ScrollView, RefreshControl } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { colors } from "../../theme";
import { common } from "../../styles/common";
import { ScreenTitle, Segment } from "../../components/ui";
import Jelovnik from "../../components/hrana/Jelovnik";
import Recepti from "../../components/hrana/Recepti";
import Kupovina from "../../components/hrana/Kupovina";

type Deo = "jelovnik" | "recepti" | "kupovina";

export default function HranaScreen() {
  const params = useLocalSearchParams<{ deo?: string }>();
  const [deo, setDeo] = useState<Deo>("jelovnik");
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Drugi ekrani mogu da otvore tačan deo: router.navigate({ pathname: "/hrana", params: { deo: "kupovina" } })
  useEffect(() => {
    if (params.deo === "jelovnik" || params.deo === "recepti" || params.deo === "kupovina") setDeo(params.deo);
  }, [params.deo]);

  // Osveži podatke kad se vratiš na tab (npr. posle čuvanja recepta)
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
      <ScreenTitle title="Hrana" />
      <Segment<Deo>
        value={deo}
        onChange={setDeo}
        options={[
          { value: "jelovnik", label: "Jelovnik" },
          { value: "recepti", label: "Recepti" },
          { value: "kupovina", label: "Kupovina" },
        ]}
      />
      {deo === "jelovnik" && <Jelovnik refreshKey={refreshKey} onOpenKupovina={() => setDeo("kupovina")} />}
      {deo === "recepti" && <Recepti refreshKey={refreshKey} />}
      {deo === "kupovina" && <Kupovina refreshKey={refreshKey} />}
    </ScrollView>
  );
}
