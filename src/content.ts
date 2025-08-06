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
    this.setupStorageListener();
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

  private setupStorageListener(): void {
    // Listen for storage changes to detect auth token updates
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.auth_token) {
        this.initializeAuth();
      }
    });
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

    // Check authentication first
    const token = await this.storageService.getAuthToken();
    if (!token) {
      this.showAuthPopup();
      return;
    }

    try {
      const response = await this.apiService.getPlayerDataByName(playerName, 'standard');

      if (response.success && response.data) {
        this.showPlayerData(playerRow.root, playerName, response.data);
      } else {
        this.showError(`Failed to get data for ${playerName}: ${response.error}`);
      }
    } catch (error) {
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
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 24px;
      z-index: 10001;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      width: 90vw;
      max-width: 1200px;
      max-height: 80vh;
      overflow-y: auto;
    `;

    // Create popup content
    const title = document.createElement('h3');
    title.style.cssText = `
      margin: 0 0 20px 0;
      color: #1a1a1a;
      font-size: 24px;
      font-weight: 800;
      font-family: 'Inter', system-ui, sans-serif;
      line-height: 1.2;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    // Left side - Player name
    const titleText = document.createElement('span');
    titleText.textContent = `${data.full_name || playerName}`;

    // Right side - Drafty logo
    const logoContainer = document.createElement('div');
    const svgUrl = chrome.runtime.getURL('assets/drafty_logo_blue.svg');
    const img = document.createElement('img');
    img.src = svgUrl;
    img.style.cssText = `
      width: 110px;
      height: 45px;
    `;
    logoContainer.appendChild(img);

    title.appendChild(titleText);
    title.appendChild(logoContainer);

    const content = document.createElement('div');

    // Add simplified player info section
    const basicInfo = document.createElement('div');
    basicInfo.style.cssText = 'margin-bottom: 8px; background: white; border-radius: 8px; overflow: hidden; transition: background-color 0.2s ease; border: 2px solid transparent;';

    const basicInfoContent = document.createElement('div');
    basicInfoContent.style.cssText = `
      padding: 16px;
      line-height: 1.2;
      color: #444;
      font-family: 'Inter', system-ui, sans-serif;
    `;

    let basicInfoHtml = '';
    if (data.position) basicInfoHtml += `<div style="margin-bottom: 6px;"><span style="font-size: 14px; font-weight: 600; color: #333;">Position:</span> <span style="font-size: 14px; font-weight: 800; color: #333;">${data.position}</span></div>`;
    if (data.team) basicInfoHtml += `<div style="margin-bottom: 6px;"><span style="font-size: 14px; font-weight: 600; color: #333;">Team:</span> <span style="font-size: 14px; font-weight: 800; color: #333;">${data.team}</span></div>`;
    if (data.rank) basicInfoHtml += `<div style="margin-bottom: 6px;"><span style="font-size: 14px; font-weight: 600; color: #333;">Expert Consensus Rank:</span> <span style="font-size: 14px; font-weight: 800; color: #333;">${data.rank}</span></div>`;
    if (data.adp) basicInfoHtml += `<div style="margin-bottom: 6px;"><span style="font-size: 14px; font-weight: 600; color: #333;">Average Draft Position:</span> <span style="font-size: 14px; font-weight: 800; color: #333;">${data.adp}</span></div>`;

    basicInfoContent.innerHTML = basicInfoHtml;
    basicInfo.appendChild(basicInfoContent);

    // Add hover effect
    basicInfo.addEventListener('mouseenter', () => {
      basicInfo.style.border = '2px solid #333';
    });

    basicInfo.addEventListener('mouseleave', () => {
      basicInfo.style.border = '2px solid transparent';
    });
    content.appendChild(basicInfo);

    // Add CSS to ensure bullet points are always visible
    if (!document.querySelector('#drafty-bullet-styles')) {
      const style = document.createElement('style');
      style.id = 'drafty-bullet-styles';
      style.textContent = `
        .drafty-popup ul {
          list-style-type: disc !important;
          list-style-position: outside !important;
          padding-left: 20px !important;
        }
        .drafty-popup li {
          display: list-item !important;
          margin-bottom: 4px !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Helper function to format bullet points
    const formatBulletPoints = (text: string): string => {
      if (!text) return '';

      // Split by newlines and filter out empty lines
      const lines = text.split('\n').filter(line => line.trim());

      // If we have multiple lines and some start with dashes, format as bullet points
      const hasBulletPoints = lines.some(line => line.trim().startsWith('-'));

      if (hasBulletPoints) {
        return lines.map(line => {
          const trimmedLine = line.trim();
          // If line starts with dash, convert to bullet point
          if (trimmedLine.startsWith('-')) {
            const content = trimmedLine.substring(1).trim();
            return `<li>${content}</li>`;
          }
          // If line doesn't start with dash but we're in bullet point mode,
          // treat as regular paragraph (this handles mixed content)
          return `<p>${trimmedLine}</p>`;
        }).join('');
      } else {
        // If no bullet points found, try to split by sentences and create bullet points
        // This handles cases where the LLM returns a paragraph instead of bullet points
        const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 10);

        if (sentences.length > 1) {
          return sentences.map(sentence => {
            const trimmed = sentence.trim();
            if (trimmed) {
              return `<li>${trimmed}</li>`;
            }
            return '';
          }).join('');
        } else {
          // Single paragraph, just return as is
          return `<p>${text.trim()}</p>`;
        }
      }
    };

    // Helper function to render content with proper bullet styling and gradient backgrounds
    const renderContentWithBullets = (title: string, content: string, iconType: string = 'default'): HTMLElement => {
      const container = document.createElement('div');
      container.style.cssText = 'margin-bottom: 8px; background: white; border-radius: 8px; overflow: hidden; transition: background-color 0.2s ease; border: 2px solid transparent;';

      const titleDiv = document.createElement('div');
      titleDiv.style.cssText = `
        font-weight: 600;
        font-size: 16px;
        color: #333;
        padding: 16px 16px 12px 16px;
        font-family: 'Inter', system-ui, sans-serif;
        display: flex;
        align-items: center;
        gap: 8px;
      `;

      // Create icon based on type
      let iconHtml = '';
      if (iconType === 'upside') {
        iconHtml = '<span style="color: #28a745; font-size: 14px;">▲</span>';
      } else if (iconType === 'downside') {
        iconHtml = '<span style="color: #dc3545; font-size: 14px;">▼</span>';
      } else if (iconType === 'overview') {
        iconHtml = '<span style="color: #00BFFF; font-size: 14px;">●</span>';
      }

      titleDiv.innerHTML = `${iconHtml}<span>${title}</span>`;

      const contentDiv = document.createElement('div');
      contentDiv.style.cssText = `
        padding: 0 16px 16px 16px;
        line-height: 1.6;
        color: #444;
        font-family: 'Inter', system-ui, sans-serif;
      `;

      const formattedContent = formatBulletPoints(content);

      if (formattedContent.includes('<li>')) {
        // Has bullet points - create proper ul with explicit bullet styling
        const ul = document.createElement('ul');
        ul.style.cssText = `
          margin: 0;
          padding-left: 20px;
          line-height: 1.6;
          list-style-type: disc !important;
          list-style-position: outside;
        `;

        // Extract li elements and append them to the ul
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = formattedContent;
        const liElements = tempDiv.querySelectorAll('li');
        liElements.forEach(li => ul.appendChild(li.cloneNode(true)));

        contentDiv.appendChild(ul);
      } else {
        // Regular text
        contentDiv.innerHTML = formattedContent;
      }

      container.appendChild(titleDiv);
      container.appendChild(contentDiv);

      // Add hover effect
      container.addEventListener('mouseenter', () => {
        if (iconType === 'overview') {
          container.style.border = '2px solid #00BFFF';
        } else if (iconType === 'upside') {
          container.style.border = '2px solid #28a745';
        } else if (iconType === 'downside') {
          container.style.border = '2px solid #dc3545';
        } else {
          container.style.border = '2px solid #333';
        }
      });

      container.addEventListener('mouseleave', () => {
        container.style.border = '2px solid transparent';
      });

      return container;
    };

    // Add player overview
    if (data.player_overview) {
      const overviewDiv = renderContentWithBullets('Overview', data.player_overview, 'overview');
      content.appendChild(overviewDiv);
    }

    // Add upside
    if (data.upside) {
      const upsideDiv = renderContentWithBullets('Upside', data.upside, 'upside');
      content.appendChild(upsideDiv);
    }

    // Add downside
    if (data.downside) {
      const downsideDiv = renderContentWithBullets('Downside', data.downside, 'downside');
      content.appendChild(downsideDiv);
    }

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
      background: #00BFFF;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      font-family: 'Inter', system-ui, sans-serif;
      transition: all 0.2s ease;
      margin-top: 16px;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#00008B';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = '#00BFFF';
    });

    // Add overlay first (before event handlers that reference it)
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.4);
      z-index: 10000;
    `;

    overlay.addEventListener('click', () => {
      overlay.remove();
      popup.remove();
      document.removeEventListener('keydown', handleEscape);
    });

    closeButton.addEventListener('click', () => {
      popup.remove();
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    });

    // Add click outside to close
    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        popup.remove();
        overlay.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    });

    // Add escape key to close
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        popup.remove();
        overlay.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Assemble popup
    popup.appendChild(title);
    popup.appendChild(content);
    popup.appendChild(closeButton);

    // Add to DOM
    document.body.appendChild(overlay);
    document.body.appendChild(popup);
  }

  private showAuthPopup(): void {
    // Remove any existing popup
    const existingPopup = document.querySelector('.drafty-auth-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'drafty-auth-popup';
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
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      max-width: 400px;
      text-align: center;
    `;

    // Create logo container at the top
    const logoContainer = document.createElement('div');
    logoContainer.style.cssText = `
      display: flex;
      justify-content: center;
      margin-bottom: 20px;
    `;

    const svgUrl = chrome.runtime.getURL('assets/drafty_logo_blue.svg');
    const img = document.createElement('img');
    img.src = svgUrl;
    img.style.cssText = `
      width: 110px;
      height: 45px;
    `;
    logoContainer.appendChild(img);

    // Create popup content
    const title = document.createElement('h3');
    title.textContent = 'Login Required';
    title.style.cssText = `
      margin: 0 0 20px 0;
      color: #333;
      font-size: 20px;
      font-weight: 600;
    `;

    // Create steps container
    const stepsContainer = document.createElement('div');
    stepsContainer.style.cssText = `
      color: #666;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 20px;
      text-align: left;
    `;

    // Step 1: Click the chrome extension button
    const step1 = document.createElement('div');
    step1.style.cssText = `
      display: flex;
      align-items: flex-start;
      margin-bottom: 20px;
      gap: 12px;
    `;

    const chromeIcon = document.createElement('div');
    const chromeSvgUrl = chrome.runtime.getURL('assets/chrome_puzzle.svg');
    const chromeImg = document.createElement('img');
    chromeImg.src = chromeSvgUrl;
    chromeImg.style.cssText = `
      width: 20px;
      height: 20px;
      color: #666;
    `;
    chromeIcon.appendChild(chromeImg);
    chromeIcon.style.cssText = `
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    `;

    const step1Text = document.createElement('span');
    step1Text.textContent = 'Click the chrome extension button in the top right of your browser';
    step1Text.style.cssText = `
      font-weight: 500;
      line-height: 1.4;
    `;

    step1.appendChild(chromeIcon);
    step1.appendChild(step1Text);

    // Step 2: Click on Drafty
    const step2 = document.createElement('div');
    step2.style.cssText = `
      display: flex;
      align-items: flex-start;
      margin-bottom: 20px;
      gap: 12px;
    `;

    const draftyIcon = document.createElement('div');
    const draftySvgUrl = chrome.runtime.getURL('assets/drafty_logo_d.svg');
    const draftyImg = document.createElement('img');
    draftyImg.src = draftySvgUrl;
    draftyImg.style.cssText = `
      width: 20px;
      height: 20px;
      filter: brightness(0) invert(1);
    `;
    draftyIcon.appendChild(draftyImg);
    draftyIcon.style.cssText = `
      background: #00BFFF;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    `;

    const step2Text = document.createElement('span');
    step2Text.textContent = 'Click on the Drafty extension';
    step2Text.style.cssText = `
      font-weight: 500;
      line-height: 1.4;
    `;

    step2.appendChild(draftyIcon);
    step2.appendChild(step2Text);

    // Step 3: Login with your email and password
    const step3 = document.createElement('div');
    step3.style.cssText = `
      display: flex;
      align-items: flex-start;
      margin-bottom: 20px;
      gap: 12px;
    `;

    const loginIcon = document.createElement('div');
    loginIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#000000"/>
    </svg>`;
    loginIcon.style.cssText = `
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    `;

    const step3Text = document.createElement('span');
    step3Text.textContent = 'Login with your email and password';
    step3Text.style.cssText = `
      font-weight: 500;
      line-height: 1.4;
    `;

    step3.appendChild(loginIcon);
    step3.appendChild(step3Text);

    // Add steps to container
    stepsContainer.appendChild(step1);
    stepsContainer.appendChild(step2);
    stepsContainer.appendChild(step3);

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
      background: #00BFFF;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      font-family: 'Inter', system-ui, sans-serif;
      transition: all 0.2s ease;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#00008B';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = '#00BFFF';
    });

    // Add overlay first (before event handlers that reference it)
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

    closeButton.addEventListener('click', () => {
      popup.remove();
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    });

    // Add click outside to close
    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        popup.remove();
        overlay.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    });

    // Add escape key to close
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        popup.remove();
        overlay.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Assemble popup
    popup.appendChild(logoContainer);
    popup.appendChild(title);
    popup.appendChild(stepsContainer);
    popup.appendChild(closeButton);

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
      font-family: 'Inter', system-ui, sans-serif;
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
      border-radius: 8px;
      padding: 15px;
      cursor: pointer;
      z-index: 10000;
      font-family: 'Inter', system-ui, sans-serif;
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
    // Check authentication first
    const token = await this.storageService.getAuthToken();
    if (!token) {
      this.showAuthPopup();
      return;
    }

    try {
      // Step 1: Show loading overlay for searching players
      this.showLoadingOverlay('Searching available players');

      // Step 2-6: Get player names using parser
      const currentUrl = window.location.href;
      const parser = this.parserManager.getParserForUrl(currentUrl);

      if (!parser) {
        this.hideLoadingOverlay();
        this.showError('No parser found for this URL');
        return;
      }

      const availableNames = await parser.getAvailableNames(25);
      const draftedNames = await parser.getDraftedNames();

      // Remove the first loading overlay
      this.hideLoadingOverlay();

      if (availableNames.length === 0) {
        this.showError('No players found on this page');
        return;
      }
      console.log('Available players:', availableNames);
      console.log('Drafted players:', draftedNames);

      // Step 7: Show loading overlay for analyzing picks
      this.showLoadingOverlay('Analyzing possible picks');

      // Step 8: Call backend API
      // Prepare API request based on the parser type
      let apiRequest: any = {
        players_available: availableNames,
        scoring_type: 'standard' // You can make this configurable later
      };

      // Use the parser's helper method to determine the format
      if (parser.usesDraftAbbreviations()) {
        // Yahoo format - array of DraftedPlayer objects
        apiRequest.players_drafted_abbreviations = draftedNames;

      } else {
        // ESPN format - array of strings
        apiRequest.players_drafted = draftedNames;
      }

      const response = await this.apiService.pickAssistant(apiRequest);

      // Step 9: Remove loading overlay and show results
      this.hideLoadingOverlay();

      if (response.success && response.data) {
        this.showPickAssistant(response.data);
      } else {
        this.showError(`Failed to get player data: ${response.error}`);
      }
    } catch (error) {
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
      font-family: 'Inter', system-ui, sans-serif;
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
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 24px;
      z-index: 10001;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      width: 70vw;
      max-width: 1400px;
      max-height: 80vh;
      overflow-y: auto;
    `;

    // Create popup content
    const title = document.createElement('h3');
    title.style.cssText = `
      margin: 0 0 20px 0;
      color: #1a1a1a;
      font-size: 24px;
      font-weight: 800;
      font-family: 'Inter', system-ui, sans-serif;
      line-height: 1.2;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    // Left side - "Top 3 Picks"
    const titleText = document.createElement('span');
    titleText.textContent = 'Top 3 Picks';

    // Right side - Drafty logo
    const logoContainer = document.createElement('div');
    const svgUrl = chrome.runtime.getURL('assets/drafty_logo_blue.svg');
    const img = document.createElement('img');
    img.src = svgUrl;
    img.style.cssText = `
      width: 110px;
      height: 45px;
    `;
    logoContainer.appendChild(img);

    title.appendChild(titleText);
    title.appendChild(logoContainer);

    const content = document.createElement('div');
    content.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    `;

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
          background: white;
          border-radius: 8px;
          overflow: hidden;
          transition: background-color 0.2s ease;
          border: 2px solid transparent;
          padding: 16px;
          min-height: 200px;
          display: flex;
          flex-direction: column;
        `;

        // Player name
        const playerName = document.createElement('div');
        playerName.style.cssText = `
          font-weight: 700;
          font-size: 18px;
          color: #333;
          margin-bottom: 12px;
          font-family: 'Inter', system-ui, sans-serif;
        `;
        playerName.textContent = option.data.name;
        optionDiv.appendChild(playerName);

        // Reason
        if (option.data.reason) {
          const reasonDiv = document.createElement('div');
          reasonDiv.style.cssText = `
            color: #444;
            font-size: 14px;
            line-height: 1.6;
            font-family: 'Inter', system-ui, sans-serif;
            flex-grow: 1;
          `;
          reasonDiv.textContent = option.data.reason;
          optionDiv.appendChild(reasonDiv);
        }

        // Add hover effect
        optionDiv.addEventListener('mouseenter', () => {
          optionDiv.style.border = '2px solid #00BFFF';
        });

        optionDiv.addEventListener('mouseleave', () => {
          optionDiv.style.border = '2px solid transparent';
        });

        content.appendChild(optionDiv);
      }
    });

    if (!hasValidOptions) {
      const noDataDiv = document.createElement('div');
      noDataDiv.style.cssText = 'text-align: center; color: #666; padding: 20px; grid-column: 1 / -1;';
      noDataDiv.textContent = 'No recommendations available';
      content.appendChild(noDataDiv);
    }

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
      background: #00BFFF;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      font-family: 'Inter', system-ui, sans-serif;
      transition: all 0.2s ease;
      margin-top: 16px;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#00008B';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = '#00BFFF';
    });

    // Add overlay first (before event handlers that reference it)
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.4);
      z-index: 10000;
    `;

    overlay.addEventListener('click', () => {
      overlay.remove();
      popup.remove();
      document.removeEventListener('keydown', handleEscape);
    });

    closeButton.addEventListener('click', () => {
      popup.remove();
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    });

    // Add click outside to close
    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        popup.remove();
        overlay.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    });

    // Add escape key to close
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        popup.remove();
        overlay.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Assemble popup
    popup.appendChild(title);
    popup.appendChild(content);
    popup.appendChild(closeButton);

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

    const existingBulkPopup = document.querySelector('.drafty-bulk-popup');
    if (existingBulkPopup) {
      existingBulkPopup.remove();
    }

    const existingAuthPopup = document.querySelector('.drafty-auth-popup');
    if (existingAuthPopup) {
      existingAuthPopup.remove();
    }

    const existingOverlay = document.querySelector('div[style*="rgba(0,0,0,0.5)"]');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // Clean up CSS styles
    const bulletStyles = document.querySelector('#drafty-bullet-styles');
    if (bulletStyles) {
      bulletStyles.remove();
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