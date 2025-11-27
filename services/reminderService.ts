
import { getDueReminders, saveMemory } from './db';
import { MemoryItem } from '../types';

class ReminderService {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize the service and request permissions
   */
  public init() {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
    this.start();
  }

  /**
   * Start the background check interval
   */
  public start() {
    if (this.intervalId) return;
    
    // Initial check immediately
    this.check();
    
    // Check every 60 seconds
    this.intervalId = setInterval(() => this.check(), 60000);
  }

  /**
   * Stop the background service
   */
  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Core logic to check for due reminders
   */
  private async check() {
    // Only proceed if we have permission or if we just want to update the DB state (though notifying is the main goal)
    // We allow running even without notification permission just to update the "next occurrence" 
    // but ideally we need permission to alert the user.
    
    const now = Date.now();
    try {
      // Efficiently fetch only memories with reminders due before or at 'now'
      const dueMemories = await getDueReminders(now);
      
      for (const memory of dueMemories) {
          // Double check existence of reminder object
          if (!memory.reminder) continue;

          // 1. Trigger Notification (if permitted)
          if ('Notification' in window && Notification.permission === 'granted') {
             try {
                 new Notification("تذكير من الذاكرة الذكية", {
                    body: memory.summary || "لديك ذكرى تستحق الاسترجاع!",
                    icon: '/logo.svg',
                    dir: 'rtl',
                    tag: memory.id // Use ID as tag to prevent duplicate notifications for same event if checked twice
                 });
             } catch (e) {
                 console.error("Failed to display notification", e);
             }
          }

          // 2. Schedule Next Occurrence or Remove Reminder
          await this.processNextOccurrence(memory);
      }
    } catch (e) {
      console.error("Error in ReminderService check loop:", e);
    }
  }

  /**
   * Calculates the next reminder date or removes it if 'ONCE'
   */
  private async processNextOccurrence(memory: MemoryItem) {
      if (!memory.reminder) return;

      const freq = memory.reminder.frequency;
      const interval = memory.reminder.interval || 1; // Default to 1 if not set

      if (freq === 'ONCE') {
          // It was a one-time reminder, so we remove the reminder object
          const updated = { ...memory };
          delete updated.reminder;
          await saveMemory(updated);
          return;
      }

      // For recurring reminders, we calculate the next valid date in the future.
      // If the user missed multiple cycles (e.g. phone off for a month), 
      // we skip to the next upcoming slot.
      const now = Date.now();
      let nextTimestamp = memory.reminder.timestamp;
      const dateObj = new Date(nextTimestamp);
      
      while (nextTimestamp <= now) {
           switch (freq) {
                case 'HOURLY': dateObj.setTime(dateObj.getTime() + (interval * 60 * 60 * 1000)); break;
                case 'DAILY': dateObj.setDate(dateObj.getDate() + interval); break;
                case 'WEEKLY': dateObj.setDate(dateObj.getDate() + (interval * 7)); break;
                case 'MONTHLY': dateObj.setMonth(dateObj.getMonth() + interval); break;
                case 'YEARLY': dateObj.setFullYear(dateObj.getFullYear() + interval); break;
           }
           nextTimestamp = dateObj.getTime();
      }

      const updated = {
          ...memory,
          reminder: {
              ...memory.reminder,
              timestamp: nextTimestamp
          }
      };

      await saveMemory(updated);
  }
}

export const reminderService = new ReminderService();