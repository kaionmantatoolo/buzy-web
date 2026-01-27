import { Route, StopDetail, RouteETA, StopETA, CTBETAResponse, BusCompany } from '@/lib/types';

// API endpoints - we'll use our proxy routes to avoid CORS
const KMB_API_BASE = '/api/eta/kmb';
const CTB_API_BASE = '/api/eta/ctb';

// Cache for ETAs
interface CachedETA {
  timestamp: number;
  etas: StopETA[];
}

const etaCache = new Map<string, CachedETA>();
const CACHE_LIFETIME_MS = 10000; // 10 seconds

/**
 * Clear ETA cache for specific stops
 */
export function clearETACache(stopIds?: string[]): void {
  if (stopIds) {
    stopIds.forEach(id => etaCache.delete(id));
  } else {
    etaCache.clear();
  }
}

/**
 * Fetch KMB ETAs for a specific stop and route
 */
async function fetchKMBETAForStopAndRoute(
  stopId: string,
  routeNumber: string,
  serviceType: string
): Promise<StopETA[]> {
  const url = `${KMB_API_BASE}/eta/${stopId}/${routeNumber}/${serviceType}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`KMB API error: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching KMB ETAs:', error);
    return [];
  }
}

const FETCH_TIMEOUT_MS = 12_000;

/**
 * Fetch with timeout to avoid hanging indefinitely.
 */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch KMB ETAs for a stop (all routes) - efficient endpoint
 */
async function fetchKMBETAForStop(stopId: string): Promise<StopETA[]> {
  const cacheKey = `kmb-stop-${stopId}`;
  const cached = etaCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_LIFETIME_MS) {
    return cached.etas;
  }

  try {
    const url = `${KMB_API_BASE}/stop-eta/${stopId}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      console.warn(`KMB stop API error: ${response.status} for stop ${stopId}`);
      return [];
    }

    const data = await response.json();
    const etas = data.data ?? [];

    etaCache.set(cacheKey, { timestamp: Date.now(), etas });
    return etas;
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      console.warn(`KMB stop-eta timeout for stop ${stopId}`);
    } else {
      console.error('Error fetching KMB stop ETAs:', error);
    }
    return [];
  }
}

/**
 * Fetch CTB ETAs for a specific stop and route
 */
async function fetchCTBETAForStopAndRoute(
  stopId: string,
  routeNumber: string
): Promise<StopETA[]> {
  const url = `${CTB_API_BASE}/eta/CTB/${stopId}/${routeNumber}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      // 422 is common for invalid stop/route combo
      if (response.status === 422) {
        return [];
      }
      console.error(`CTB API error: ${response.status}`);
      return [];
    }
    
    const data: CTBETAResponse = await response.json();
    
    // Convert CTB format to StopETA format
    return data.data.map(ctbEta => ({
      co: 'CTB',
      route: ctbEta.route,
      dir: ctbEta.dir,
      service_type: ctbEta.service_type || '1',
      seq: ctbEta.seq,
      dest_tc: ctbEta.dest_tc,
      dest_sc: ctbEta.dest_sc,
      dest_en: ctbEta.dest_en,
      eta_seq: ctbEta.eta_seq,
      eta: ctbEta.eta || null,
      rmk_tc: ctbEta.rmk_tc,
      rmk_sc: ctbEta.rmk_sc,
      rmk_en: ctbEta.rmk_en,
      data_timestamp: ctbEta.data_timestamp,
    }));
  } catch (error) {
    console.error('Error fetching CTB ETAs:', error);
    return [];
  }
}

/**
 * Filter ETAs to match a specific route (like iOS filterETAsForRoute)
 */
function filterETAsForRoute(route: Route, allETAs: StopETA[]): StopETA[] {
  return allETAs.filter(eta => {
    // Normalize route numbers for CTB/Joint routes
    const etaCo = eta.co.trim().toUpperCase();
    const shouldNormalize = etaCo === 'CTB' || route.company === 'Both';
    
    let normalizedETARoute = eta.route;
    let normalizedRouteNumber = route.routeNumber;
    
    if (shouldNormalize) {
      // Remove leading zeros and spaces
      normalizedETARoute = eta.route.trim().replace(/^0+/, '');
      normalizedRouteNumber = route.routeNumber.trim().replace(/^0+/, '');
    } else {
      normalizedETARoute = eta.route.trim();
      normalizedRouteNumber = route.routeNumber.trim();
    }
    
    // Route number must match
    const routeMatches = normalizedETARoute === normalizedRouteNumber;
    
    // Direction must match
    const directionMatches = eta.dir === route.bound;
    
    // Service type matching (lenient for CTB/Joint)
    let serviceTypeMatches = true;
    if (etaCo !== 'CTB' && route.company !== 'Both') {
      serviceTypeMatches = eta.service_type === route.serviceType;
    }
    
    return routeMatches && directionMatches && serviceTypeMatches;
  }).filter((eta): eta is StopETA & { eta: string } => {
    // Only keep ETAs with valid eta time
    return eta.eta != null && eta.eta !== '';
  });
}

/**
 * Fetch ETAs for a specific stop on a route
 */
export async function fetchETAsForStopOnRoute(
  route: Route,
  stop: StopDetail
): Promise<RouteETA[]> {
  const allETAs: RouteETA[] = [];
  
  switch (route.company) {
    case 'KMB': {
      const kmbETAs = await fetchKMBETAForStopAndRoute(
        stop.id,
        route.routeNumber,
        route.serviceType
      );
      
      // Filter by direction and convert to RouteETA
      const filtered = kmbETAs
        .filter(eta => eta.dir === route.bound)
        .map(eta => ({
          ...eta,
          seq: stop.sequence,
        }));
      
      allETAs.push(...filtered);
      break;
    }
    
    case 'CTB': {
      // Use CTB stop ID if available
      const ctbStopId = stop.ctbStopId || stop.id;
      
      const ctbETAs = await fetchCTBETAForStopAndRoute(
        ctbStopId,
        route.routeNumber
      );
      
      // Filter by direction and convert
      const filtered = ctbETAs
        .filter(eta => eta.dir === route.bound)
        .map(eta => ({
          ...eta,
          seq: stop.sequence,
        }));
      
      allETAs.push(...filtered);
      break;
    }
    
    case 'Both': {
      // Fetch from both APIs concurrently
      const ctbStopId = stop.ctbStopId || stop.id;
      
      const [kmbETAs, ctbETAs] = await Promise.all([
        fetchKMBETAForStopAndRoute(stop.id, route.routeNumber, route.serviceType),
        fetchCTBETAForStopAndRoute(ctbStopId, route.routeNumber),
      ]);
      
      // Process KMB ETAs
      const kmbFiltered = kmbETAs
        .filter(eta => eta.dir === route.bound)
        .map(eta => ({
          ...eta,
          seq: stop.sequence,
        }));
      
      // Process CTB ETAs
      const ctbFiltered = ctbETAs
        .filter(eta => eta.dir === route.bound)
        .map(eta => ({
          ...eta,
          seq: stop.sequence,
        }));
      
      allETAs.push(...kmbFiltered, ...ctbFiltered);
      break;
    }
  }
  
  // Sort by ETA time
  allETAs.sort((a, b) => {
    if (!a.eta) return 1;
    if (!b.eta) return -1;
    return new Date(a.eta).getTime() - new Date(b.eta).getTime();
  });
  
  return allETAs;
}

/**
 * Fetch ETAs for all stops on a route
 */
export async function fetchETAsForRoute(route: Route): Promise<RouteETA[]> {
  const allETAs: RouteETA[] = [];
  
  // Process stops in batches to avoid too many concurrent requests
  const batchSize = 5;
  const batches: StopDetail[][] = [];
  
  for (let i = 0; i < route.stops.length; i += batchSize) {
    batches.push(route.stops.slice(i, i + batchSize));
  }
  
  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(stop => fetchETAsForStopOnRoute(route, stop))
    );
    
    for (const etas of batchResults) {
      allETAs.push(...etas);
    }
  }
  
  // Remove duplicates based on route-seq-eta_seq-eta
  const uniqueETAs = new Map<string, RouteETA>();
  for (const eta of allETAs) {
    const key = `${eta.route}-${eta.seq}-${eta.eta_seq}-${eta.eta}`;
    if (!uniqueETAs.has(key)) {
      uniqueETAs.set(key, eta);
    }
  }
  
  return Array.from(uniqueETAs.values());
}

/**
 * Fetch ETAs for a single stop (all routes) - for nearby routes processing
 */
export async function fetchETAsForStop(
  stopId: string,
  company?: BusCompany
): Promise<StopETA[]> {
  // Check cache
  const cacheKey = `stop-${stopId}-${company || 'all'}`;
  const cached = etaCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_LIFETIME_MS) {
    return cached.etas;
  }
  
  const allETAs: StopETA[] = [];
  
  // Fetch KMB if applicable
  if (!company || company === 'KMB' || company === 'Both') {
    try {
      const kmbETAs = await fetchKMBETAForStop(stopId);
      allETAs.push(...kmbETAs);
    } catch (error) {
      console.error('Error fetching KMB stop ETAs:', error);
    }
  }
  
  // Cache the results
  etaCache.set(cacheKey, {
    timestamp: Date.now(),
    etas: allETAs,
  });
  
  return allETAs;
}

/**
 * Get ETAs for a specific stop sequence from a list of route ETAs
 */
export function getETAsForStopSequence(
  routeETAs: RouteETA[],
  sequence: number
): RouteETA[] {
  return routeETAs
    .filter(eta => eta.seq === sequence)
    .sort((a, b) => {
      if (!a.eta) return 1;
      if (!b.eta) return -1;
      return new Date(a.eta).getTime() - new Date(b.eta).getTime();
    });
}

// Export the filter function for use in route store
export { filterETAsForRoute, fetchKMBETAForStop };
