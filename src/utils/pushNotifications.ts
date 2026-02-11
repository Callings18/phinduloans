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

      // Note: Full push subscription requires VAPID keys and a push_subscriptions table
      // This is a placeholder - actual implementation would need proper VAPID setup
      console.log('Push subscription would be saved for user:', userId);
      return null;
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
        console.log('Push subscription removed for user:', userId);
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
