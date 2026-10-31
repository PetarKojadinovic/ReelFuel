import * as Notifications from "expo-notifications";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { getLatestMealPlan, danAkcija } from "./api";
import { getMealTimes, getRemindersOn } from "./mealTimes";
import { getTodayDate } from "../utils/date";

const TIPOVI = ["dorucak", "rucak", "vecera"] as const;
const ZA_OBROK: Record<string, string> = { dorucak: "doručak", rucak: "ručak", vecera: "večeru" };
// expo-notifications: 1 = nedelja ... 7 = subota
const WEEKDAYS: Record<string, number> = { nedelja: 1, ponedeljak: 2, utorak: 3, sreda: 4, cetvrtak: 5, petak: 6, subota: 7 };

function norm(s: string) {
  let r = (s || "").toLowerCase().trim();
  r = r.replace(/[čć]/g, "c").replace(/š/g, "s").replace(/ž/g, "z").replace(/đ/g, "dj");
  return r;
}

export async function setupNotifications() {
  if (Platform.OS === "web") return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("obroci", {
      name: "Podsetnici za obroke",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await Notifications.setNotificationCategoryAsync("obrok", [
    { identifier: "slikaj", buttonTitle: "Slikaj / unesi", options: { opensAppToForeground: true } },
    { identifier: "pojeo", buttonTitle: "Po planu", options: { opensAppToForeground: true } },
    { identifier: "preskocio", buttonTitle: "Preskočio", options: { opensAppToForeground: true } },
  ]);
}

export async function ensurePermission(ask: boolean): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!ask) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/**
 * Zakazuje podsetnike u upisano vreme obroka, iz trenutnog plana. Vraca broj zakazanih.
 * Ako server nije dostupan, baca gresku, a postojeci podsetnici ostaju netaknuti.
 */
export async function scheduleMealReminders(opts: { askPermission: boolean }): Promise<number> {
  if (Platform.OS === "web") return 0;

  if (!(await getRemindersOn())) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return 0;
  }
  if (!(await ensurePermission(opts.askPermission))) return 0;

  const { exists, plan } = await getLatestMealPlan();
  if (!exists) return 0;

  const times = await getMealTimes();
  await Notifications.cancelAllScheduledNotificationsAsync();

  let count = 0;
  for (const day of plan.dani || []) {
    const weekday = WEEKDAYS[norm(day.dan)];
    if (!weekday) continue;
    for (const tip of TIPOVI) {
      const meal = day.obroci?.[tip];
      if (!meal) continue;
      const [hour, minute] = times[tip].split(":").map(Number);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Vreme je za ${ZA_OBROK[tip]}`,
          body: `Po planu: ${meal.naziv}. Slikaj obrok ili unesi kalorije.`,
          categoryIdentifier: "obrok",
          data: { obrok_tip: tip },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour,
          minute,
          channelId: "obroci",
        },
      });
      count++;
    }
  }
  return count;
}

export async function handleNotificationResponse(response: Notifications.NotificationResponse) {
  // Isti odgovor ne obradjujemo dvaput (npr. pri ponovnom pokretanju aplikacije)
  const id = `${response.notification.request.identifier}|${response.actionIdentifier}|${response.notification.date}`;
  const seen = await AsyncStorage.getItem("reelfuel_last_notif");
  if (seen === id) return;
  await AsyncStorage.setItem("reelfuel_last_notif", id);

  const tip = response.notification.request.content.data?.obrok_tip as string | undefined;
  const action = response.actionIdentifier;
  const datum = getTodayDate();

  if (tip && (action === "pojeo" || action === "preskocio")) {
    try {
      await danAkcija(datum, tip, { akcija: action });
    } catch {
      Alert.alert("Greška", "Nije uspelo čuvanje. Potvrdi obrok ručno u Dnevniku.");
    }
    router.push("/dnevnik");
  } else if (tip) {
    // Dugme "Slikaj / unesi" ili dodir na samu notifikaciju
    router.push({ pathname: "/zamena", params: { datum, obrok_tip: tip } });
  } else {
    router.push("/dnevnik");
  }
}

export async function sendTestNotification(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (!(await ensurePermission(true))) return false;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Probni podsetnik",
      body: "Ako vidiš ovo, notifikacije rade.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: "obroci",
    },
  });
  return true;
}

export async function describeScheduled(): Promise<string> {
  if (Platform.OS === "web") return "Na webu nema zakazanih notifikacija.";
  const all = await Notifications.getAllScheduledNotificationsAsync();
  if (all.length === 0) return "Nema zakazanih podsetnika.";
  const dani = ["", "ned", "pon", "uto", "sre", "čet", "pet", "sub"];
  const lines = all.slice(0, 8).map((n: any) => {
    const t = n.trigger || {};
    if (t.weekday != null) {
      const hh = String(t.hour).padStart(2, "0");
      const mm = String(t.minute).padStart(2, "0");
      return `${dani[t.weekday] ?? t.weekday} ${hh}:${mm} – ${n.content?.title}`;
    }
    return n.content?.title ?? "podsetnik";
  });
  return `Zakazano: ${all.length}\n` + lines.join("\n") + (all.length > 8 ? "\n..." : "");
}