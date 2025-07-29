import { SiteParser, PlayerRow, PlayerData } from '../types';
export declare abstract class BaseParser implements SiteParser {
    abstract name: string;
    abstract canParse(url: string): boolean;
    abstract getPlayerRows(): PlayerRow[];
    abstract getPlayerData(playerName: string): Promise<PlayerData | null>;
    abstract scrollForMorePlayers(): Promise<boolean>;
    abstract getPlayerNames(requiredCount: number): Promise<string[]>;
}
