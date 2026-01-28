// ETA types matching Swift models

// Stop-level ETA (for a specific stop)
export interface StopETA {
  id?: string;
  co: string;           // Company code (KMB, CTB)
  route: string;        // Route number
  dir: string;          // Direction (O/I for outbound/inbound)
  service_type: string; // Service type
  seq: number;          // Stop sequence
  dest_tc: string;      // Destination in Traditional Chinese
  dest_sc: string;      // Destination in Simplified Chinese
  dest_en: string;      // Destination in English
  eta_seq: number;      // ETA sequence (1st, 2nd, 3rd bus)
  eta: string | null;   // ETA timestamp (ISO 8601)
  rmk_tc?: string;      // Remark in Traditional Chinese
  rmk_sc?: string;      // Remark in Simplified Chinese
  rmk_en?: string;      // Remark in English
  data_timestamp: string; // Data timestamp
}

// Route-level ETA (same structure, used for route-level queries)
export interface RouteETA extends StopETA {}

// API response wrappers
export interface ETAResponse<T> {
  type: string;
  version: string;
  generated_timestamp: string;
  data: T[];
}

export type StopETAResponse = ETAResponse<StopETA>;
export type RouteETAResponse = ETAResponse<RouteETA>;

// CTB-specific types
export interface CTBETAData {
  co: string;
  route: string;
  dir: string;
  seq: number;
  stop: string;
  dest_tc: string;
  dest_en: string;
  eta: string;
  rmk_tc: string;
  eta_seq: number;
  dest_sc: string;
  rmk_en: string;
  rmk_sc: string;
  data_timestamp: string;
  service_type?: string;
}

export interface CTBETAResponse {
  type: string;
  version: string;
  generated_timestamp: string;
  data: CTBETAData[];
}

export interface CTBRouteStopData {
  co: string;
  route: string;
  dir: string;
  seq: number;
  stop: string;
  data_timestamp: string;
}

export interface CTBRouteStopResponse {
  type: string;
  version: string;
  generated_timestamp: string;
  data: CTBRouteStopData[];
}

// ETA display helpers
export function formatETA(etaString: string | null, locale: string): string {
  if (!etaString) {
    return locale.startsWith('zh') ? '冇車' : 'N/A';
  }

  const etaDate = new Date(etaString);
  const now = new Date();
  const diffMs = etaDate.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 0) {
    return locale.startsWith('zh') ? '已經走咗' : 'Departed';
  }

  if (diffMinutes === 0) {
    return locale.startsWith('zh') ? '就嚟到喇' : 'Arriving';
  }

  return locale.startsWith('zh') ? `${diffMinutes} 分鐘` : `${diffMinutes} min`;
}

/**
 * iOS-style validity check for "nearby" list display:
 * - Must be parseable
 * - Must be in the future (or arriving now)
 */
export function isUpcomingETA(etaString: string | null): etaString is string {
  if (!etaString) return false;
  const etaDate = new Date(etaString);
  const t = etaDate.getTime();
  if (!Number.isFinite(t)) return false;
  return t - Date.now() >= 0;
}

export function getETARemark(eta: StopETA | RouteETA, locale: string): string {
  const isChineseLanguage = locale.startsWith('zh');
  return (isChineseLanguage ? eta.rmk_tc : eta.rmk_en) || '';
}

export function getETADestination(eta: StopETA | RouteETA, locale: string): string {
  const isChineseLanguage = locale.startsWith('zh');
  return isChineseLanguage ? eta.dest_tc : eta.dest_en;
}

// Group ETAs by stop sequence
export function groupETAsByStop(etas: RouteETA[]): Map<number, RouteETA[]> {
  const grouped = new Map<number, RouteETA[]>();
  
  for (const eta of etas) {
    const existing = grouped.get(eta.seq) || [];
    existing.push(eta);
    grouped.set(eta.seq, existing);
  }
  
  // Sort each group by ETA time
  for (const [seq, stopETAs] of grouped) {
    stopETAs.sort((a, b) => {
      if (!a.eta) return 1;
      if (!b.eta) return -1;
      return new Date(a.eta).getTime() - new Date(b.eta).getTime();
    });
    grouped.set(seq, stopETAs);
  }
  
  return grouped;
}
