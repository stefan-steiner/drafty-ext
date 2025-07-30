// API Response Types for Django Backend

export interface PlayerData {
  id: string;
  full_name: string;
  position: string;
  team: string;
  rank: number | null;
  adp: number | null;
  player_overview: string;
  player_overview_sources: string[];
  team_expectations: string;
  team_expectations_sources: string[];
  depth_chart_role: string;
  depth_chart_role_sources: string[];
  downside: string;
  downside_sources: string[];
  upside: string;
  upside_sources: string[];
}

export interface PickOption {
  name: string;
  reason: string;
}

export interface PickAssistantResponse {
  option1: PickOption;
  option2: PickOption;
  option3: PickOption;
}

export interface ApiError {
  error: string;
}

// Request types
export interface PickAssistantRequest {
  players_drafted: string[];
  players_available: string[];
  scoring_type?: 'standard' | 'ppr' | 'half_ppr';
}

// Generic API response wrapper - matches existing pattern
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

// Scoring type options
export type ScoringType = 'standard' | 'ppr' | 'half_ppr'; 