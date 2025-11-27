
import { LocalNotifications, ActionPerformed } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { MemoryItem } from '../types';

class ReminderService {
  
  /**
   * Initialize and request permissions
   */
  public async init() {
    // Web Fallback / Skip
    if (Capacitor.getPlatform() === 'web') {
        console.log("Web platform: Native notifications skipped.");
        if ("Notification" in window) {
            await Notification.requestPermission();
        }
        return;
    }

    try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') {
            await LocalNotifications.requestPermissions();
        }

        // Create a High Priority Channel for Android
        await LocalNotifications.createChannel({
            id: 'thakira_reminders',
            name: 'تذكيرات الذاكرة الذكية',
            description: 'تنبيهات للمواعيد والمهام المهمة',
            importance: 5, // High
            visibility: 1,
            sound: 'default',
            vibration: true,
            lights: true,
            lightColor: '#6366f1'
        });

        // Listen for actions (optional, e.g., if user taps notification)
        LocalNotifications.addListener('localNotificationActionPerformed', (action: ActionPerformed) => {
            console.log('Notification action performed', action);
            // Here you could navigate to the specific memory
        });

    } catch (e) {
        console.error("Failed to init notifications", e);
    }
  }

  public start() {
    // No-op for compatibility with old interface, handled by OS now
  }

  public stop() {
    // No-op
  }

  /**
   * Schedule a notification for a memory
   */
  public async scheduleNotification(memory: MemoryItem) {
    if (!memory.reminder) return;

    if (Capacitor.getPlatform() === 'web') {
        // Basic Web Fallback (Unreliable for long durations, mainly for dev testing)
        if ("Notification" in window && Notification.permission === "granted") {
            const delay = memory.reminder.timestamp - Date.now();
            if (delay > 0 && delay < 2147483647) { // setTimeout max limit
                setTimeout(() => {
                    new Notification("الذاكرة الذكية", { body: memory.summary || "تذكير" });
                }, delay);
            }
        }
        return;
    }

    try {
        // Convert UUID string to a unique integer ID for the notification
        const notifId = this.hashCode(memory.id);

        // Cancel any existing notification for this ID first
        await this.cancelNotification(memory.id);

        const scheduledTime = new Date(memory.reminder.timestamp);
        const now = new Date();

        // Don't schedule past events unless it's very recent (e.g. within last minute)
        if (scheduledTime.getTime() < now.getTime()) {
            return; 
        }

        // Schedule
        await LocalNotifications.schedule({
            notifications: [{
                id: notifId,
                title: "الذاكرة الذكية",
                body: memory.summary || "لديك موعد الآن!",
                schedule: { 
                    at: scheduledTime,
                    allowWhileIdle: true // Fire even in doze mode
                },
                channelId: 'thakira_reminders',
                smallIcon: 'ic_stat_icon_config_sample', // Default resource or app icon
                sound: 'default',
                actionTypeId: '',
                extra: {
                    memoryId: memory.id
                }
            }]
        });

        console.log(`Scheduled notification for ${memory.summary} at ${scheduledTime.toLocaleString()}`);

    } catch (e) {
        console.error("Error scheduling notification", e);
    }
  }

  /**
   * Cancel a notification
   */
  public async cancelNotification(memoryId: string) {
      if (Capacitor.getPlatform() === 'web') return;

      try {
          const notifId = this.hashCode(memoryId);
          await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
      } catch (e) {
          console.error("Error canceling notification", e);
      }
  }

  /**
   * Helper to generate integer ID from string
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash); // Ensure positive
  }
}

export const reminderService = new ReminderService();
