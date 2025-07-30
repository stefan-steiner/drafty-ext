import { AuthToken, User } from '../types';
import { PlayerData, PickAssistantResponse, PickAssistantRequest, ApiResponse, ScoringType } from '../types/api';
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
    getPlayerDataByName(playerName: string, scoringType?: ScoringType): Promise<ApiResponse<PlayerData>>;
    pickAssistant(request: PickAssistantRequest): Promise<ApiResponse<PickAssistantResponse>>;
    getCurrentUser(): Promise<ApiResponse<User>>;
}
