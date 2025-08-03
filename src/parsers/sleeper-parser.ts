import { PlayerRow } from '../types';
import { BaseParser } from './base-parser';

// Sleeper-specific constants
const PLAYER_NAME_SELECTOR = '.name-wrapper';

export class SleeperPlayerRow implements PlayerRow {
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

    // Get just the player name (first text node, before the position div)
    const textContent = clonedElement.childNodes[0]?.textContent?.trim() || '';
    return textContent;
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
      background: #00BFFF;
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
      button.style.background = '#00008B';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#00BFFF';
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      callback();
    });

    // Insert button after the name element
    nameElement.parentElement?.insertBefore(button, nameElement.nextSibling);
  }
}

export class SleeperParser extends BaseParser {
  name = 'Sleeper';

  canParse(url: string): boolean {
    return url.startsWith("https://sleeper.com/draft");
  }

  getPlayerRows(): PlayerRow[] {
    const playersSection = document.querySelector<HTMLElement>('.draft-rankings');
    if (!playersSection) {
      return [];
    }

    // Find all player rank items
    const playerRows = playersSection.querySelectorAll<HTMLElement>('.player-rank-item2');
    if (playerRows.length === 0) {
      return [];
    }

    // Convert to array and sort by vertical position (top to bottom)
    const sortedRows = Array.from(playerRows).sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      return rectA.top - rectB.top;
    });

    return sortedRows.map(row => new SleeperPlayerRow(row));
  }

  private findScrollbar(): HTMLElement | null {
    const playersSection = document.querySelector<HTMLElement>('.draft-rankings');
    if (!playersSection) {
      return null;
    }

    return playersSection.querySelector<HTMLElement>('.ps__rail-y');
  }

  private findScrollbarFace(): HTMLElement | null {
    const playersSection = document.querySelector<HTMLElement>('.draft-rankings');
    if (!playersSection) {
      return null;
    }

    return playersSection.querySelector<HTMLElement>('.ps__thumb-y');
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
    const endY = scrollbarRect.top + 1; // 1px from the top of the scrollbar

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
    const endY = startY + 1; // Move 1 pixel down
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
    const playerNames: string[] = [];

    for (const playerRow of playerRows) {
      const name = playerRow.getName().trim();
      if (name) {
        playerNames.push(name);
      }
    }

    return playerNames;
  }

  async getAvailableNames(requiredCount: number): Promise<string[]> {
    console.log(`Sleeper Parser: Getting ${requiredCount} available player names`);

    // Step 2: Scroll to top
    await this.scrollToTop();

    // Step 3: Small delay for DOM update
    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 4: Loop while collecting players
    const playerNames: string[] = [];
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loops

    while (attempts < maxAttempts && playerNames.length < requiredCount) {
      // Read current player names
      const currentNames = this.getCurrentPlayerNames();
      currentNames.forEach(name => {
        if (!playerNames.includes(name)) {
          playerNames.push(name);
        }
      });

      console.log(`Sleeper Parser: Found ${playerNames.length} unique player names (needed ${requiredCount})`);

      // If we have enough players, break
      if (playerNames.length >= requiredCount) {
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

    // Step 6: Return exactly the first requiredCount players
    const finalNames = playerNames.slice(0, requiredCount);
    console.log(`Sleeper Parser: Final collection: ${finalNames.length} player names`);
    return finalNames;
  }

  private findDraftRosterSection(): HTMLElement | null {
    // First try to find the draft-roster2-teams directly
    let rosterSection = document.querySelector<HTMLElement>('.draft-roster2-teams');

    if (!rosterSection) {
      // If not found, look for the Roster tab and click it
      const tabElements = document.querySelectorAll<HTMLElement>('.round-tab .tab .text-wrapper');
      for (const tabElement of tabElements) {
        if (tabElement.textContent?.trim() === 'Roster') {
          const tabButton = tabElement.closest('.round-tab') as HTMLElement;
          if (tabButton) {
            tabButton.click();
            // Wait a bit for the content to load
            setTimeout(() => {
              rosterSection = document.querySelector<HTMLElement>('.draft-roster2-teams');
            }, 500);
            break;
          }
        }
      }
    }

    return rosterSection;
  }

  private findDraftedPlayerElements(): HTMLElement[] {
    const rosterSection = this.findDraftRosterSection();
    if (!rosterSection) {
      return [];
    }

    // Find all player data elements (not empty ones)
    const playerElements = rosterSection.querySelectorAll<HTMLElement>('.player-data');
    return Array.from(playerElements);
  }

  private getCurrentDraftedNames(): string[] {
    const playerElements = this.findDraftedPlayerElements();
    const draftedPlayers: string[] = [];

    for (const element of playerElements) {
      // Extract name from the .name element
      const nameElement = element.querySelector<HTMLElement>('.name');
      const name = nameElement?.textContent?.trim() || '';

      if (name) {
        draftedPlayers.push(name);
      }
    }

    return draftedPlayers;
  }

  async getDraftedNames(): Promise<string[]> {
    console.log(`Sleeper Parser: Getting all drafted player names`);

    // Step 1: Check if roster section exists or needs to be accessed via tab
    let rosterSection = this.findDraftRosterSection();

    if (!rosterSection) {
      // If not found, look for the Roster tab and click it
      const tabElements = document.querySelectorAll<HTMLElement>('.round-tab .tab .text-wrapper');
      for (const tabElement of tabElements) {
        if (tabElement.textContent?.trim() === 'Roster') {
          const tabButton = tabElement.closest('.round-tab') as HTMLElement;
          if (tabButton) {
            tabButton.click();
            // Wait a bit for the content to load
            await new Promise(resolve => setTimeout(resolve, 500));
            rosterSection = document.querySelector<HTMLElement>('.draft-roster2-teams');
            break;
          }
        }
      }
    }

    if (!rosterSection) {
      console.log(`Sleeper Parser: Could not find draft roster section`);
      return [];
    }

    // Step 2: Collect all drafted players (no scrolling needed as mentioned)
    const playerNames = this.getCurrentDraftedNames();
    console.log(`Sleeper Parser: Found ${playerNames.length} drafted player names`);
    return playerNames;
  }

  usesDraftAbbreviations(): boolean {
    return false;
  }
}