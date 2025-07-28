import { AuthToken, User, STORAGE_KEYS } from '../types';

export class StorageService {
  private static instance: StorageService;

  private constructor() {}

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  // Generic storage methods
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
    } catch (error) {
      console.error('Error getting from storage:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      console.error('Error setting storage:', error);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(key);
    } catch (error) {
      console.error('Error removing from storage:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await chrome.storage.local.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  // Auth-specific methods
  async getAuthToken(): Promise<AuthToken | null> {
    const token = await this.get<AuthToken>(STORAGE_KEYS.AUTH_TOKEN);
    
    if (!token) return null;

    // Check if token is expired
    if (Date.now() > token.expiresAt) {
      await this.clearAuthToken();
      return null;
    }

    return token;
  }

  async setAuthToken(token: AuthToken): Promise<void> {
    await this.set(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  async clearAuthToken(): Promise<void> {
    await this.remove(STORAGE_KEYS.AUTH_TOKEN);
  }

  // User-specific methods
  async getUserData(): Promise<User | null> {
    return this.get<User>(STORAGE_KEYS.USER_DATA);
  }

  async setUserData(user: User): Promise<void> {
    await this.set(STORAGE_KEYS.USER_DATA, user);
  }

  async clearUserData(): Promise<void> {
    await this.remove(STORAGE_KEYS.USER_DATA);
  }
} 