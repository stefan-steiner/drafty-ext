import { SiteParser, PlayerRow } from '../types';
import { ESPNParser } from './espn-parser';

export class ParserManager {
  private static instance: ParserManager;
  private parsers: SiteParser[] = [];

  private constructor() {
    this.registerParsers();
  }

  static getInstance(): ParserManager {
    if (!ParserManager.instance) {
      ParserManager.instance = new ParserManager();
    }
    return ParserManager.instance;
  }

  private registerParsers(): void {
    // Register all available parsers
    this.parsers.push(new ESPNParser());
    
    // Future parsers can be added here:
    // this.parsers.push(new YahooParser());
    // this.parsers.push(new SleeperParser());
    // this.parsers.push(new NFLParser());
  }

  getParserForUrl(url: string): SiteParser | null {
    return this.parsers.find(parser => parser.canParse(url)) || null;
  }

  getPlayerRows(url: string): PlayerRow[] {
    const parser = this.getParserForUrl(url);
    if (!parser) {
      return [];
    }
    return parser.getPlayerRows();
  }
} 