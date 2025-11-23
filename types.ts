export enum MediaType {
  TEXT = 'TEXT',
  AUDIO = 'AUDIO',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO'
}

export interface MemoryItem {
  id: string;
  type: MediaType;
  content: string; // Text content or Base64/Blob URL
  transcription?: string; // For audio/video
  summary?: string;
  tags: string[];
  createdAt: number;
  metadata?: {
    duration?: number;
    mimeType?: string;
    originalName?: string;
  };
}

export interface SearchResult {
  item: MemoryItem;
  relevanceReason: string;
}
