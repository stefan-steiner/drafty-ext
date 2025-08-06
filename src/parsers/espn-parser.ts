import { PlayerRow } from '../types';
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

    // Get row elements that contain player names, preserving order
    const playerRows: HTMLElement[] = [];

    playerNameElements.forEach(nameElement => {
      const rowElement = nameElement.closest('[role="row"]') ||
                        nameElement.closest('tr') ||
                        nameElement.closest('[class*="row"]') ||
                        nameElement.closest('div[class*="row"]');

      if (rowElement) {
        playerRows.push(rowElement as HTMLElement);
      }
    });

    // Sort player rows by their vertical position (top to bottom)
    playerRows.sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      return rectA.top - rectB.top;
    });

    return playerRows.map(row => new ESPNPlayerRow(row));
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
    // Step 1: Ensure correct tab and filters are set
    await this.ensureCorrectPlayerView();

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

  private async ensureCorrectPlayerView(): Promise<void> {
    // Click on Players tab
    const playersTab = document.querySelector<HTMLElement>('.draft_tabs_container .tabs__list__item button[role="tab"]');
    if (playersTab && playersTab.textContent?.trim() === 'Players') {
      playersTab.click();
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Ensure Show Drafted toggle is off
    const showDraftedToggle = document.querySelector<HTMLInputElement>('.drafted-players-toggle-container input[type="checkbox"]');
    if (showDraftedToggle && showDraftedToggle.checked) {
      showDraftedToggle.click();
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Clear any player search
    const clearSearchButton = document.querySelector<HTMLElement>('.player--search--clear');
    if (clearSearchButton) {
      clearSearchButton.click();
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Set filters to correct values
    const filtersContainer = document.querySelector<HTMLElement>('.draft-players .filters');
    console.log(filtersContainer);
    if (filtersContainer) {
      // Find all dropdown select elements within filters (up to 2 levels deep)
      const dropdowns = filtersContainer.querySelectorAll<HTMLSelectElement>('.dropdown select.dropdown__select:not([aria-hidden])');
      console.log(dropdowns);

      // Set to "2025 Projected" (first dropdown)
      if (dropdowns.length >= 1) {
        dropdowns[0].value = 'currentSeasonProjectedStats';
        dropdowns[0].dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Set to "All Pos." (second dropdown)
      if (dropdowns.length >= 2) {
        dropdowns[1].value = '-1';
        dropdowns[1].dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Set to "All NFL Teams" (third dropdown)
      if (dropdowns.length >= 3) {
        dropdowns[2].value = '-1';
        dropdowns[2].dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Single delay for all filter changes to process
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  private findDraftedRosterSection(): HTMLElement | null {
    // Find roster section using roster or roster-module classes
    const rosterSection = document.querySelector<HTMLElement>('.roster, .roster-module');
    if (!rosterSection) {
      return null;
    }

    // Ensure we're in the right section by checking for the inner-column within draft-column
    const draftColumn = rosterSection.closest('.draft-column');
    if (!draftColumn) {
      return null;
    }

    const innerColumn = draftColumn.querySelector<HTMLElement>('.inner-column');
    if (!innerColumn) {
      return null;
    }

    return innerColumn;
  }

  private findDraftedPlayerElements(): HTMLElement[] {
    const rosterSection = this.findDraftedRosterSection();
    if (!rosterSection) {
      return [];
    }

    // Find all player column elements that have a title attribute (indicating they have a player)
    const playerElements = rosterSection.querySelectorAll<HTMLElement>('div[class*="table--cell player-column"][title]');

    return Array.from(playerElements);
  }

  private getCurrentDraftedNames(): string[] {
    const playerElements = this.findDraftedPlayerElements();
    const playerNames: string[] = [];

    for (const element of playerElements) {
      const title = element.getAttribute('title');
      if (title && title.trim()) {
        playerNames.push(title.trim());
      }
    }

    return playerNames;
  }

  private async scrollDraftedToTop(): Promise<void> {
    const innerColumn = this.findDraftedRosterSection();
    if (!innerColumn) {
      return;
    }

    // Use smooth scrolling to top
    innerColumn.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private async scrollDraftedDown(): Promise<void> {
    const innerColumn = this.findDraftedRosterSection();
    if (!innerColumn) {
      return;
    }

    // Scroll down by a small amount
    const currentScrollTop = innerColumn.scrollTop;
    const scrollHeight = innerColumn.scrollHeight;
    const clientHeight = innerColumn.clientHeight;

    // If we're at the bottom, don't scroll further
    if (currentScrollTop + clientHeight >= scrollHeight) {
      return;
    }

    // Scroll down by 100px or to the bottom, whichever is smaller
    const scrollAmount = Math.min(100, scrollHeight - currentScrollTop - clientHeight);

    innerColumn.scrollTo({
      top: currentScrollTop + scrollAmount,
      behavior: 'smooth'
    });

    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  async getDraftedNames(): Promise<string[]> {
    // Step 1: Check if the section is scrollable
    const innerColumn = this.findDraftedRosterSection();
    if (!innerColumn) {
      return [];
    }

    const scrollHeight = innerColumn.scrollHeight;
    const clientHeight = innerColumn.clientHeight;
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

      // Scroll down slightly
      await this.scrollDraftedDown();

      // Check if we've reached the bottom by comparing scroll position
      const currentScrollTop = innerColumn.scrollTop;
      const currentScrollHeight = innerColumn.scrollHeight;
      const currentClientHeight = innerColumn.clientHeight;

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
    return false;
  }
}