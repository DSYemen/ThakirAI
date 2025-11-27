
import { MemoryItem } from '../types';

export const generateGoogleCalendarLink = (memory: MemoryItem) => {
  if (!memory.reminder) {
      alert("لا يوجد تذكير لهذه الذكرى");
      return;
  }

  const title = encodeURIComponent(memory.summary || "تذكير من الذاكرة الذكية");
  const details = encodeURIComponent((memory.transcription || memory.content || "") + "\n\n(تم الإنشاء بواسطة تطبيق الذاكرة الذكية)");
  
  const startDate = new Date(memory.reminder.timestamp);
  // Default duration 1 hour
  const endDate = new Date(startDate.getTime() + (60 * 60 * 1000));

  const formatTime = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");

  let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${formatTime(startDate)}/${formatTime(endDate)}`;

  if (memory.reminder.frequency !== 'ONCE') {
      const freqMap: Record<string, string> = {
          'HOURLY': 'HOURLY',
          'DAILY': 'DAILY',
          'WEEKLY': 'WEEKLY',
          'MONTHLY': 'MONTHLY',
          'YEARLY': 'YEARLY'
      };
      if (freqMap[memory.reminder.frequency]) {
          let rrule = `RRULE:FREQ=${freqMap[memory.reminder.frequency]}`;
          if (memory.reminder.interval && memory.reminder.interval > 1) {
              rrule += `;INTERVAL=${memory.reminder.interval}`;
          }
          url += `&recur=${rrule}`;
      }
  }

  window.open(url, '_blank');
};

export const openCalendarSearch = (query: string) => {
  const url = `https://calendar.google.com/calendar/r/search?q=${encodeURIComponent(query)}`;
  window.open(url, '_blank');
};