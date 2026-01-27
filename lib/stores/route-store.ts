import { create } from 'zustand';
import { Route, RouteETA, StopDetail, StopETA, LoadingState, getStopLocation, getStopUniqueId } from '@/lib/types';
import { fetchRoutes, findNearbyRoutes, searchRoutes, filterRoutesByCompany, calculateDistance } from '@/lib/services/github-data';
import { fetchETAsForRoute, fetchETAsForStopOnRoute, fetchKMBETAForStop, filterETAsForRoute } from '@/lib/services/eta-service';

interface ProcessedRoute {
  route: Route;
  nearestStop: StopDetail;
  etas: RouteETA[];
  distance: number;
}

interface RouteState {
  // Routes data
  routes: Route[];
  filteredRoutes: Route[];
  nearbyRoutes: Route[];
  processedNearbyRoutes: ProcessedRoute[]; // Routes with valid ETAs
  
  // Loading states
  loadingState: LoadingState;
  isLoadingNearbyRoutes: boolean;
  error: string | null;
  
  // Search/filter
  searchQuery: string;
  filterCompany: 'all' | 'kmb' | 'ctb';
  
  // Current route detail
  currentRoute: Route | null;
  routeETAs: RouteETA[];
  expandedStopId: string | null;
  isLoadingETAs: boolean;
  
  // Location
  userLocation: { lat: number; lng: number } | null;
  discoveryRange: number;
  
  // Actions
  loadRoutes: (forceRefresh?: boolean) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setFilterCompany: (company: 'all' | 'kmb' | 'ctb') => void;
  setUserLocation: (location: { lat: number; lng: number } | null) => void;
  setDiscoveryRange: (range: number) => void;
  updateNearbyRoutes: () => Promise<void>;
  
  // Route detail actions
  setCurrentRoute: (route: Route | null) => void;
  fetchRouteETAs: () => Promise<void>;
  fetchStopETAs: (stopId: string) => Promise<void>;
  setExpandedStopId: (stopId: string | null) => void;
  clearRouteETAs: () => void;
}

export const useRouteStore = create<RouteState>((set, get) => ({
  // Initial state
  routes: [],
  filteredRoutes: [],
  nearbyRoutes: [],
  processedNearbyRoutes: [],
  loadingState: 'idle',
  isLoadingNearbyRoutes: false,
  error: null,
  searchQuery: '',
  filterCompany: 'all',
  currentRoute: null,
  routeETAs: [],
  expandedStopId: null,
  isLoadingETAs: false,
  userLocation: null,
  discoveryRange: 500,
  
  // Load routes from GitHub
  loadRoutes: async (forceRefresh = false) => {
    set({ loadingState: 'loading', error: null });
    
    try {
      const routes = await fetchRoutes(forceRefresh);
      set({ 
        routes, 
        filteredRoutes: routes,
        loadingState: 'success' 
      });
      
      // Update nearby routes if we have location
      const { userLocation, discoveryRange } = get();
      if (userLocation) {
        await get().updateNearbyRoutes();
      }
    } catch (error) {
      console.error('Failed to load routes:', error);
      set({ 
        loadingState: 'error',
        error: error instanceof Error ? error.message : 'Failed to load routes'
      });
    }
  },
  
  // Set search query and filter routes
  setSearchQuery: (query: string) => {
    const { routes, filterCompany } = get();
    let filtered = searchRoutes(routes, query);
    filtered = filterRoutesByCompany(filtered, filterCompany);
    set({ searchQuery: query, filteredRoutes: filtered });
  },
  
  // Set filter company and filter routes
  setFilterCompany: (company: 'all' | 'kmb' | 'ctb') => {
    const { routes, searchQuery } = get();
    let filtered = searchRoutes(routes, searchQuery);
    filtered = filterRoutesByCompany(filtered, company);
    set({ filterCompany: company, filteredRoutes: filtered });
  },
  
  // Set user location
  setUserLocation: (location: { lat: number; lng: number } | null) => {
    set({ userLocation: location });
    if (location) {
      get().updateNearbyRoutes();
    }
  },
  
  // Set discovery range
  setDiscoveryRange: (range: number) => {
    set({ discoveryRange: range });
    get().updateNearbyRoutes();
  },
  
  // Update nearby routes based on current location - iOS-style processing
  updateNearbyRoutes: async () => {
    const { routes, userLocation } = get();
    if (!userLocation || routes.length === 0) {
      set({ nearbyRoutes: [], processedNearbyRoutes: [], isLoadingNearbyRoutes: false });
      return;
    }

    // Use discovery range from settings store (source of truth for UI)
    let discoveryRange = get().discoveryRange;
    try {
      const settings = (await import('./settings-store')).useSettingsStore.getState();
      discoveryRange = settings.discoveryRange;
    } catch {
      /* use route store default */
    }

    set({ isLoadingNearbyRoutes: true, processedNearbyRoutes: [] });

    try {
      const nearby = findNearbyRoutes(routes, userLocation.lat, userLocation.lng, discoveryRange);
      set({ nearbyRoutes: nearby });

      if (nearby.length === 0) {
        return;
      }

      const routeToNearestStop = new Map<string, { stop: StopDetail; distance: number }>();
      const routeDistances = new Map<string, number>();

      for (const route of nearby) {
        let nearestStop: StopDetail | null = null;
        let minDistance = Infinity;

        for (const stop of route.stops) {
          const stopLoc = getStopLocation(stop);
          const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            stopLoc.lat,
            stopLoc.lng
          );
          if (distance <= discoveryRange && distance < minDistance) {
            minDistance = distance;
            nearestStop = stop;
          }
        }
        if (nearestStop) {
          routeToNearestStop.set(route.id, { stop: nearestStop, distance: minDistance });
          routeDistances.set(route.id, minDistance);
        }
      }

      const uniqueStopIds = Array.from(
        new Set(Array.from(routeToNearestStop.values()).map((v) => v.stop.id))
      );

      const kmbEtaCache = new Map<string, StopETA[]>();
      for (const stopId of uniqueStopIds) {
        const stopETAs = await fetchKMBETAForStop(stopId);
        kmbEtaCache.set(stopId, stopETAs);
      }

      let favoritesStore: { isFavorite: (r: Route) => boolean } | null = null;
      try {
        const mod = await import('./favorites-store');
        favoritesStore = mod.useFavoritesStore.getState();
      } catch {
        /* skip */
      }

      const sortedRoutes = nearby
        .filter((r) => routeToNearestStop.has(r.id))
        .sort((r1, r2) => {
          if (favoritesStore) {
            const f1 = favoritesStore.isFavorite(r1);
            const f2 = favoritesStore.isFavorite(r2);
            if (f1 !== f2) return f1 ? -1 : 1;
          }
          const d1 = routeDistances.get(r1.id) ?? Infinity;
          const d2 = routeDistances.get(r2.id) ?? Infinity;
          return d1 - d2;
        });

      const processedRoutes: ProcessedRoute[] = [];

      for (const route of sortedRoutes) {
        const info = routeToNearestStop.get(route.id);
        if (!info) continue;
        const { stop: nearestStop, distance } = info;

        let routeETAs: RouteETA[] = [];
        const kmbETAs = kmbEtaCache.get(nearestStop.id) ?? [];
        const filtered = filterETAsForRoute(route, kmbETAs);
        routeETAs.push(
          ...filtered.map((eta) => ({ ...eta, seq: nearestStop.sequence }))
        );

        if (route.company === 'CTB' || route.company === 'Both') {
          try {
            const ctbStopId = nearestStop.ctbStopId ?? nearestStop.id;
            const ctbETAs = await fetchETAsForStopOnRoute(route, {
              ...nearestStop,
              id: ctbStopId,
            });
            routeETAs.push(...ctbETAs);
          } catch (e) {
            console.warn(`CTB ETAs for ${route.routeNumber}:`, e);
          }
        }

        routeETAs.sort((a, b) => {
          if (!a.eta) return 1;
          if (!b.eta) return -1;
          return new Date(a.eta).getTime() - new Date(b.eta).getTime();
        });

        if (routeETAs.length > 0) {
          processedRoutes.push({ route, nearestStop, etas: routeETAs, distance });
        }
      }

      set({ processedNearbyRoutes: processedRoutes });
    } catch (error) {
      console.error('Error updating nearby routes:', error);
      set({ processedNearbyRoutes: [] });
    } finally {
      set({ isLoadingNearbyRoutes: false });
    }
  },
  
  // Set current route for detail view
  setCurrentRoute: (route: Route | null) => {
    set({ 
      currentRoute: route, 
      routeETAs: [],
      expandedStopId: null 
    });
  },
  
  // Fetch ETAs for current route
  fetchRouteETAs: async () => {
    const { currentRoute } = get();
    if (!currentRoute) return;
    
    set({ isLoadingETAs: true });
    
    try {
      const etas = await fetchETAsForRoute(currentRoute);
      set({ routeETAs: etas, isLoadingETAs: false });
    } catch (error) {
      console.error('Failed to fetch route ETAs:', error);
      set({ isLoadingETAs: false });
    }
  },
  
  // Fetch ETAs for a specific stop
  fetchStopETAs: async (stopId: string) => {
    const { currentRoute, routeETAs } = get();
    if (!currentRoute) return;
    
    const stop = currentRoute.stops.find(s => 
      s.id === stopId || getStopUniqueId(s) === stopId
    );
    if (!stop) return;
    
    set({ isLoadingETAs: true });
    
    try {
      const stopETAs = await fetchETAsForStopOnRoute(currentRoute, stop);
      
      // Merge with existing ETAs, replacing ones for this stop
      const otherETAs = routeETAs.filter(eta => eta.seq !== stop.sequence);
      const allETAs = [...otherETAs, ...stopETAs];
      
      // Sort by sequence then ETA time
      allETAs.sort((a, b) => {
        if (a.seq !== b.seq) return a.seq - b.seq;
        if (!a.eta) return 1;
        if (!b.eta) return -1;
        return new Date(a.eta).getTime() - new Date(b.eta).getTime();
      });
      
      set({ routeETAs: allETAs, isLoadingETAs: false });
    } catch (error) {
      console.error('Failed to fetch stop ETAs:', error);
      set({ isLoadingETAs: false });
    }
  },
  
  // Set expanded stop
  setExpandedStopId: (stopId: string | null) => {
    set({ expandedStopId: stopId });
  },
  
  // Clear route ETAs
  clearRouteETAs: () => {
    set({ routeETAs: [], expandedStopId: null });
  },
}));
