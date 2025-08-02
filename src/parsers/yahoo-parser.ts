import { PlayerRow } from '../types';
import { BaseParser } from './base-parser';

// Yahoo-specific constants
const PLAYER_NAME_SELECTOR = 'td.Ta-start > span:nth-child(3)';

export class YahooPlayerRow implements PlayerRow {
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
    console.log('DRAFTY: name element', nameElement);

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

export class YahooParser extends BaseParser {
  name = 'Yahoo';

  canParse(url: string): boolean {
    return url.startsWith('https://football.fantasysports.yahoo.com/draftclient/');
  }

  getPlayerRows(): PlayerRow[] {
    const playersSection = document.querySelector<HTMLElement>('.player-listing-table');
    if (!playersSection) {
      return [];
    }

    // Find all player rows
    const playerRows = playersSection.querySelectorAll<HTMLElement>('tr.ys-player');
    if (playerRows.length === 0) {
      return [];
    }

    return Array.from(playerRows).map(row => new YahooPlayerRow(row));
  }

  private findPlayerListingTable(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.player-listing-table');
  }

  private async scrollToTop(): Promise<void> {
    const table = this.findPlayerListingTable();
    if (!table) {
      return;
    }

    // Use smooth scrolling to top
    table.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private async scrollDown(): Promise<void> {
    const table = this.findPlayerListingTable();
    if (!table) {
      return;
    }

    // Scroll down by a small amount
    const currentScrollTop = table.scrollTop;
    const scrollHeight = table.scrollHeight;
    const clientHeight = table.clientHeight;

    // If we're at the bottom, don't scroll further
    if (currentScrollTop + clientHeight >= scrollHeight) {
      return;
    }

    // Scroll down by 100px or to the bottom, whichever is smaller
    const scrollAmount = Math.min(100, scrollHeight - currentScrollTop - clientHeight);

    table.scrollTo({
      top: currentScrollTop + scrollAmount,
      behavior: 'smooth'
    });

    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 200));
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
    console.log(`Yahoo Parser: Getting ${requiredCount} available player names`);

    // Step 1: Check if the table is scrollable
    const table = this.findPlayerListingTable();
    if (!table) {
      console.log(`Yahoo Parser: Could not find player listing table`);
      return [];
    }

    const scrollHeight = table.scrollHeight;
    const clientHeight = table.clientHeight;
    const isScrollable = scrollHeight > clientHeight;

    console.log(`Yahoo Parser: Table scrollable: ${isScrollable} (scrollHeight: ${scrollHeight}, clientHeight: ${clientHeight})`);

    if (!isScrollable) {
      // If not scrollable, just collect all visible players
      const playerNames = this.getCurrentPlayerNames();
      console.log(`Yahoo Parser: Non-scrollable table - found ${playerNames.length} player names`);
      return playerNames;
    }

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

      console.log(`Yahoo Parser: Found ${playerNames.length} unique player names (needed ${requiredCount})`);

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

    console.log(`Yahoo Parser: Final collection: ${playerNames.length} player names`);
    return playerNames;
  }

  private findMyTeamTableContainer(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.myteam-table-container');
  }

  private findDraftedPlayerElements(): HTMLElement[] {
    const container = this.findMyTeamTableContainer();
    if (!container) {
      return [];
    }

    // Find all player rows that have a player name (not empty)
    const playerRows = container.querySelectorAll<HTMLElement>('tr.ys-player');
    const filledRows: HTMLElement[] = [];

    for (const row of playerRows) {
      const nameElement = row.querySelector<HTMLElement>('td span span:first-child');
      if (nameElement && nameElement.textContent?.trim()) {
        filledRows.push(row);
      }
    }

    return filledRows;
  }

  private getCurrentDraftedNames(): string[] {
    const playerElements = this.findDraftedPlayerElements();
    const playerNames: string[] = [];

    for (const element of playerElements) {
      const nameElement = element.querySelector<HTMLElement>('td span span:first-child');
      if (nameElement && nameElement.textContent?.trim()) {
        playerNames.push(nameElement.textContent.trim());
      }
    }

    return playerNames;
  }

  private async scrollDraftedToTop(): Promise<void> {
    const container = this.findMyTeamTableContainer();
    if (!container) {
      return;
    }

    // Use smooth scrolling to top
    container.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private async scrollDraftedDown(): Promise<void> {
    const container = this.findMyTeamTableContainer();
    if (!container) {
      return;
    }

    // Scroll down by a small amount
    const currentScrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // If we're at the bottom, don't scroll further
    if (currentScrollTop + clientHeight >= scrollHeight) {
      return;
    }

    // Scroll down by 100px or to the bottom, whichever is smaller
    const scrollAmount = Math.min(100, scrollHeight - currentScrollTop - clientHeight);

    container.scrollTo({
      top: currentScrollTop + scrollAmount,
      behavior: 'smooth'
    });

    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  async getDraftedNames(): Promise<string[]> {
    console.log(`Yahoo Parser: Getting all drafted player names`);

    // Step 1: Check if the section is scrollable
    const container = this.findMyTeamTableContainer();
    if (!container) {
      console.log(`Yahoo Parser: Could not find my team table container`);
      return [];
    }

    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    const isScrollable = scrollHeight > clientHeight;

    console.log(`Yahoo Parser: Section scrollable: ${isScrollable} (scrollHeight: ${scrollHeight}, clientHeight: ${clientHeight})`);

    if (!isScrollable) {
      // If not scrollable, just collect all visible players
      const playerNames = this.getCurrentDraftedNames();
      console.log(`Yahoo Parser: Non-scrollable section - found ${playerNames.length} player names`);
      return playerNames;
    }

    // Step 2: Scroll to top of drafted section
    await this.scrollDraftedToTop();

    // Step 3: Small delay for DOM update
    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 4: Loop while collecting drafted players until we reach the bottom
    const playerNames: string[] = [];
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loops
    let previousScrollTop = -1;

    while (attempts < maxAttempts) {
      // Read current drafted player names
      const currentNames = this.getCurrentDraftedNames();
      currentNames.forEach(name => {
        if (!playerNames.includes(name)) {
          playerNames.push(name);
        }
      });

      console.log(`Yahoo Parser: Found ${playerNames.length} unique drafted player names`);

      // Scroll down slightly
      await this.scrollDraftedDown();

      // Check if we've reached the bottom by comparing scroll position
      const currentScrollTop = container.scrollTop;
      const currentScrollHeight = container.scrollHeight;
      const currentClientHeight = container.clientHeight;

      // If we're at the bottom or scroll position hasn't changed, we're done
      if (currentScrollTop + currentClientHeight >= currentScrollHeight || currentScrollTop === previousScrollTop) {
        console.log(`Yahoo Parser: Reached bottom of drafted section`);
        break;
      }

      previousScrollTop = currentScrollTop;

      // Small delay for DOM update
      await new Promise(resolve => setTimeout(resolve, 200));

      attempts++;
    }

    // Step 5: Scroll back to top
    await this.scrollDraftedToTop();

    console.log(`Yahoo Parser: Final drafted collection: ${playerNames.length} player names`);
    return playerNames;
  }
}