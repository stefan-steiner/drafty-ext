import { SiteParser, PlayerRow, PlayerData } from '../types';

export abstract class BaseParser implements SiteParser {
  abstract name: string;
  abstract canParse(url: string): boolean;
  abstract getPlayerRows(): PlayerRow[];
  abstract getPlayerNames(requiredCount: number): Promise<string[]>;
} 