import { AuthToken, User } from '../types';
import {
  ApiResponse,
  PickAssistantRequest,
  PickAssistantResponse,
  PlayerData,
  ScoringType
} from '../types/api';
import { ErrorHandler } from './errorHandler';

const API_BASE_URL = 'https://drafty-prod.fly.dev/api';

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
    options: RequestInit = {},
    signal?: AbortSignal
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
        signal,
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error messages from the backend
        const errorMessage = data.error || data.message || `Server error (${response.status})`;
        return {
          success: false,
          error: errorMessage,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      // Check if the error is due to abort
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request cancelled',
        };
      }

      // Use ErrorHandler for consistent error messages
      const errorMessage = ErrorHandler.getErrorMessage(error, 'API request');
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Authentication methods
  async login(email: string, password: string): Promise<ApiResponse<{ token: AuthToken; user: User }>> {
    const response = await this.makeRequest<{
      message: string;
      user_id: number;
      email: string;
      token: string;
    }>('/users/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
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
          email: response.data.email,
        },
      };
      return { success: true, data: transformedData };
    }

    return response as any;
  }

  async signup(email: string, password: string): Promise<ApiResponse<{ token: AuthToken; user: User }>> {
    const response = await this.makeRequest<{
      message: string;
      user_id: number;
      email: string;
      token: string;
    }>('/users/register/', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
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
          email: response.data.email,
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
  async getPlayerDataByName(playerName: string, scoringType: ScoringType = 'standard'): Promise<ApiResponse<PlayerData>> {
    return this.makeRequest<PlayerData>(`/players/data/${encodeURIComponent(playerName)}/?scoring_type=${scoringType}`);
  }

  async pickAssistant(request: PickAssistantRequest, signal?: AbortSignal): Promise<ApiResponse<PickAssistantResponse>> {
    return this.makeRequest<PickAssistantResponse>('/players/pick-assistant/', {
      method: 'POST',
      body: JSON.stringify(request),
    }, signal);
  }

  // User profile methods
  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response = await this.makeRequest<{
      valid: boolean;
      user_id: number;
      email: string;
    }>('/users/validate-token/');

    if (response.success && response.data) {
      // Transform Django response to match extension's expected format
      const transformedData = {
        id: response.data.user_id.toString(),
        email: response.data.email,
      };
      return { success: true, data: transformedData };
    }

    return response as any;
  }
}