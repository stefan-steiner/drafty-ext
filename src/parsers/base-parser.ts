import { DraftedPlayer, PlayerRow, SiteParser } from '../types';

export abstract class BaseParser implements SiteParser {
  abstract name: string;
  abstract canParse(url: string): boolean;
  abstract getPlayerRows(): PlayerRow[];
  abstract ensureCorrectPlayerView(teamName?: string): Promise<void>;
  abstract getAvailableNames(requiredCount: number): Promise<string[]>;
  abstract getDraftedNames(): Promise<string[] | DraftedPlayer[]>;
  abstract usesDraftAbbreviations(): boolean;
  abstract getTeamName(): Promise<string | null>;
}