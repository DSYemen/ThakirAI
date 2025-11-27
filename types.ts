
export enum MediaType {
  TEXT = 'TEXT',
  AUDIO = 'AUDIO',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO'
}

export type ReminderFrequency = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface Reminder {
  timestamp: number;
  frequency: ReminderFrequency;
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
}
