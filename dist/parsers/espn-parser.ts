import { SiteParser, PlayerRow, PlayerData } from '../types';
import { BaseParser } from './base-parser';

// ESPN-specific constants
const PLAYER_NAME_SELECTOR = '.playerinfo__playername';

export class ESPNPlayerRow implements PlayerRow {
  constructor(public root: HTMLElement) {}

  getName(): string {
    const nameElement = this.root.querySelector<HTMLElement>(PLAYER_NAME_SELECTOR);
    if (!nameElement) {
      return '';
    }
    
    // Clone the element to avoid modifying the original DOM
    const clonedElement = nameElement.cloneNode(true) as HTMLElement;
    
    // Remove any existing buttons from the clone
    const buttons = clonedElement.querySelectorAll('.drafty-action-btn');
    buttons.forEach(btn => btn.remove());
    
    return clonedElement.textContent?.trim() || '';
  }

  setNote(note: string) {
    console.log(`Setting note for ${this.getName()}: ${note}`);
  }

  addActionButton(callback: () => void): void {
    // Check if button already exists
    if (this.root.querySelector('.drafty-action-btn')) {
      return;
    }

    const nameElement = this.root.querySelector<HTMLElement>(PLAYER_NAME_SELECTOR);
    if (!nameElement) {
      return;
    }

    const button = document.createElement('button');
    button.className = 'drafty-action-btn';
    button.title = 'Get player insights';
    
    // Load SVG from file
    const svgUrl = chrome.runtime.getURL('assets/drafty_logo_d.svg');
    const img = document.createElement('img');
    img.src = svgUrl;
    img.style.cssText = `
      width: 12px;
      height: 12px;
      filter: brightness(0) invert(1);
    `;
    
    button.appendChild(img);
    
    button.style.cssText = `
      background: #87CEEB;
      color: white;
      border: none;
      border-radius: 3px;
      padding: 2px;
      width: 18px;
      height: 18px;
      cursor: pointer;
      margin-left: 8px;
      margin-top: 2px;
      transition: background-color 0.2s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: text-bottom;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = '#5F9EA0';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#87CEEB';
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      callback();
    });

    // Place button in the flex container or next to the name element
    const flexContainer = nameElement.closest('.flex');
    if (flexContainer && !flexContainer.querySelector('.drafty-action-btn')) {
      flexContainer.appendChild(button);
    } else {
      const parent = nameElement.parentElement;
      if (parent && !parent.querySelector('.drafty-action-btn')) {
        parent.insertBefore(button, nameElement.nextSibling);
      }
    }
  }
}

export class ESPNParser extends BaseParser {
  name = 'ESPN';

  canParse(url: string): boolean {
    return url.includes('fantasy.espn.com/football/draft');
  }

  getPlayerRows(): PlayerRow[] {
    const playersSection = document.querySelector<HTMLElement>('.draft-players');
    if (!playersSection) {
      return [];
    }
    
    // Find all player name elements
    const playerNameElements = playersSection.querySelectorAll<HTMLElement>(PLAYER_NAME_SELECTOR);
    if (playerNameElements.length === 0) {
      return [];
    }
    
    // Get unique row elements that contain player names
    const playerRows = new Set<HTMLElement>();
    
    playerNameElements.forEach(nameElement => {
      const rowElement = nameElement.closest('[role="row"]') || 
                        nameElement.closest('tr') || 
                        nameElement.closest('[class*="row"]') ||
                        nameElement.closest('div[class*="row"]');
      
      if (rowElement) {
        playerRows.add(rowElement as HTMLElement);
      }
    });
    
    return Array.from(playerRows).map(row => new ESPNPlayerRow(row));
  }

  async getPlayerData(playerName: string): Promise<PlayerData | null> {
    return null;
  }

  private createLoadingOverlay(): HTMLElement {
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
      border-top: 4px solid #87CEEB;
      border-radius: 50%;
      animation: drafty-spin 1s linear infinite;
    `;
    
    // Add loading text
    const text = document.createElement('div');
    text.textContent = 'Loading players...';
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
    
    return overlay;
  }

  private removeLoadingOverlay(): void {
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

  private async scrollToTop(scrollbarElement: HTMLElement): Promise<void> {
    const rect = scrollbarElement.getBoundingClientRect();
    const topY = rect.top + 5; // Click near the top of the scrollbar
    const x = rect.left + rect.width / 2; // Middle horizontally
    
    // Mouse down event at top
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: x,
      clientY: topY,
      bubbles: true,
      cancelable: true,
      button: 0
    });
    
    // Mouse up event at top
    const mouseUpEvent = new MouseEvent('mouseup', {
      clientX: x,
      clientY: topY,
      bubbles: true,
      cancelable: true,
      button: 0
    });
    
    // Execute the click sequence to go to top
    scrollbarElement.dispatchEvent(mouseDownEvent);
    await new Promise(resolve => setTimeout(resolve, 50));
    scrollbarElement.dispatchEvent(mouseUpEvent);
    await new Promise(resolve => setTimeout(resolve, 200)); // Wait for scroll to complete
  }

  async scrollForMorePlayers(): Promise<boolean> {
    // First find the players section to scope our search
    const playersSection = document.querySelector<HTMLElement>('.draft-players');
    if (!playersSection) {
      console.error('ESPN Parser: Could not find players section');
      return false;
    }
    
    // Try to find the scrollbar element specifically within the players section
    const scrollbarElement = playersSection.querySelector<HTMLElement>('.ScrollbarLayout_main.ScrollbarLayout_mainVertical.public_Scrollbar_main');
    
    if (!scrollbarElement) {
      console.error('ESPN Parser: Could not find scrollbar element within players section');
      return false;
    }
    
    console.log('ESPN Parser: Found scrollbar element, attempting scroll...');
    
    // Create and add loading overlay
    const loadingOverlay = this.createLoadingOverlay();
    document.body.appendChild(loadingOverlay);
    
    try {
      // Wait a moment for the overlay to be fully rendered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // First, go to the top of the scrollbar
      console.log('ESPN Parser: Going to top of scrollbar...');
      await this.scrollToTop(scrollbarElement);
      
      // Simulate a small mouse drag operation on the scrollbar
      const rect = scrollbarElement.getBoundingClientRect();
      const startY = rect.top + rect.height * 0.4; // Start at 40% down the scrollbar
      const endY = startY + 5; // Move just 5 pixels down
      const x = rect.left + rect.width / 2; // Middle horizontally
      
      // Mouse down event
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: x,
        clientY: startY,
        bubbles: true,
        cancelable: true,
        button: 0
      });
      
      // Mouse move event (small drag)
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: x,
        clientY: endY,
        bubbles: true,
        cancelable: true
      });
      
      // Mouse up event
      const mouseUpEvent = new MouseEvent('mouseup', {
        clientX: x,
        clientY: endY,
        bubbles: true,
        cancelable: true,
        button: 0
      });
      
      // Execute the drag sequence
      scrollbarElement.dispatchEvent(mouseDownEvent);
      await new Promise(resolve => setTimeout(resolve, 50));
      scrollbarElement.dispatchEvent(mouseMoveEvent);
      await new Promise(resolve => setTimeout(resolve, 50));
      scrollbarElement.dispatchEvent(mouseUpEvent);
      await new Promise(resolve => setTimeout(resolve, 300)); // Wait for scroll to complete
      
      // Finally, go back to the top of the scrollbar
      console.log('ESPN Parser: Returning to top of scrollbar...');
      await this.scrollToTop(scrollbarElement);
      
      return true; // Always return true since we attempted the scroll
    } finally {
      // Always remove the loading overlay when done
      this.removeLoadingOverlay();
    }
  }

  async getPlayerNames(requiredCount: number): Promise<string[]> {
    console.log(`ESPN Parser: Attempting to get ${requiredCount} player names`);
    
    const playerNames = new Set<string>();
    let attempts = 0;
    const maxAttempts = 50; // Prevent infinite loops
    
    while (attempts < maxAttempts && playerNames.size < requiredCount) {
      // Get all player rows currently in the DOM
      const currentPlayerRows = this.getPlayerRows();
      
      // Update the set with player names
      for (const playerRow of currentPlayerRows) {
        const name = playerRow.getName().trim();
        if (name) {
          playerNames.add(name);
        }
      }
      
      console.log(`ESPN Parser: Found ${playerNames.size} unique player names (needed ${requiredCount})`);
      
      // If we have enough players, break
      if (playerNames.size >= requiredCount) {
        break;
      }
      
      // Scroll for more players
      await this.scrollForMorePlayers();
      
      attempts++;
      console.log(`ESPN Parser: Scroll attempt ${attempts}/${maxAttempts}`);
    }
    
    console.log(`ESPN Parser: Final collection: ${playerNames.size} player names`);
    
    // Convert set to array and return
    return Array.from(playerNames);
  }
} 