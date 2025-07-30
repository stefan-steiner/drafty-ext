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

  private findScrollbar(): HTMLElement | null {
    const playersSection = document.querySelector<HTMLElement>('.draft-players');
    if (!playersSection) {
      return null;
    }
    
    return playersSection.querySelector<HTMLElement>('.ScrollbarLayout_main.ScrollbarLayout_mainVertical.public_Scrollbar_main');
  }

  private findScrollbarFace(): HTMLElement | null {
    const playersSection = document.querySelector<HTMLElement>('.draft-players');
    if (!playersSection) {
      return null;
    }
    
    return playersSection.querySelector<HTMLElement>('.ScrollbarLayout_face.ScrollbarLayout_faceVertical.public_Scrollbar_face');
  }

  private async scrollToTop(): Promise<void> {
    const scrollbarFace = this.findScrollbarFace();
    const scrollbar = this.findScrollbar();
    if (!scrollbarFace || !scrollbar) {
      return;
    }
    
    const faceRect = scrollbarFace.getBoundingClientRect();
    const scrollbarRect = scrollbar.getBoundingClientRect();
    
    // Start position: center of the scrollbar face
    const startX = faceRect.left + faceRect.width / 2;
    const startY = faceRect.top + faceRect.height / 2;
    
    // End position: top of the scrollbar track (with a small offset to avoid edge)
    const endX = scrollbarRect.left + scrollbarRect.width / 2;
    const endY = scrollbarRect.top + 10; // 10px from the top of the scrollbar
    
    // Mouse down event on the scrollbar face
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: startX,
      clientY: startY,
      bubbles: true,
      cancelable: true,
      button: 0
    });
    
    // Mouse move event (drag to top)
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: endX,
      clientY: endY,
      bubbles: true,
      cancelable: true
    });
    
    // Mouse up event
    const mouseUpEvent = new MouseEvent('mouseup', {
      clientX: endX,
      clientY: endY,
      bubbles: true,
      cancelable: true,
      button: 0
    });
    
    // Execute the drag sequence to move scrollbar face to top
    scrollbarFace.dispatchEvent(mouseDownEvent);
    await new Promise(resolve => setTimeout(resolve, 50));
    scrollbarFace.dispatchEvent(mouseMoveEvent);
    await new Promise(resolve => setTimeout(resolve, 50));
    scrollbarFace.dispatchEvent(mouseUpEvent);
  }

  private async scrollDown(): Promise<void> {
    const scrollbarFace = this.findScrollbarFace();
    if (!scrollbarFace) {
      return;
    }
    
    const rect = scrollbarFace.getBoundingClientRect();
    const startY = rect.top + rect.height / 2;
    const endY = startY + 10; // Move 10 pixels down
    const x = rect.left + rect.width / 2;
    
    // Mouse down event on the scrollbar face
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
    
    // Execute the drag sequence on the scrollbar face
    scrollbarFace.dispatchEvent(mouseDownEvent);
    await new Promise(resolve => setTimeout(resolve, 50));
    scrollbarFace.dispatchEvent(mouseMoveEvent);
    await new Promise(resolve => setTimeout(resolve, 50));
    scrollbarFace.dispatchEvent(mouseUpEvent);
  }

  private getCurrentPlayerNames(): string[] {
    const playerRows = this.getPlayerRows();
    const playerNames = new Set<string>();
    
    for (const playerRow of playerRows) {
      const name = playerRow.getName().trim();
      if (name) {
        playerNames.add(name);
      }
    }
    
    return Array.from(playerNames);
  }

  async getPlayerNames(requiredCount: number): Promise<string[]> {
    console.log(`ESPN Parser: Getting ${requiredCount} player names`);
    
    // Step 2: Scroll to top
    await this.scrollToTop();
    
    // Step 3: Small delay for DOM update
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Step 4: Loop while collecting players
    const playerNames = new Set<string>();
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loops
    
    while (attempts < maxAttempts && playerNames.size < requiredCount) {
      // Read current player names
      const currentNames = this.getCurrentPlayerNames();
      currentNames.forEach(name => playerNames.add(name));
      
      console.log(`ESPN Parser: Found ${playerNames.size} unique player names (needed ${requiredCount})`);
      
      // If we have enough players, break
      if (playerNames.size >= requiredCount) {
        break;
      }
      
      // Scroll down slightly
      await this.scrollDown();
      
      // Small delay for DOM update
      await new Promise(resolve => setTimeout(resolve, 200));
      
      attempts++;
    }
    
    // Step 5: Scroll back to top
    await this.scrollToTop();
    
    console.log(`ESPN Parser: Final collection: ${playerNames.size} player names`);
    return Array.from(playerNames);
  }
} 