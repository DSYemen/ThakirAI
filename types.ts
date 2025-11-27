

export enum MediaType {
  TEXT = 'TEXT',
  AUDIO = 'AUDIO',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO'
}

export type ReminderFrequency = 'ONCE' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface Reminder {
  timestamp: number;
  frequency: ReminderFrequency;
  interval?: number; // New field: e.g., 2 for "Every 2 days"
}

export interface TaskCategory {
  id: string;
  label: string;
  colorName: 'blue' | 'red' | 'green' | 'yellow' | 'purple' | 'gray';
  iconName: 'briefcase' | 'heart' | 'user' | 'dollar' | 'party' | 'default';
}

export interface MemoryItem {
  id: string;
  type: MediaType;
  content: string; // Text content or Base64/Blob URL
  transcription?: string; // For audio/video
  summary?: string;
  tags: string[];
  createdAt: number;
  isFavorite?: boolean;
  isPinned?: boolean;
  reminder?: Reminder;
  isCompleted?: boolean;      // New: For schedule tracking
  completionNote?: string;    // New: Note added when completing
  category?: TaskCategory;    // New: Visual category for schedule
  analysisStatus?: 'PENDING' | 'COMPLETED' | 'FAILED';
  metadata?: {
    duration?: number;
    mimeType?: string;
    originalName?: string;
    userContext?: string; // New: To store input text for offline processing
  };
}

export interface SearchResult {
  item: MemoryItem;
  relevanceReason: string;
  score: number;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  apiKey?: string;
  aiModel: string;
  autoSaveMedia?: boolean;
  customMediaFolder?: string;
  timeZone?: string; // New: User Timezone
  language?: string; // New: User Language preference
  syncNewTasksToCalendar?: boolean; // New: Default preference for Google Calendar sync
}