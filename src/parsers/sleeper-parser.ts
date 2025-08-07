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

  async ensureCorrectPlayerView(teamName?: string): Promise<void> {
    const draftRankings = document.querySelector<HTMLElement>('.draft-rankings');
    if (!draftRankings) {
      return;
    }

    // Get the roster section (handles tab clicking if needed)
    const rosterSection = await this.findDraftRosterSection();

    // Select the user's team if provided
    if (teamName && rosterSection) {
      // Find the owner-selector element within the draft-roster2 section
      const ownerSelector = rosterSection.querySelector<HTMLElement>('.owner-selector');
      if (ownerSelector) {
        // Check if the team is already selected
        const nameContainer = ownerSelector.querySelector<HTMLElement>('.name-container');
        const currentTeamName = nameContainer?.textContent?.trim();

        // Only proceed if the team is not already selected
        if (currentTeamName !== teamName) {
          // Click on the selected-team to open the dropdown
          const selectedTeam = ownerSelector.querySelector<HTMLElement>('.selected-team');
          if (selectedTeam) {
            selectedTeam.click();
            await new Promise(resolve => setTimeout(resolve, 100));

            // Find the dropdown items container within the draft-roster2 section
            const itemsContainer = rosterSection.querySelector<HTMLElement>('.owner-selector-items-container');
            if (itemsContainer) {
              // Find all owner-selector-item elements
              const items = itemsContainer.querySelectorAll<HTMLElement>('.owner-selector-item');

              // Find the item that matches the team name
              for (const item of items) {
                const itemText = item.textContent?.trim();
                if (itemText === teamName) {
                  // Click on the matching item
                  item.click();
                  await new Promise(resolve => setTimeout(resolve, 100));
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Clear the player search
    const searchInput = draftRankings.querySelector<HTMLInputElement>('.header-controls .player-search input');
    if (searchInput && searchInput.value) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Select "All" from positions filter (first filter-item)
    const allFilter = draftRankings.querySelector<HTMLElement>('.positions-filter .filter-item');
    if (allFilter && !allFilter.classList.contains('selected')) {
      allFilter.click();
    }

    // Uncheck all filters in header-filters
    const headerFilters = draftRankings.querySelectorAll<HTMLElement>('.header-filters .filter-button');
    for (const filterButton of headerFilters) {
      const checkbox = filterButton.querySelector<HTMLElement>('.custom-checkbox');
      if (checkbox && checkbox.classList.contains('checked')) {
        filterButton.click();
      }
    }

    // Check for highlighted elements in the player table and unsort if needed
    await this.unsortTableIfHighlighted();

    // Single delay for all UI updates to settle
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private async unsortTableIfHighlighted(): Promise<void> {
    const draftRankings = document.querySelector<HTMLElement>('.draft-rankings');
    if (!draftRankings) {
      return;
    }

    // Find the player-rank-list container
    const playerRankList = draftRankings.querySelector<HTMLElement>('.player-rank-list');
    if (!playerRankList) {
      return;
    }

    // Look for any elements with the "highlight" class
    const highlightedElements = playerRankList.querySelectorAll<HTMLElement>('.highlight');

    if (highlightedElements.length === 0) {
      return; // No highlighted elements, table is not sorted
    }

    // Find the first highlighted element and check its classes
    const firstHighlighted = highlightedElements[0];
    const elementClasses = Array.from(firstHighlighted.classList);

    // Define the mapping from highlighted element classes to sort column classes
    const highlightedToSortColumnMap: Record<string, string> = {
      'adp': 'adp',
      'proj-pts': 'pts',
      'proj-avg': 'avg',
      'rush-att': 'rush-att',
      'rush-yd': 'rush-yd',
      'rush-td': 'rush-td',
      'rec-tgt': 'rec-tar',
      'rec-yd': 'rec-yd',
      'rec-td': 'rec-td',
      'pass-att': 'pass-att',
      'pass-yd': 'pass-yd',
      'pass-td': 'pass-td',
    };

    // Find which sort column is highlighted
    let sortColumnClass: string | null = null;
    for (const className of elementClasses) {
      if (highlightedToSortColumnMap[className]) {
        sortColumnClass = highlightedToSortColumnMap[className];
        break;
      }
    }

    if (!sortColumnClass) {
      return; // No valid sort column found
    }

    // Find the header container
    const bodyContainer = draftRankings.querySelector<HTMLElement>('.body-container');
    if (!bodyContainer) {
      return;
    }

    const header = bodyContainer.querySelector<HTMLElement>('.header');
    if (!header) {
      return;
    }

    // Find all rows in the header and get the second row
    const headerRows = header.querySelectorAll<HTMLElement>('.row');
    if (headerRows.length < 2) {
      return; // Need at least 2 rows
    }

    const secondRow = headerRows[1]; // Get the second row (index 1)

    // Find the corresponding header element with the same class in the second row
    const headerElement = secondRow.querySelector<HTMLElement>(`.${sortColumnClass}`);
    if (headerElement) {
      // Click the header to unsort
      headerElement.click();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async getAvailableNames(requiredCount: number): Promise<string[]> {
    // Step 1: Scroll to top
    await this.scrollToTop();

    // Step 2: Small delay for DOM update
    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 3: Loop while collecting players
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

    // Step 4: Scroll back to top
    await this.scrollToTop();

    // Step 5: Return exactly the first requiredCount players
    const finalNames = playerNames.slice(0, requiredCount);
    return finalNames;
  }

  private async findDraftRosterSection(): Promise<HTMLElement | null> {
    // First try to find the draft-roster2 directly
    let rosterSection = document.querySelector<HTMLElement>('.draft-roster2');

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
            rosterSection = document.querySelector<HTMLElement>('.draft-roster2');
            break;
          }
        }
      }
    }

    return rosterSection;
  }

  private async findDraftedPlayerElements(): Promise<HTMLElement[]> {
    const rosterSection = await this.findDraftRosterSection();
    if (!rosterSection) {
      return [];
    }

    // Find all player data elements (not empty ones) within the draft-roster2 section
    const playerElements = rosterSection.querySelectorAll<HTMLElement>('.player-data');
    return Array.from(playerElements);
  }

  private async getCurrentDraftedNames(): Promise<string[]> {
    const playerElements = await this.findDraftedPlayerElements();
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
    // Step 1: Get the roster section (handles tab clicking if needed)
    const rosterSection = await this.findDraftRosterSection();

    if (!rosterSection) {
      return [];
    }

    // Step 2: Collect all drafted players (no scrolling needed as mentioned)
    const playerNames = await this.getCurrentDraftedNames();
    return playerNames;
  }

  usesDraftAbbreviations(): boolean {
    return false;
  }

  async getTeamName(): Promise<string | null> {
    const maxAttempts = 50; // 5 seconds total (50 * 100ms)
    let attempts = 0;

    while (attempts < maxAttempts) {
      // Get the roster section (handles tab clicking if needed)
      const rosterSection = await this.findDraftRosterSection();

      if (rosterSection) {
        // Find the owner-selector element within the draft-roster2 section
        const ownerSelector = rosterSection.querySelector<HTMLElement>('.owner-selector');
        if (ownerSelector) {
          // Find the name-container div within the owner-selector
          const nameContainer = ownerSelector.querySelector<HTMLElement>('.name-container');
          if (nameContainer && nameContainer.textContent?.trim()) {
            return nameContainer.textContent.trim();
          }
        }
      }

      // Wait 100ms before next attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    return null;
  }
}