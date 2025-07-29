import { PlayerRow, PlayerData } from '../types';
import { BaseParser } from './base-parser';
export declare class ESPNPlayerRow implements PlayerRow {
    root: HTMLElement;
    constructor(root: HTMLElement);
    getName(): string;
    setNote(note: string): void;
    addActionButton(callback: () => void): void;
}
export declare class ESPNParser extends BaseParser {
    name: string;
    canParse(url: string): boolean;
    getPlayerRows(): PlayerRow[];
    getPlayerData(playerName: string): Promise<PlayerData | null>;
    private createLoadingOverlay;
    private removeLoadingOverlay;
    private scrollToTop;
    scrollForMorePlayers(): Promise<boolean>;
    getPlayerNames(requiredCount: number): Promise<string[]>;
}
