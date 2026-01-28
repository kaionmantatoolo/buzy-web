export * from './route';
export * from './eta';

// Location types
export interface Coordinates {
  lat: number;
  lng: number;
}

// Settings types
export interface AppSettings {
  discoveryRange: number;      // in meters
  useCTBInfoForJointRoutes: boolean;
  locale: 'en' | 'zh-Hant';

  // Debug-only helpers (persisted so Cursor/iPhone testing is repeatable)
  debugUseMockLocation: boolean;
  debugMockLat: number;
  debugMockLng: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  discoveryRange: 500,
  useCTBInfoForJointRoutes: false,
  locale: 'en',

  debugUseMockLocation: false,
  debugMockLat: 22.27937,
  debugMockLng: 114.178321,
};

// Loading state types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// Filter options
export type FilterOption = 'all' | 'kmb' | 'ctb';
export type SortOption = 'routeNumber' | 'distance';
