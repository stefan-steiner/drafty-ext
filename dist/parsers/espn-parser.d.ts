import { PlayerRow } from '../types';
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
    private findScrollbar;
    private findScrollbarFace;
    private scrollToTop;
    private scrollDown;
    private getCurrentPlayerNames;
    getPlayerNames(requiredCount: number): Promise<string[]>;
}
