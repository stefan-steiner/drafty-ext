import { ParserManager } from './parsers/parser-manager';
import { ApiService } from './services/api';
import { StorageService } from './services/storage';
import { PlayerRow } from './types';
import { PickAssistantResponse, PlayerData } from './types/api';

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

      const response = await this.apiService.getPlayerDataByName(playerName, 'standard');

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

  private showPlayerData(element: HTMLElement, playerName: string, data: PlayerData): void {
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
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
    `;

    // Create popup content
    const title = document.createElement('h3');
    title.textContent = `${data.full_name || playerName} - Player Insights`;
    title.style.cssText = `
      margin: 0 0 15px 0;
      color: #333;
      font-size: 18px;
      border-bottom: 2px solid #007bff;
      padding-bottom: 8px;
    `;

    const content = document.createElement('div');

    // Add basic player info
    const basicInfo = document.createElement('div');
    basicInfo.style.cssText = 'margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 6px;';

    let basicInfoHtml = '';
    if (data.position) basicInfoHtml += `<strong>Position:</strong> ${data.position}<br>`;
    if (data.team) basicInfoHtml += `<strong>Team:</strong> ${data.team}<br>`;
    if (data.rank) basicInfoHtml += `<strong>Rank:</strong> ${data.rank}<br>`;
    if (data.adp) basicInfoHtml += `<strong>ADP:</strong> ${data.adp}<br>`;

    basicInfo.innerHTML = basicInfoHtml;
    content.appendChild(basicInfo);

    // Helper function to format bullet points
    const formatBulletPoints = (text: string): string => {
      if (!text) return '';

      // Split by newlines and filter out empty lines
      const lines = text.split('\n').filter(line => line.trim());

      return lines.map(line => {
        // If line starts with dash, convert to bullet point
        if (line.trim().startsWith('-')) {
          const content = line.trim().substring(1).trim();
          return `<li>${content}</li>`;
        }
        // Otherwise, treat as regular paragraph
        return `<p>${line.trim()}</p>`;
      }).join('');
    };

    // Add player overview
    if (data.player_overview) {
      const overviewDiv = document.createElement('div');
      overviewDiv.style.cssText = 'margin-bottom: 15px;';

      const formattedOverview = formatBulletPoints(data.player_overview);
      if (formattedOverview.includes('<li>')) {
        // Has bullet points
        overviewDiv.innerHTML = `<strong>Overview:</strong><ul style="margin: 8px 0; padding-left: 20px; line-height: 1.6;">${formattedOverview}</ul>`;
      } else {
        // Regular text
        overviewDiv.innerHTML = `<strong>Overview:</strong><br>${formattedOverview}`;
      }
      content.appendChild(overviewDiv);
    }

    // Add upside
    if (data.upside) {
      const upsideDiv = document.createElement('div');
      upsideDiv.style.cssText = 'margin-bottom: 15px; padding: 10px; background: #d4edda; border-left: 4px solid #28a745; border-radius: 4px;';

      const formattedUpside = formatBulletPoints(data.upside);
      if (formattedUpside.includes('<li>')) {
        // Has bullet points
        upsideDiv.innerHTML = `<strong>Upside:</strong><ul style="margin: 8px 0; padding-left: 20px; line-height: 1.6;">${formattedUpside}</ul>`;
      } else {
        // Regular text
        upsideDiv.innerHTML = `<strong>Upside:</strong><br>${formattedUpside}`;
      }
      content.appendChild(upsideDiv);
    }

    // Add downside
    if (data.downside) {
      const downsideDiv = document.createElement('div');
      downsideDiv.style.cssText = 'margin-bottom: 15px; padding: 10px; background: #f8d7da; border-left: 4px solid #dc3545; border-radius: 4px;';

      const formattedDownside = formatBulletPoints(data.downside);
      if (formattedDownside.includes('<li>')) {
        // Has bullet points
        downsideDiv.innerHTML = `<strong>Downside:</strong><ul style="margin: 8px 0; padding-left: 20px; line-height: 1.6;">${formattedDownside}</ul>`;
      } else {
        // Regular text
        downsideDiv.innerHTML = `<strong>Downside:</strong><br>${formattedDownside}`;
      }
      content.appendChild(downsideDiv);
    }

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
      background: #00BFFF;
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
      closeButton.style.background = '#00008B';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.transform = 'scale(1)';
      closeButton.style.background = '#00BFFF';
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

    // Create floating button
    this.floatingButton = document.createElement('div');
    this.floatingButton.className = 'drafty-floating-btn';

    // Load SVG from file
    const svgUrl = chrome.runtime.getURL('assets/drafty_logo.svg');
    const img = document.createElement('img');
    img.src = svgUrl;
    img.style.cssText = `
      width: 120px;
      height: 50px;
      filter: brightness(0) invert(1);
    `;

    this.floatingButton.innerHTML = `
      <div class="drafty-floating-btn-content">
        ${img.outerHTML}
        <span>PICK ASSISTANT</span>
      </div>
    `;

    this.floatingButton.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #00BFFF;
      color: white;
      border: none;
      border-radius: 50px;
      padding: 20px 24px;
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

    // Add CSS for floating button content
    if (!document.querySelector('#drafty-floating-styles')) {
      const style = document.createElement('style');
      style.id = 'drafty-floating-styles';
      style.textContent = `
        .drafty-floating-btn-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
      `;
      document.head.appendChild(style);
    }

    // Add hover effects
    this.floatingButton.addEventListener('mouseenter', () => {
      if (this.floatingButton) {
        this.floatingButton.style.transform = 'scale(1.05)';
        this.floatingButton.style.boxShadow = '0 6px 25px rgba(0,0,0,0.4)';
        this.floatingButton.style.background = '#00008B';
      }
    });

    this.floatingButton.addEventListener('mouseleave', () => {
      if (this.floatingButton) {
        this.floatingButton.style.transform = 'scale(1)';
        this.floatingButton.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        this.floatingButton.style.background = '#00BFFF';
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

      // Step 1: Show loading overlay for searching players
      this.showLoadingOverlay('Searching available players');

      // Step 2-6: Get player names using parser
      const currentUrl = window.location.href;
      const parser = this.parserManager.getParserForUrl(currentUrl);

      if (!parser) {
        console.log('❌ No parser found for this URL');
        this.hideLoadingOverlay();
        this.showError('No parser found for this URL');
        return;
      }

      console.log('🔍 Starting to collect players...');
      const availableNames = await parser.getAvailableNames(25);
      const draftedNames = await parser.getDraftedNames();

      console.log(`📊 Found ${availableNames.length} available player names`);
      console.log(`📊 Found ${draftedNames.length} drafted player names`);

      // Remove the first loading overlay
      this.hideLoadingOverlay();

      if (availableNames.length === 0) {
        console.log('❌ No players found on this page');
        this.showError('No players found on this page');
        return;
      }

      // Step 7: Show loading overlay for analyzing picks
      this.showLoadingOverlay('Analyzing possible picks');

      // Step 8: Call backend API
      console.log('🌐 Calling API with available names and drafted names:', availableNames, draftedNames);
      const response = await this.apiService.pickAssistant({
        players_available: availableNames,
        players_drafted: draftedNames,
        scoring_type: 'standard' // You can make this configurable later
      });

      console.log('📡 API response received:', response);

      // Step 9: Remove loading overlay and show results
      this.hideLoadingOverlay();

      if (response.success && response.data) {
        console.log('✅ API call successful, showing pick assistant data');
        this.showPickAssistant(response.data);
      } else {
        console.log('❌ API call failed:', response.error);
        this.showError(`Failed to get player data: ${response.error}`);
      }
    } catch (error) {
      console.error('💥 Error handling floating button click:', error);
      this.hideLoadingOverlay();
      this.showError('An error occurred while fetching player data');
    }
  }

  private showLoadingOverlay(message: string): void {
    // Remove any existing overlay
    this.hideLoadingOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'drafty-loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.7);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      user-select: none;
    `;

    // Add loading spinner
    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid #00BFFF;
      border-radius: 50%;
      animation: drafty-spin 1s linear infinite;
    `;

    // Add loading text
    const text = document.createElement('div');
    text.textContent = message;
    text.style.cssText = `
      color: white;
      margin-top: 20px;
      font-family: Arial, sans-serif;
      font-size: 16px;
    `;

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes drafty-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
    `;

    container.appendChild(spinner);
    container.appendChild(text);
    overlay.appendChild(container);

    // Prevent ALL events
    const preventEvent = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    };

    // Block all possible events
    const events = [
      'mousedown', 'mouseup', 'mousemove', 'click', 'dblclick', 'contextmenu',
      'wheel', 'scroll', 'keydown', 'keyup', 'keypress', 'touchstart', 'touchend',
      'touchmove', 'dragstart', 'drag', 'dragend', 'drop', 'focus', 'blur',
      'input', 'change', 'submit', 'reset', 'select', 'selectstart'
    ];

    events.forEach(eventType => {
      overlay.addEventListener(eventType, preventEvent, { capture: true, passive: false });
    });

    document.body.appendChild(overlay);
  }

  private hideLoadingOverlay(): void {
    const overlay = document.getElementById('drafty-loading-overlay');
    if (overlay) {
      overlay.remove();
    }

    // Remove the style element we added
    const style = document.querySelector('style');
    if (style && style.textContent?.includes('drafty-spin')) {
      style.remove();
    }
  }

  private showPickAssistant(data: PickAssistantResponse): void {
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
    title.textContent = `Pick Assistant - Recommendations`;
    title.style.cssText = `
      margin: 0 0 20px 0;
      color: #333;
      font-size: 20px;
      border-bottom: 2px solid #667eea;
      padding-bottom: 12px;
    `;

    const content = document.createElement('div');

    // Handle pick assistant response data
    const options = [
      { key: 'option1', data: data.option1 },
      { key: 'option2', data: data.option2 },
      { key: 'option3', data: data.option3 }
    ];
    let hasValidOptions = false;

    options.forEach((option, index) => {
      if (option.data && option.data.name) {
        hasValidOptions = true;

        const optionDiv = document.createElement('div');
        optionDiv.style.cssText = `
          padding: 16px;
          border: 2px solid ${index === 0 ? '#28a745' : index === 1 ? '#ffc107' : '#17a2b8'};
          border-radius: 8px;
          margin-bottom: 12px;
          background: ${index === 0 ? '#f8fff9' : index === 1 ? '#fffef8' : '#f8fdff'};
          position: relative;
        `;

        // Add rank badge
        const rankBadge = document.createElement('div');
        rankBadge.style.cssText = `
          position: absolute;
          top: -8px;
          left: 16px;
          background: ${index === 0 ? '#28a745' : index === 1 ? '#ffc107' : '#17a2b8'};
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        `;
        rankBadge.textContent = `#${index + 1}`;
        optionDiv.appendChild(rankBadge);

        // Player name
        const playerName = document.createElement('div');
        playerName.style.cssText = `
          font-weight: 700;
          font-size: 16px;
          color: #333;
          margin-bottom: 8px;
          margin-top: 8px;
        `;
        playerName.textContent = option.data.name;
        optionDiv.appendChild(playerName);

        // Reason
        if (option.data.reason) {
          const reasonDiv = document.createElement('div');
          reasonDiv.style.cssText = `
            color: #666;
            font-size: 14px;
            line-height: 1.4;
            margin-top: 8px;
          `;
          reasonDiv.textContent = option.data.reason;
          optionDiv.appendChild(reasonDiv);
        }

        content.appendChild(optionDiv);
      }
    });

    if (!hasValidOptions) {
      const noDataDiv = document.createElement('div');
      noDataDiv.style.cssText = 'text-align: center; color: #666; padding: 20px;';
      noDataDiv.textContent = 'No recommendations available';
      content.appendChild(noDataDiv);
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