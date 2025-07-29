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
  private floatingButton: HTMLElement | null = null;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };

  constructor() {
    this.apiService = ApiService.getInstance();
    this.storageService = StorageService.getInstance();
    this.parserManager = ParserManager.getInstance();
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    await this.initializeAuth();
    this.setupObserver();
    this.addButtonsToAllRows();
    this.createFloatingButton();
    
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

  private addButtonsToAllRows(): void {
    const currentUrl = window.location.href;
    const playerRows = this.parserManager.getPlayerRows(currentUrl);
    
    playerRows.forEach((playerRow: PlayerRow) => {
      // Only add action button if the row has a valid player name
      const playerName = playerRow.getName().trim();
      if (playerName) {
        playerRow.addActionButton(() => {
          this.handlePlayerClick(playerRow);
        });
      }
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

  private createFloatingButton(): void {
    
    // Remove existing floating button if any
    const existingButton = document.querySelector('.drafty-floating-btn');
    if (existingButton) {
      existingButton.remove();
    }

    // Add CSS for spinner
    if (!document.querySelector('#drafty-floating-styles')) {
      const style = document.createElement('style');
      style.id = 'drafty-floating-styles';
      style.textContent = `
        .drafty-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: drafty-spin 1s linear infinite;
        }
        
        @keyframes drafty-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .drafty-floating-btn-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      `;
      document.head.appendChild(style);
    }

    // Create floating button
    this.floatingButton = document.createElement('div');
    this.floatingButton.className = 'drafty-floating-btn';
    this.floatingButton.innerHTML = `
      <div class="drafty-floating-btn-content">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor"/>
        </svg>
        <span>Get Top 25</span>
      </div>
    `;

    this.floatingButton.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 50px;
      padding: 12px 20px;
      cursor: pointer;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    // Add hover effects
    this.floatingButton.addEventListener('mouseenter', () => {
      if (this.floatingButton) {
        this.floatingButton.style.transform = 'scale(1.05)';
        this.floatingButton.style.boxShadow = '0 6px 25px rgba(0,0,0,0.4)';
      }
    });

    this.floatingButton.addEventListener('mouseleave', () => {
      if (this.floatingButton) {
        this.floatingButton.style.transform = 'scale(1)';
        this.floatingButton.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
      }
    });

    // Add click handler
    this.floatingButton.addEventListener('click', (e) => {
      if (!this.isDragging) {
        this.handleFloatingButtonClick();
      }
    });

    // Add drag functionality
    this.setupDragFunctionality();

    // Add to DOM
    document.body.appendChild(this.floatingButton);
  }

  private setupDragFunctionality(): void {
    if (!this.floatingButton) return;

    this.floatingButton.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isDragging = false;
      const rect = this.floatingButton!.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
      
      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        this.isDragging = true;
        
        requestAnimationFrame(() => {
          const x = e.clientX - this.dragOffset.x;
          const y = e.clientY - this.dragOffset.y;
          
          // Keep button within viewport bounds
          const maxX = window.innerWidth - this.floatingButton!.offsetWidth;
          const maxY = window.innerHeight - this.floatingButton!.offsetHeight;
          
          const clampedX = Math.max(0, Math.min(x, maxX));
          const clampedY = Math.max(0, Math.min(y, maxY));
          
          this.floatingButton!.style.left = `${clampedX}px`;
          this.floatingButton!.style.top = `${clampedY}px`;
          this.floatingButton!.style.right = 'auto';
        });
      };
      
      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        // Reset dragging state after a short delay
        setTimeout(() => {
          this.isDragging = false;
        }, 50);
      };
      
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp);
    });
  }

  private async handleFloatingButtonClick(): Promise<void> {
    try {
      console.log('🚀 Floating button clicked, starting player collection...');
      
      // Show loading state
      if (this.floatingButton) {
        this.floatingButton.innerHTML = `
          <div class="drafty-floating-btn-content">
            <div class="drafty-spinner"></div>
            <span>Loading...</span>
          </div>
        `;
        this.floatingButton.style.pointerEvents = 'none';
      }

      // Collect player names
      const playerNames = await this.collectTop25Players();
      
      console.log(`📋 Collected ${playerNames.length} player names for API call`);
      
      if (playerNames.length === 0) {
        console.log('❌ No players found on this page');
        this.showError('No players found on this page');
        return;
      }

      // Call API with player names
      console.log('🌐 Calling API with player names:', playerNames);
      const response = await this.apiService.getBulkPlayerData(playerNames);
      
      console.log('📡 API response received:', response);
      
      if (response.success && response.data) {
        console.log('✅ API call successful, showing bulk player data');
        this.showBulkPlayerData(playerNames, response.data);
      } else {
        console.log('❌ API call failed:', response.error);
        this.showError(`Failed to get player data: ${response.error}`);
      }
    } catch (error) {
      console.error('💥 Error handling floating button click:', error);
      this.showError('An error occurred while fetching player data');
    } finally {
      // Reset button state
      if (this.floatingButton) {
        this.floatingButton.innerHTML = `
          <div class="drafty-floating-btn-content">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor"/>
            </svg>
            <span>Get Top 25</span>
          </div>
        `;
        this.floatingButton.style.pointerEvents = 'auto';
      }
    }
  }

  private async collectTop25Players(): Promise<string[]> {
    const currentUrl = window.location.href;
    const parser = this.parserManager.getParserForUrl(currentUrl);
    
    if (!parser) {
      console.log('❌ No parser found for this URL');
      return [];
    }
    
    console.log('🔍 Starting to collect top 25 players...');
    
    // Use the parser's getPlayerNames method to get 100 player names
    const playerNames = await parser.getPlayerNames(100);
    console.log(`📊 Found ${playerNames.length} player names`);
    
    console.log(`🎯 Final player collection: ${playerNames.length} players found`);
    console.log('📝 Player names:', playerNames);
    
    return playerNames.slice(0, 25);
  }

  private showBulkPlayerData(playerNames: string[], data: any): void {
    // Remove any existing popup
    const existingPopup = document.querySelector('.drafty-bulk-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'drafty-bulk-popup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 1px solid #ccc;
      border-radius: 12px;
      padding: 24px;
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
    `;

    // Create popup content
    const title = document.createElement('h3');
    title.textContent = `Top ${playerNames.length} Players - Insights`;
    title.style.cssText = `
      margin: 0 0 20px 0;
      color: #333;
      font-size: 20px;
      border-bottom: 2px solid #667eea;
      padding-bottom: 12px;
    `;

    const content = document.createElement('div');
    
    // Handle API response data
    const players = data.players || [];
    
    if (players.length === 0) {
      const noDataDiv = document.createElement('div');
      noDataDiv.style.cssText = 'text-align: center; color: #666; padding: 20px;';
      noDataDiv.textContent = 'No player data available';
      content.appendChild(noDataDiv);
    } else {
      // Display player list
      const playerList = document.createElement('div');
      playerList.style.cssText = 'margin-bottom: 20px;';
      
      players.forEach((player: any, index: number) => {
        const playerDiv = document.createElement('div');
        playerDiv.style.cssText = `
          padding: 12px;
          border: 1px solid #eee;
          border-radius: 8px;
          margin-bottom: 8px;
          background: #f8f9fa;
        `;
        
        const playerHeader = document.createElement('div');
        playerHeader.style.cssText = 'font-weight: 600; margin-bottom: 8px; color: #333;';
        
        if (player.error) {
          playerHeader.textContent = `${index + 1}. ${player.name} - Not Found`;
          playerHeader.style.color = '#dc3545';
        } else {
          playerHeader.textContent = `${index + 1}. ${player.full_name || player.name}`;
          
          // Add position and team if available
          if (player.position || player.team) {
            const details = document.createElement('div');
            details.style.cssText = 'font-size: 12px; color: #666; margin-top: 4px;';
            details.textContent = `${player.position || ''} ${player.team || ''}`.trim();
            playerDiv.appendChild(details);
          }
        }
        
        // Add insights if available
        if (player.insights && player.insights.length > 0) {
          const insightsList = document.createElement('ul');
          insightsList.style.cssText = 'margin: 8px 0 0 0; padding-left: 20px; color: #666;';
          
          player.insights.forEach((insight: any) => {
            const li = document.createElement('li');
            li.textContent = insight.message || insight;
            li.style.cssText = 'margin-bottom: 4px;';
            insightsList.appendChild(li);
          });
          
          playerDiv.appendChild(insightsList);
        } else if (!player.error) {
          // Show placeholder for players without insights
          const noInsights = document.createElement('div');
          noInsights.style.cssText = 'font-size: 12px; color: #999; margin-top: 4px; font-style: italic;';
          noInsights.textContent = 'No insights available';
          playerDiv.appendChild(noInsights);
        }
        
        playerDiv.appendChild(playerHeader);
        playerList.appendChild(playerDiv);
      });
      
      content.appendChild(playerList);
    }

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 10px 20px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.3s ease;
    `;
    
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.transform = 'scale(1.02)';
    });
    
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.transform = 'scale(1)';
    });
    
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

    // Clean up floating button
    if (this.floatingButton) {
      this.floatingButton.remove();
      this.floatingButton = null;
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