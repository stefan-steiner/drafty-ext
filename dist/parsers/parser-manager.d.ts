import { SiteParser, PlayerRow } from '../types';
export declare class ParserManager {
    private static instance;
    private parsers;
    private constructor();
    static getInstance(): ParserManager;
    private registerParsers;
    getParserForUrl(url: string): SiteParser | null;
    getPlayerRows(url: string): PlayerRow[];
}
