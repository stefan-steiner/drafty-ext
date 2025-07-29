import { AuthToken, User, PlayerData, ApiResponse } from '../types';
export declare class ApiService {
    private static instance;
    private authToken;
    private constructor();
    static getInstance(): ApiService;
    setAuthToken(token: AuthToken): void;
    getAuthToken(): AuthToken | null;
    clearAuthToken(): void;
    private makeRequest;
    login(username: string, password: string): Promise<ApiResponse<{
        token: AuthToken;
        user: User;
    }>>;
    signup(username: string, email: string, password: string, name: string): Promise<ApiResponse<{
        token: AuthToken;
        user: User;
    }>>;
    logout(): Promise<ApiResponse<void>>;
    getPlayerDataByName(playerName: string): Promise<ApiResponse<PlayerData>>;
    getBulkPlayerData(playerNames: string[]): Promise<ApiResponse<any>>;
    getCurrentUser(): Promise<ApiResponse<User>>;
}
