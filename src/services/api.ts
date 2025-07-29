import { AuthToken, User, PlayerData, ApiResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

export class ApiService {
  private static instance: ApiService;
  private authToken: AuthToken | null = null;

  private constructor() {}

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  setAuthToken(token: AuthToken): void {
    this.authToken = token;
  }

  getAuthToken(): AuthToken | null {
    return this.authToken;
  }

  clearAuthToken(): void {
    this.authToken = null;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Token ${this.authToken.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || data.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Authentication methods
  async login(username: string, password: string): Promise<ApiResponse<{ token: AuthToken; user: User }>> {
    const response = await this.makeRequest<{
      message: string;
      user_id: number;
      username: string;
      token: string;
    }>('/users/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (response.success && response.data) {
      // Transform Django response to match extension's expected format
      const transformedData = {
        token: {
          token: response.data.token,
          expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours from now
          userId: response.data.user_id.toString(),
        },
        user: {
          id: response.data.user_id.toString(),
          email: '', // Django doesn't return email in login response
          name: response.data.username,
        },
      };
      return { success: true, data: transformedData };
    }

    return response as any;
  }

  async signup(username: string, email: string, password: string, name: string): Promise<ApiResponse<{ token: AuthToken; user: User }>> {
    const response = await this.makeRequest<{
      message: string;
      user_id: number;
      username: string;
      token: string;
    }>('/users/register/', {
      method: 'POST',
      body: JSON.stringify({ 
        username, 
        email, 
        password,
        first_name: name.split(' ')[0] || name,
        last_name: name.split(' ').slice(1).join(' ') || '',
      }),
    });

    if (response.success && response.data) {
      // Transform Django response to match extension's expected format
      const transformedData = {
        token: {
          token: response.data.token,
          expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours from now
          userId: response.data.user_id.toString(),
        },
        user: {
          id: response.data.user_id.toString(),
          email: email,
          name: response.data.username,
        },
      };
      return { success: true, data: transformedData };
    }

    return response as any;
  }

  async logout(): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('/users/logout/', {
      method: 'POST',
    });
  }

  // Player data methods
  async getPlayerDataByName(playerName: string): Promise<ApiResponse<PlayerData>> {
    return this.makeRequest<PlayerData>(`/players/data/${encodeURIComponent(playerName)}/`);
  }

  async getBulkPlayerData(playerNames: string[]): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/players/bulk-data/', {
      method: 'POST',
      body: JSON.stringify({ player_names: playerNames }),
    });
  }

  // User profile methods
  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response = await this.makeRequest<{
      valid: boolean;
      user_id: number;
      username: string;
    }>('/users/validate-token/');

    if (response.success && response.data) {
      // Transform Django response to match extension's expected format
      const transformedData = {
        id: response.data.user_id.toString(),
        email: '', // Django doesn't return email in validate-token response
        name: response.data.username,
      };
      return { success: true, data: transformedData };
    }

    return response as any;
  }
} 