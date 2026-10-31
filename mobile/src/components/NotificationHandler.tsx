import { useEffect } from "react";
import { useRootNavigationState } from "expo-router";
import * as Notifications from "expo-notifications";
import { setupNotifications, scheduleMealReminders, handleNotificationResponse } from "../services/notifications";

export default function NotificationHandler() {
  const navState = useRootNavigationState();
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    setupNotifications()
      .then(() => scheduleMealReminders({ askPermission: false }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (lastResponse && navState?.key) {
      handleNotificationResponse(lastResponse);
    }
  }, [lastResponse, navState?.key]);

  return null;
}