export interface PlayerRow {
    root: HTMLElement;
    getName(): string;
    setNote(note: string): void;
    addActionButton(callback: () => void): void;
}
export interface PlayerData {
    id: string;
    name: string;
    position: string;
    team: string;
    rank?: number;
    notes?: string;
    insights?: PlayerInsight[];
}
export interface PlayerInsight {
    type: 'positive' | 'negative' | 'neutral';
    message: string;
    source: string;
}
export interface AuthToken {
    token: string;
    expiresAt: number;
    userId: string;
}
export interface User {
    id: string;
    email: string;
    name: string;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
export interface SiteParser {
    name: string;
    canParse(url: string): boolean;
    getPlayerRows(): PlayerRow[];
    getPlayerData(playerName: string): Promise<PlayerData | null>;
}
export declare const STORAGE_KEYS: {
    readonly AUTH_TOKEN: "auth_token";
    readonly USER_DATA: "user_data";
};
