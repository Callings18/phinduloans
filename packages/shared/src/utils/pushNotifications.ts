/**
 * Browser Web Push for the PWA. Requires VITE_VAPID_PUBLIC_KEY and `push_subscriptions` (p256dh_key, auth_key).
 * Server-side send: supabase/functions/send-web-push
 */

import { supabase } from "@phinduloans/shared/integrations/supabase/client";

export interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: unknown;
}

function getVapidPublicKey(): string | undefined {
  const k = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  return typeof k === "string" && k.trim().length > 0 ? k.trim() : undefined;
}

/** URL-safe base64 (VAPID / applicationServerKey) to Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null;

  isSubscriptionReady(): boolean {
    return Boolean(getVapidPublicKey());
  }

  async init(): Promise<boolean> {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Push notifications are not supported");
      return false;
    }

    try {
      if (!(await navigator.serviceWorker.getRegistration())) {
        await navigator.serviceWorker.register("/service-worker.js");
      }
      this.registration = await navigator.serviceWorker.ready;
      return Boolean(this.registration);
    } catch (error) {
      console.error("Failed to initialize push notifications:", error);
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) {
      console.warn("Notifications are not supported");
      return "denied";
    }

    return await Notification.requestPermission();
  }

  getPermissionStatus(): NotificationPermission {
    if (!("Notification" in window)) {
      return "denied";
    }
    return Notification.permission;
  }

  async subscribe(userId: string): Promise<PushSubscription | null> {
    const vapidKey = getVapidPublicKey();
    if (!vapidKey) {
      console.warn("VITE_VAPID_PUBLIC_KEY is not set; cannot subscribe to push.");
      return null;
    }

    if (!this.registration) {
      await this.init();
    }

    if (!this.registration) {
      return null;
    }

    try {
      const existingSubscription = await this.registration.pushManager.getSubscription();
      const sub =
        existingSubscription ??
        (await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
        }));

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        console.error("Push subscription JSON missing keys");
        return null;
      }

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: json.endpoint,
          p256dh_key: json.keys.p256dh,
          auth_key: json.keys.auth,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) {
        console.error("Failed to persist push subscription:", error);
        return null;
      }

      if (import.meta.env.DEV) {
        console.log("Push subscription saved for user:", userId);
      }

      return sub;
    } catch (error) {
      console.error("Failed to subscribe to push notifications:", error);
      return null;
    }
  }

  async unsubscribe(userId: string): Promise<boolean> {
    if (!this.registration) {
      await this.init();
    }

    if (!this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        const json = subscription.toJSON();
        await subscription.unsubscribe();
        if (json.endpoint) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", json.endpoint).eq("user_id", userId);
        }
        if (import.meta.env.DEV) {
          console.log("Push subscription removed for user:", userId);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to unsubscribe:", error);
      return false;
    }
  }

  async showNotification(options: PushNotificationOptions): Promise<boolean> {
    if (!this.registration) {
      await this.init();
    }

    if (!this.registration) {
      return false;
    }

    if (this.getPermissionStatus() !== "granted") {
      return false;
    }

    try {
      await this.registration.showNotification(options.title, {
        body: options.body,
        icon: options.icon || "/favicon.png",
        badge: options.badge || "/favicon.png",
        tag: options.tag,
        requireInteraction: options.requireInteraction || false,
        data: options.data,
      });
      return true;
    } catch (error) {
      console.error("Failed to show notification:", error);
      return false;
    }
  }
}

export const pushNotificationManager = new PushNotificationManager();
