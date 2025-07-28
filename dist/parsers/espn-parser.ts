import { SiteParser, PlayerRow, PlayerData } from '../types';

export class ESPNPlayerRow implements PlayerRow {
  constructor(public root: HTMLElement) {}

  private nameSelectors = [
    '.playerinfo__playername',
    '.player-name',
    '[data-testid="player-name"]'
  ];

  getName(): string {
    // Try to find the player name using various selectors
    for (const selector of this.nameSelectors) {
      const nameElement = this.root.querySelector<HTMLElement>(selector);
      if (nameElement) {
        // Clone the element to avoid modifying the original DOM
        const clonedElement = nameElement.cloneNode(true) as HTMLElement;
        
        // Remove any existing buttons from the clone
        const buttons = clonedElement.querySelectorAll('.drafty-action-btn');
        buttons.forEach(btn => btn.remove());
        
        // Get clean text content
        const text = clonedElement.textContent?.trim() || '';
        if (text) {
          return text;
        }
      }
    }
    
    // Fallback: try to get text from the entire row
    const clonedRoot = this.root.cloneNode(true) as HTMLElement;
    const buttons = clonedRoot.querySelectorAll('.drafty-action-btn');
    buttons.forEach(btn => btn.remove());
    
    return clonedRoot.textContent?.trim() || '';
  }

  setNote(note: string) {
    // ESPN-specific note setting logic could go here
    console.log(`Setting note for ${this.getName()}: ${note}`);
  }

  addActionButton(callback: () => void): void {
    // Check if button already exists in this specific row
    if (this.root.querySelector('.drafty-action-btn')) {
      return;
    }

    // Find the name cell first (ESPN-specific)
    const nameElement = this.nameSelectors
      .map(sel => this.root.querySelector<HTMLElement>(sel))
      .find(Boolean);
    
    if (!nameElement) {
      return;
    }

    const button = document.createElement('button');
    button.className = 'drafty-action-btn';
    button.title = 'Get player insights';
    
    // Load SVG from file
    const svgUrl = chrome.runtime.getURL('assets/drafty_logo_d.svg');
    
    // Create an img element to load the SVG
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

    // ESPN-specific button placement logic
    const flexContainer = nameElement.closest('.flex');
    
    if (flexContainer && !flexContainer.querySelector('.drafty-action-btn')) {
      // Insert the button after the player name span within the flex container
      flexContainer.appendChild(button);
    } else {
      // Fallback: if we can't find the flex container, insert after the element itself
      const parent = nameElement.parentElement;
      if (parent && !parent.querySelector('.drafty-action-btn')) {
        parent.insertBefore(button, nameElement.nextSibling);
      }
    }
  }
}

export class ESPNParser implements SiteParser {
  name = 'ESPN';

  canParse(url: string): boolean {
    return url.includes('fantasy.espn.com/football/draft');
  }

  getPlayerRows(): PlayerRow[] {
    // Only target the first .draft-players section (Players tab) - ESPN-specific
    const playersSection = document.querySelector<HTMLElement>('.draft-players');
    
    if (!playersSection) {
      return []; // No players section found
    }
    
    // Find player rows within the players section - ESPN-specific
    const playerRows = playersSection.querySelectorAll<HTMLElement>('[role="row"]');
    
    if (playerRows.length === 0) {
      // Try alternative row selectors for ESPN
      const alternativeRowSelectors = [
        'tr',
        '[class*="row"]',
        '[class*="player"]',
        'div[class*="row"]'
      ];
      
      for (const selector of alternativeRowSelectors) {
        const altRows = playersSection.querySelectorAll<HTMLElement>(selector);
        if (altRows.length > 0) {
          return Array.from(altRows).map(row => new ESPNPlayerRow(row));
        }
      }
      
      return [];
    }
    
    return Array.from(playerRows).map(row => new ESPNPlayerRow(row));
  }

  async getPlayerData(playerName: string): Promise<PlayerData | null> {
    // ESPN-specific player data fetching logic could go here
    // For now, return null as the main API service handles this
    return null;
  }
} 