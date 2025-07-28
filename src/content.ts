import { ApiService } from './services/api';
import { StorageService } from './services/storage';
import { ParserManager } from './parsers/parser-manager';
import { PlayerRow } from './types';

class ContentScript {
  private apiService: ApiService;
  private storageService: StorageService;
  private parserManager: ParserManager;
  private observer: MutationObserver | null = null;
  private isInitialized = false;

  constructor() {
    this.apiService = ApiService.getInstance();
    this.storageService = StorageService.getInstance();
    this.parserManager = ParserManager.getInstance();
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    await this.initializeAuth();
    this.setupObserver();
    this.setupScrollListener();
    this.addButtonsToAllRows();
    
    this.isInitialized = true;
  }

  private async initializeAuth(): Promise<void> {
    const token = await this.storageService.getAuthToken();
    if (token) {
      this.apiService.setAuthToken(token);
    }
  }

  private setupObserver(): void {
    this.observer = new MutationObserver(() => {
      this.addButtonsToAllRows();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  private setupScrollListener(): void {
    document.addEventListener('scroll', () => {
      this.addButtonsToAllRows();
    }, { passive: true });
    
    document.addEventListener('scroll', (e) => {
      if (e.target !== document) {
        this.addButtonsToAllRows();
      }
    }, { passive: true, capture: true });
  }

  private addButtonsToAllRows(): void {
    const currentUrl = window.location.href;
    const playerRows = this.parserManager.getPlayerRows(currentUrl);
    
    playerRows.forEach((playerRow: PlayerRow) => {
      // Add action button to each player row
      playerRow.addActionButton(() => {
        this.handlePlayerClick(playerRow);
      });
    });
  }

  private async handlePlayerClick(playerRow: PlayerRow): Promise<void> {
    const playerName = playerRow.getName();
    
    if (!playerName) {
      this.showError('Could not find player name');
      return;
    }
    
    try {
      const token = await this.storageService.getAuthToken();
      if (!token) {
        this.showError('Please log in to get player insights');
        return;
      }

      const response = await this.apiService.getPlayerDataByName(playerName);
      
      if (response.success && response.data) {
        this.showPlayerData(playerRow.root, playerName, response.data);
      } else {
        this.showError(`Failed to get data for ${playerName}: ${response.error}`);
      }
    } catch (error) {
      console.error('Error handling player action:', error);
      this.showError('An error occurred while fetching player data');
    }
  }

  private showPlayerData(element: HTMLElement, playerName: string, data: any): void {
    // Remove any existing popup
    const existingPopup = document.querySelector('.drafty-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'drafty-popup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 20px;
      z-index: 10001;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      max-width: 400px;
      max-height: 80vh;
      overflow-y: auto;
    `;

    // Create popup content
    const title = document.createElement('h3');
    title.textContent = `${playerName} - Player Insights`;
    title.style.cssText = `
      margin: 0 0 15px 0;
      color: #333;
      font-size: 18px;
      border-bottom: 2px solid #007bff;
      padding-bottom: 8px;
    `;

    const content = document.createElement('div');
    
    // Add rank information
    if (data.rank) {
      const rankDiv = document.createElement('div');
      rankDiv.style.cssText = 'margin-bottom: 10px;';
      rankDiv.innerHTML = `<strong>Rank:</strong> ${data.rank}`;
      content.appendChild(rankDiv);
    }

    // Add insights
    const insights = data.insights || [];
    if (insights.length > 0) {
      const insightsDiv = document.createElement('div');
      insightsDiv.style.cssText = 'margin-bottom: 10px;';
      insightsDiv.innerHTML = `<strong>Insights:</strong>`;
      
      const insightsList = document.createElement('ul');
      insightsList.style.cssText = 'margin: 5px 0 0 20px; padding: 0;';
      
      insights.forEach((insight: any) => {
        const li = document.createElement('li');
        li.textContent = insight.message || insight;
        li.style.cssText = 'margin-bottom: 5px;';
        insightsList.appendChild(li);
      });
      
      insightsDiv.appendChild(insightsList);
      content.appendChild(insightsDiv);
    }

    // Add any additional data
    if (data.additionalData) {
      const additionalDiv = document.createElement('div');
      additionalDiv.style.cssText = 'margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;';
      additionalDiv.innerHTML = `<strong>Additional Data:</strong><br>${JSON.stringify(data.additionalData, null, 2)}`;
      content.appendChild(additionalDiv);
    }

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      cursor: pointer;
      margin-top: 15px;
      font-size: 14px;
    `;
    
    closeButton.addEventListener('click', () => {
      popup.remove();
    });

    // Add click outside to close
    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        popup.remove();
      }
    });

    // Add escape key to close
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        popup.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Assemble popup
    popup.appendChild(title);
    popup.appendChild(content);
    popup.appendChild(closeButton);

    // Add overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
    `;
    
    overlay.addEventListener('click', () => {
      overlay.remove();
      popup.remove();
      document.removeEventListener('keydown', handleEscape);
    });

    // Add to DOM
    document.body.appendChild(overlay);
    document.body.appendChild(popup);
  }

  private showError(message: string): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    // Clean up any existing popups
    const existingPopup = document.querySelector('.drafty-popup');
    if (existingPopup) {
      existingPopup.remove();
    }
    
    const existingOverlay = document.querySelector('div[style*="rgba(0,0,0,0.5)"]');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    
    this.isInitialized = false;
  }
}

// Initialize the content script when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const contentScript = new ContentScript();
    contentScript.init();
  });
} else {
  const contentScript = new ContentScript();
  contentScript.init();
} 