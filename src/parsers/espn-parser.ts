import { PlayerRow, SiteParser, PlayerData } from '../types';

export class ESPNPlayerRow implements PlayerRow {
  constructor(public root: HTMLElement) {
    // Constructor logic without debug logging
  }

  // Priority‐ordered selectors to find the name cell
  private nameSelectors = [
    '.playerinfo__playername',                          // ESPN's known classname
    '[role="gridcell"]:nth-child(2)'                    // Fallback: the 2nd gridcell
  ];

  getName(): string {
    for (const selector of this.nameSelectors) {
      const el = this.root.querySelector<HTMLElement>(selector);
      
      if (el) {
        // Clone the element to avoid modifying the original DOM
        const clonedEl = el.cloneNode(true) as HTMLElement;
        
        // Remove any action buttons from the cloned element
        const actionButtons = clonedEl.querySelectorAll('.drafty-action-btn');
        actionButtons.forEach(btn => btn.remove());
        
        const textContent = clonedEl.textContent?.trim();
        
        if (textContent && textContent.length > 0) {
          return textContent;
        }
      }
    }
    
    return '';
  }

  // Example: append a small "note" div inside that same cell
  setNote(note: string) {
    const cell = this.nameSelectors
      .map(sel => this.root.querySelector<HTMLElement>(sel))
      .find(Boolean);
    if (!cell) return;

    let noteEl = cell.querySelector('.drafty-extension-note') as HTMLElement;
    if (!noteEl) {
      noteEl = document.createElement('div');
      noteEl.className = 'drafty-extension-note';
      noteEl.style.fontSize = '0.8em';
      noteEl.style.color = '#888';
      noteEl.style.marginTop = '2px';
      cell.appendChild(noteEl);
    }
    noteEl.textContent = note;
  }

  addActionButton(callback: () => void): void {
    // Find the name cell first
    const cell = this.nameSelectors
      .map(sel => this.root.querySelector<HTMLElement>(sel))
      .find(Boolean);
    
    if (!cell) {
      return;
    }

    // Check if button already exists in this specific cell
    if (cell.querySelector('.drafty-action-btn')) {
      return;
    }

    const button = document.createElement('button');
    button.className = 'drafty-action-btn';
    button.textContent = '📊';
    button.title = 'Get player insights';
    button.style.cssText = `
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 12px;
      cursor: pointer;
      margin-left: 8px;
      transition: background-color 0.2s;
      display: inline-block;
      vertical-align: middle;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = '#0056b3';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#007bff';
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      callback();
    });

    // Append the button to the cell
    cell.appendChild(button);
  }
}

export class ESPNParser implements SiteParser {
  name = 'ESPN';

  canParse(url: string): boolean {
    return url.includes('fantasy.espn.com/football/draft');
  }

  getPlayerRows(): PlayerRow[] {
    const grid = document.querySelector('.fixedDataTableLayout_main[role="grid"]');
    
    if (!grid) {
      // Try alternative selectors
      const alternativeSelectors = [
        '[role="grid"]',
        '.fixedDataTableLayout_main',
        'table',
        '[class*="table"]',
        '[class*="grid"]'
      ];
      
      for (const selector of alternativeSelectors) {
        const altGrid = document.querySelector(selector);
        if (altGrid) {
          return this.processGrid(altGrid);
        }
      }
      
      return [];
    }
    
    return this.processGrid(grid);
  }

  private processGrid(grid: Element): PlayerRow[] {
    const rows = grid.querySelectorAll<HTMLElement>('[role="row"]');
    
    if (rows.length === 0) {
      // Try alternative row selectors
      const alternativeRowSelectors = [
        'tr',
        '[class*="row"]',
        '[class*="player"]',
        'div[class*="row"]'
      ];
      
      for (const selector of alternativeRowSelectors) {
        const altRows = grid.querySelectorAll<HTMLElement>(selector);
        if (altRows.length > 0) {
          return Array.from(altRows)
            .slice(1) // drop header
            .map(row => new ESPNPlayerRow(row));
        }
      }
    }
    
    const playerRows = Array.from(rows)
      .slice(1)    // drop header
      .map(row => new ESPNPlayerRow(row));
    
    return playerRows;
  }

  async getPlayerData(playerName: string): Promise<PlayerData | null> {
    // TODO: Implement actual API call to get player data
    // This is currently a placeholder implementation
    return {
      id: `espn-${playerName.toLowerCase().replace(/\s+/g, '-')}`,
      name: playerName,
      position: 'Unknown',
      team: 'Unknown',
      rank: 0,
      notes: 'Data from ESPN parser',
      insights: [
        {
          type: 'neutral',
          message: 'Player data available from ESPN',
          source: 'ESPN Parser'
        }
      ]
    };
  }
} 