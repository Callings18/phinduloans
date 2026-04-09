/**
 * Push Notification Utilities
 * Handles browser push notifications for the PWA
 * Note: This is a stub implementation - full push notifications require
 * a push_subscriptions table and VAPID keys to be configured
 */

export interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: any;
}

class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null;

  /**
   * Subscription backend is not productionized yet.
   * Keep browser push UI disabled until server-side subscription storage is ready.
   */
  isSubscriptionReady(): boolean {
    return false;
  }

  async init() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications are not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.ready;
      return true;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('Notifications are not supported');
      return 'denied';
    }

    return await Notification.requestPermission();
  }

  getPermissionStatus(): NotificationPermission {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  async subscribe(userId: string): Promise<PushSubscription | null> {
    if (!this.isSubscriptionReady()) {
      console.warn("Push subscription is disabled until backend subscription storage is configured.");
      return null;
    }

    if (!this.registration) {
      await this.init();
    }

    if (!this.registration) {
      return null;
    }

    try {
      // Check if already subscribed
      const existingSubscription = await (this.registration as any).pushManager?.getSubscription();
      if (existingSubscription) {
        return existingSubscription;
      }

      if (import.meta.env.DEV) console.log("Push subscription saved for user:", userId);
      return await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        // Deliberately guarded by isSubscriptionReady(); this branch is unreachable until enabled.
        applicationServerKey: new Uint8Array(),
      });
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  async unsubscribe(userId: string): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const subscription = await (this.registration as any).pushManager?.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        if (import.meta.env.DEV) console.log('Push subscription removed for user:', userId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
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

    if (this.getPermissionStatus() !== 'granted') {
      return false;
    }

    try {
      await this.registration.showNotification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.jpg',
        badge: options.badge || '/favicon.jpg',
        tag: options.tag,
        requireInteraction: options.requireInteraction || false,
        data: options.data,
      });
      return true;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  }
}

export const pushNotificationManager = new PushNotificationManager();
