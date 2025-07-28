import { StorageService } from './services/storage';
import { ApiService } from './services/api';

class BackgroundScript {
  private storageService: StorageService;
  private apiService: ApiService;

  constructor() {
    this.storageService = StorageService.getInstance();
    this.apiService = ApiService.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Initialize authentication state
    await this.initializeAuth();
    
    // Set up event listeners
    this.setupEventListeners();
  }

  private async initializeAuth(): Promise<void> {
    const token = await this.storageService.getAuthToken();
    if (token) {
      this.apiService.setAuthToken(token);
    }
  }

  private setupEventListeners(): void {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        // Set default settings on first install
        this.setDefaultSettings();
      }
    });

    // Handle messages from content script and popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Handle storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      this.handleStorageChange(changes, namespace);
    });
  }

  private async setDefaultSettings(): Promise<void> {
    // Default settings can be added here when needed
  }

  private async handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'GET_AUTH_STATUS':
          const token = await this.storageService.getAuthToken();
          const user = await this.storageService.getUserData();
          sendResponse({
            isAuthenticated: !!token,
            user: user,
            token: token
          });
          break;

        case 'LOGOUT':
          await this.storageService.clearAuthToken();
          await this.storageService.clearUserData();
          this.apiService.clearAuthToken();
          sendResponse({ success: true });
          break;

        case 'GET_PLAYER_DATA':
          if (!this.apiService.getAuthToken()) {
            sendResponse({ error: 'Not authenticated' });
            return;
          }
          
          const response = await this.apiService.getPlayerDataByName(message.playerName);
          sendResponse(response);
          break;

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: 'Internal error' });
    }
  }

  private handleStorageChange(changes: { [key: string]: chrome.storage.StorageChange }, namespace: string): void {
    if (namespace === 'local') {
      // Handle auth token changes
      if (changes.auth_token) {
        const newToken = changes.auth_token.newValue;
        if (newToken) {
          this.apiService.setAuthToken(newToken);
        } else {
          this.apiService.clearAuthToken();
        }
      }
    }
  }
}

// Initialize background script
new BackgroundScript(); 