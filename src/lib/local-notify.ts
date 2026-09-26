import { Capacitor } from "@capacitor/core";

/**
 * Fire a device-level notification for an important background change (for
 * example, a registration that was cancelled on another device). This is
 * best-effort and never throws: on a native build it uses Capacitor Local
 * Notifications; in the browser it uses the Web Notifications API when the user
 * has granted permission. Callers still add an in-app notification separately,
 * so the message is never lost when the OS surface is unavailable.
 */
export async function notifyDevice(title: string, body: string): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== "granted") {
        const requested = await LocalNotifications.requestPermissions();
        if (requested.display !== "granted") return;
      }
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 2_000_000_000),
            title,
            body,
          },
        ],
      });
      return;
    }
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      new Notification(title, { body });
      return;
    }
    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      if (result === "granted") new Notification(title, { body });
    }
  } catch {
    /* device notifications are best-effort; the in-app notice still lands */
  }
}
