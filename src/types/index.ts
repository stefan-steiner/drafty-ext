// Core interfaces for the extension
export interface PlayerRow {
  root: HTMLElement;
  getName(): string;
  setNote(note: string): void;
  addActionButton(callback: () => void): void;
}

export interface PlayerData {
  id: string;
  name: string;
  position: string;
  team: string;
  rank?: number;
  notes?: string;
  insights?: PlayerInsight[];
}

export interface PlayerInsight {
  type: 'positive' | 'negative' | 'neutral';
  message: string;
  source: string;
}

export interface AuthToken {
  token: string;
  expiresAt: number;
  userId: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Parser interface for different sites
export interface SiteParser {
  name: string;
  canParse(url: string): boolean;
  getPlayerRows(): PlayerRow[];
  getPlayerNames(requiredCount: number): Promise<string[]>;
}

// Storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
} as const; 