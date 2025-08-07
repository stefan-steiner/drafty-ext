import { DraftedPlayer, PlayerRow } from '../types';
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

export class YahooParser extends BaseParser {
  name = 'Yahoo';

  canParse(url: string): boolean {
    return url.startsWith('https://football.fantasysports.yahoo.com/draftclient/');
  }

  async ensureCorrectPlayerView(teamName?: string): Promise<void> {
    // Click the Players tab if it's not already selected
    const playersTab = document.querySelector<HTMLButtonElement>('button[data-id="players"]');

    if (playersTab) {
      const isSelected = playersTab.getAttribute('aria-selected') === 'true';

      if (!isSelected) {
        try {
          playersTab.click();
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error('YahooParser: Error clicking players tab:', error);
        }
      }
    }

    // Set position filter to "All Players"
    const positionFilter = document.querySelector<HTMLSelectElement>('#position-filter');
    if (positionFilter && positionFilter.value !== 'pos_type=All') {
      positionFilter.value = 'pos_type=All';
      positionFilter.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Clear search input if it has any value
    const searchInput = document.querySelector<HTMLInputElement>('#search');
    if (searchInput && searchInput.value.trim() !== '') {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Uncheck "Show Drafted" if checked
    const showDraftedCheckbox = document.querySelector<HTMLInputElement>('#show-drafted');
    if (showDraftedCheckbox && showDraftedCheckbox.checked) {
      showDraftedCheckbox.click();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Set stat mode filter to "2025 Proj Stats"
    const statModeFilter = document.querySelector<HTMLSelectElement>('#stat-mode-filter');
    if (statModeFilter && statModeFilter.value !== 'projected') {
      statModeFilter.value = 'projected';
      statModeFilter.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Make sure we are sorting by Expert Rank
    const expertRankSorter = document.querySelector<HTMLElement>('.ys-stat');
    if (expertRankSorter && expertRankSorter.textContent?.trim() === 'Expert Rank') {
      // Click the sorter until we see the ys-dir0 icon
      let attempts = 0;
      const maxAttempts = 3; // Prevent infinite loops

      while (attempts < maxAttempts) {
        // Check if we already have the ys-dir0 icon
        const hasCorrectIcon = expertRankSorter.querySelector('i.ys-dir0');

        if (hasCorrectIcon) {
          break; // Already sorted correctly
        }

        // Click the sorter
        expertRankSorter.click();
        await new Promise(resolve => setTimeout(resolve, 100));

        attempts++;
      }
    }
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

    // Convert to array and sort by vertical position (top to bottom)
    const sortedRows = Array.from(playerRows).sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      return rectA.top - rectB.top;
    });

    return sortedRows.map(row => new YahooPlayerRow(row));
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

    // Scroll down by 1px or to the bottom, whichever is smaller
    const scrollAmount = Math.min(1, scrollHeight - currentScrollTop - clientHeight);

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
    // Step 1: Check if the table is scrollable
    const table = this.findPlayerListingTable();
    if (!table) {
      return [];
    }

    const scrollHeight = table.scrollHeight;
    const clientHeight = table.clientHeight;
    const isScrollable = scrollHeight > clientHeight;

    if (!isScrollable) {
      // If not scrollable, just collect all visible players
      const playerNames = this.getCurrentPlayerNames();
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
    return finalNames;
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

  private getCurrentDraftedNames(): DraftedPlayer[] {
    const playerElements = this.findDraftedPlayerElements();
    const draftedPlayers: DraftedPlayer[] = [];

    for (const element of playerElements) {
      // Extract name from the first span with class "Whs(n)"
      const nameElement = element.querySelector<HTMLElement>('td span span.Whs\\(n\\)');
      const name = nameElement?.textContent?.trim() || '';

      // Extract team from the first abbr element
      const teamElement = element.querySelector<HTMLElement>('td span span abbr');
      const team = teamElement?.textContent?.trim() || '';

      // Extract position from the second abbr element (the one with the actual position like "WR")
      const abbrElements = element.querySelectorAll<HTMLElement>('td span span abbr');
      const positionElement = abbrElements[1]; // Second abbr element contains the position
      const position = positionElement?.textContent?.trim() || '';

      if (name && position && team) {
        draftedPlayers.push({
          name,
          position,
          team
        });
      }
    }

    return draftedPlayers;
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

  async getDraftedNames(): Promise<DraftedPlayer[]> {
    // Step 1: Check if the section is scrollable
    const container = this.findMyTeamTableContainer();
    if (!container) {
      return [];
    }

    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    const isScrollable = scrollHeight > clientHeight;

    if (!isScrollable) {
      // If not scrollable, just collect all visible players
      const playerNames = this.getCurrentDraftedNames();
      return playerNames;
    }

    // Step 2: Scroll to top of drafted section
    await this.scrollDraftedToTop();

    // Step 3: Small delay for DOM update
    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 4: Loop while collecting drafted players until we reach the bottom
    const playerNames: DraftedPlayer[] = [];
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loops
    let previousScrollTop = -1;

    while (attempts < maxAttempts) {
      // Read current drafted player names
      const currentNames = this.getCurrentDraftedNames();
      currentNames.forEach(player => {
        if (!playerNames.some(existing => existing.name === player.name)) {
          playerNames.push(player);
        }
      });

      // Scroll down slightly
      await this.scrollDraftedDown();

      // Check if we've reached the bottom by comparing scroll position
      const currentScrollTop = container.scrollTop;
      const currentScrollHeight = container.scrollHeight;
      const currentClientHeight = container.clientHeight;

      // If we're at the bottom or scroll position hasn't changed, we're done
      if (currentScrollTop + currentClientHeight >= currentScrollHeight || currentScrollTop === previousScrollTop) {
        break;
      }

      previousScrollTop = currentScrollTop;

      // Small delay for DOM update
      await new Promise(resolve => setTimeout(resolve, 200));

      attempts++;
    }

    // Step 5: Scroll back to top
    await this.scrollDraftedToTop();

    return playerNames;
  }

  usesDraftAbbreviations(): boolean {
    return true;
  }

  getTeamName(): Promise<string | null> {
    // Yahoo does not need to set the team name
    return Promise.resolve(null);
  }
}