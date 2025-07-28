import { AuthToken, User } from '../types';
export declare class StorageService {
    private static instance;
    private constructor();
    static getInstance(): StorageService;
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
    clear(): Promise<void>;
    getAuthToken(): Promise<AuthToken | null>;
    setAuthToken(token: AuthToken): Promise<void>;
    clearAuthToken(): Promise<void>;
    getUserData(): Promise<User | null>;
    setUserData(user: User): Promise<void>;
    clearUserData(): Promise<void>;
}
