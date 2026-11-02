import { Tabs, router } from "expo-router";
import { View, Pressable, StyleSheet, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../../theme";
import { Icon, IconName } from "../../components/ui";

function tabIcon(name: IconName, nameActive: IconName) {
  return ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Icon name={focused ? nameActive : name} size={26} color={color as string} />
  );
}

/** Veliko zeleno dugme u sredini menija: otvara panel "Šta dodaješ?" */
function PlusButton() {
  return (
    <View style={styles.plusWrap} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [styles.plus, pressed && { transform: [{ scale: 0.95 }] }]}
        onPress={() => router.push("/dodaj")}
        accessibilityRole="button"
        accessibilityLabel="Dodaj"
      >
        <Icon name="add" size={34} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.divider,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 12, fontFamily: fonts.extrabold },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Danas", tabBarIcon: tabIcon("sunny-outline", "sunny") }} />
      <Tabs.Screen name="hrana" options={{ title: "Hrana", tabBarIcon: tabIcon("restaurant-outline", "restaurant") }} />
      <Tabs.Screen
        name="plus"
        options={{ title: "", tabBarButton: () => <PlusButton />, tabBarAccessibilityLabel: "Dodaj" }}
      />
      <Tabs.Screen name="trening" options={{ title: "Trening", tabBarIcon: tabIcon("barbell-outline", "barbell") }} />
      <Tabs.Screen name="ja" options={{ title: "Ja", tabBarIcon: tabIcon("person-outline", "person") }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  plusWrap: { flex: 1, alignItems: "center" },
  plus: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginTop: -24,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
