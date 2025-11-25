
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

export interface MemoryItem {
  id: string;
  type: MediaType;
  content: string; // Text content or Base64/Blob URL
  transcription?: string; // For audio/video
  summary?: string;
  tags: string[];
  createdAt: number;
  isFavorite?: boolean;
  isPinned?: boolean; // New property for pinning important memories
  reminder?: Reminder;
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
