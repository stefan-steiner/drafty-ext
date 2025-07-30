import { SiteParser, PlayerRow } from '../types';
export declare abstract class BaseParser implements SiteParser {
    abstract name: string;
    abstract canParse(url: string): boolean;
    abstract getPlayerRows(): PlayerRow[];
    abstract getAvailableNames(requiredCount: number): Promise<string[]>;
    abstract getDraftedNames(): Promise<string[]>;
}
