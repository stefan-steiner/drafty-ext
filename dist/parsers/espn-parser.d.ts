import { PlayerRow, SiteParser, PlayerData } from '../types';
export declare class ESPNPlayerRow implements PlayerRow {
    root: HTMLElement;
    constructor(root: HTMLElement);
    private nameSelectors;
    getName(): string;
    setNote(note: string): void;
    addActionButton(callback: () => void): void;
}
export declare class ESPNParser implements SiteParser {
    name: string;
    canParse(url: string): boolean;
    getPlayerRows(): PlayerRow[];
    private processGrid;
    getPlayerData(playerName: string): Promise<PlayerData | null>;
}
