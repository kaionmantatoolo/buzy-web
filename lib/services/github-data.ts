import { Route, HKBusRoute, HKBusStop, StopDetail, BusCompany } from '@/lib/types';
import { log } from '@/lib/logger';
import { ROUTES_CACHE_KEY, ROUTES_CACHE_TIMESTAMP_KEY } from '@/lib/cache/cache-keys';

const HK_BUS_ROUTES_URL = 'https://raw.githubusercontent.com/kaionmantatoolo/buzyData/main/hk_bus_routes.json';
const CACHE_EXPIRATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const FETCH_ROUTES_TIMEOUT_MS = 20_000;

interface CachedData {
  routes: Route[];
  timestamp: number;
}

// Check if we're in browser environment
const isBrowser = typeof window !== 'undefined';

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get cached routes from localStorage
 */
function getCachedRoutes(): Route[] | null {
  if (!isBrowser) return null;
  
  try {
    const cached = localStorage.getItem(ROUTES_CACHE_KEY);
    const timestamp = localStorage.getItem(ROUTES_CACHE_TIMESTAMP_KEY);
    
    if (!cached || !timestamp) return null;
    
    const cacheTime = parseInt(timestamp, 10);
    const now = Date.now();
    
    // Check if cache is expired
    if (now - cacheTime > CACHE_EXPIRATION_MS) {
      log.debug('GitHubDataService: Cache expired');
      localStorage.removeItem(ROUTES_CACHE_KEY);
      localStorage.removeItem(ROUTES_CACHE_TIMESTAMP_KEY);
      return null;
    }
    
    const routes = JSON.parse(cached) as Route[];
    log.debug(`GitHubDataService: Loaded ${routes.length} routes from cache`);
    return routes;
  } catch (error) {
    console.error('GitHubDataService: Error reading cache:', error);
    return null;
  }
}

/**
 * Save routes to localStorage cache
 */
function setCachedRoutes(routes: Route[]): void {
  if (!isBrowser) return;
  
  try {
    localStorage.setItem(ROUTES_CACHE_KEY, JSON.stringify(routes));
    localStorage.setItem(ROUTES_CACHE_TIMESTAMP_KEY, Date.now().toString());
    log.debug(`GitHubDataService: Cached ${routes.length} routes`);
  } catch (error) {
    console.error('GitHubDataService: Error writing cache:', error);
  }
}

/**
 * Clear the routes cache
 */
export function clearRoutesCache(): void {
  if (!isBrowser) return;
  
  localStorage.removeItem(ROUTES_CACHE_KEY);
  localStorage.removeItem(ROUTES_CACHE_TIMESTAMP_KEY);
  log.debug('GitHubDataService: Cache cleared');
}

/**
 * Determine bus company from route data
 */
function determineCompany(route: HKBusRoute): BusCompany {
  // Prefer the `companies` field (can be string or string[])
  const companiesRaw = route.companies;
  const companies = (Array.isArray(companiesRaw) ? companiesRaw : (companiesRaw ? [companiesRaw] : []))
    .map(c => (c ?? '').toString().trim().toUpperCase())
    .filter(Boolean);

  if (companies.length > 0) {
    // "JOINT"/"BOTH" explicitly means joint service
    if (companies.includes('JOINT') || companies.includes('BOTH')) return 'Both';

    const hasKMB = companies.includes('KMB');
    const hasCTB = companies.includes('CTB');
    if (hasKMB && hasCTB) return 'Both';
    if (hasCTB) return 'CTB';
    if (hasKMB) return 'KMB';
  }
  
  // Fall back to company string
  if (route.company) {
    const companyUpper = route.company.toUpperCase();
    switch (companyUpper) {
      case 'KMB': return 'KMB';
      case 'CTB': return 'CTB';
      case 'BOTH':
      case 'JOINT': return 'Both';
    }
  }
  
  // Default to KMB
  return 'KMB';
}

/**
 * Convert HKBusStop to StopDetail
 */
function createStopDetail(stop: HKBusStop, routeNumber: string, bound: string): StopDetail {
  return {
    id: stop.id,
    nameEn: stop.nameEn,
    nameTc: stop.nameTc,
    nameSc: stop.nameSc,
    lat: stop.lat.toString(),
    long: stop.long.toString(),
    sequence: stop.sequence,
    ctbStopId: stop.ctbStopId,
    ctbNameEn: stop.nameEnCTB,
    ctbNameTc: stop.nameTcCTB,
    ctbNameSc: stop.nameScCTB,
    routeNumber,
    bound,
  };
}

/**
 * Process raw bus routes into app Route format
 */
function processRoutes(busRoutes: HKBusRoute[]): Route[] {
  const processedRoutes: Route[] = [];
  const routeIdentifiers = new Set<string>();
  
  for (const route of busRoutes) {
    const company = determineCompany(route);
    
    // Convert stops
    const stops = route.stops.map(stop => 
      createStopDetail(stop, route.routeNumber, route.bound)
    );
    
    // Create route
    const newRoute: Route = {
      id: `${route.routeNumber}-${route.bound}-${route.serviceType}-${company}`,
      routeNumber: route.routeNumber,
      originEn: route.originEn,
      originTc: route.originTc,
      destinationEn: route.destinationEn,
      destinationTc: route.destinationTc,
      bound: route.bound,
      serviceType: route.serviceType,
      stops,
      company,
      ctbOriginEn: route.originEnCTB,
      ctbOriginTc: route.originTcCTB,
      ctbDestinationEn: route.destinationEnCTB,
      ctbDestinationTc: route.destinationTcCTB,
    };
    
    // Create unique identifier
    const routeIdentifier = `${route.routeNumber}-${route.bound}-${route.serviceType}-${company}-${route.originEn}-${route.destinationEn}`;
    
    // Only add if not duplicate
    if (!routeIdentifiers.has(routeIdentifier)) {
      routeIdentifiers.add(routeIdentifier);
      processedRoutes.push(newRoute);
    }
  }
  
  log.debug(`GitHubDataService: Processed ${processedRoutes.length} routes`);
  return processedRoutes;
}

/**
 * Fetch routes from GitHub
 */
export async function fetchRoutes(forceRefresh = false): Promise<Route[]> {
  // Try cache first (unless forcing refresh)
  if (!forceRefresh) {
    const cached = getCachedRoutes();
    if (cached && cached.length > 0) {
      return cached;
    }
  }
  
  log.debug('GitHubDataService: Fetching routes from GitHub...');
  
  try {
    const response = await fetchWithTimeout(HK_BUS_ROUTES_URL, FETCH_ROUTES_TIMEOUT_MS);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const rawData: HKBusRoute[] = await response.json();
    log.debug(`GitHubDataService: Fetched ${rawData.length} raw routes`);
    
    const routes = processRoutes(rawData);
    
    // Cache the processed routes
    setCachedRoutes(routes);
    
    return routes;
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      console.error(`GitHubDataService: Fetch routes timeout after ${FETCH_ROUTES_TIMEOUT_MS}ms`);
    } else {
      console.error('GitHubDataService: Error fetching routes:', error);
    }
    
    // Try to return cached data even if expired
    if (!forceRefresh) {
      const cached = getCachedRoutes();
      if (cached && cached.length > 0) {
        log.debug('GitHubDataService: Returning stale cached data due to fetch error');
        return cached;
      }
    }
    
    throw error;
  }
}

/**
 * Calculate distance between two coordinates in meters
 */
export function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Find routes near a given location
 */
export function findNearbyRoutes(
  routes: Route[],
  lat: number,
  lng: number,
  radius: number
): Route[] {
  const nearbyRoutes = routes.filter(route => {
    return route.stops.some(stop => {
      const stopLat = parseFloat(stop.lat);
      const stopLng = parseFloat(stop.long);
      const distance = calculateDistance(lat, lng, stopLat, stopLng);
      return distance <= radius;
    });
  });
  
  // Calculate distance to closest stop for each route and sort
  const routesWithDistance = nearbyRoutes.map(route => {
    let minDistance = Infinity;
    
    for (const stop of route.stops) {
      const stopLat = parseFloat(stop.lat);
      const stopLng = parseFloat(stop.long);
      const distance = calculateDistance(lat, lng, stopLat, stopLng);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
    
    return {
      ...route,
      distance: minDistance,
    };
  });
  
  // Sort by distance
  routesWithDistance.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
  
  return routesWithDistance;
}

/**
 * Find a specific route by its properties
 */
export function findRoute(
  routes: Route[],
  routeNumber: string,
  bound: string,
  serviceType: string,
  company?: BusCompany
): Route | undefined {
  return routes.find(r => 
    r.routeNumber === routeNumber &&
    r.bound === bound &&
    r.serviceType === serviceType &&
    (company ? r.company === company : true)
  );
}

/**
 * Search routes by route number (prefix match)
 */
export function searchRoutes(routes: Route[], query: string): Route[] {
  if (!query.trim()) {
    return routes;
  }
  
  const lowerQuery = query.toLowerCase();
  return routes.filter(route => 
    route.routeNumber.toLowerCase().startsWith(lowerQuery)
  );
}

/**
 * Filter routes by company
 */
export function filterRoutesByCompany(routes: Route[], company: 'all' | 'kmb' | 'ctb'): Route[] {
  if (company === 'all') {
    return routes;
  }
  
  return routes.filter(route => {
    if (company === 'kmb') {
      return route.company === 'KMB' || route.company === 'Both';
    }
    if (company === 'ctb') {
      return route.company === 'CTB' || route.company === 'Both';
    }
    return true;
  });
}

/**
 * Get cache last update time
 */
export function getLastUpdateTime(): Date | null {
  if (!isBrowser) return null;
  
  const timestamp = localStorage.getItem(ROUTES_CACHE_TIMESTAMP_KEY);
  if (!timestamp) return null;
  
  return new Date(parseInt(timestamp, 10));
}
