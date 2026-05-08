import { Capacitor } from "@capacitor/core";

let initialized = false;

export async function initPushNotifications() {
  if (!Capacitor.isNativePlatform() || initialized) return;
  initialized = true;

  const { PushNotifications } = await import("@capacitor/push-notifications");

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return;

  await PushNotifications.register();

  PushNotifications.addListener("registration", async (token) => {
    try {
      await fetch("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.value }),
      });
    } catch {
      // Non-critical — token will be registered on next launch
    }
  });

  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("Push received:", notification.title);
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const url = action.notification.data?.url;
    if (url?.startsWith("/")) window.location.href = url;
  });
}
