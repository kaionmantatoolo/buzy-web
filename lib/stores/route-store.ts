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
    const { routes, userLocation, discoveryRange } = get();
    if (!userLocation || routes.length === 0) {
      set({ nearbyRoutes: [], processedNearbyRoutes: [] });
      return;
    }
    
    set({ isLoadingNearbyRoutes: true, processedNearbyRoutes: [] });
    
    try {
      // STEP 1: Find nearby routes
      const nearby = findNearbyRoutes(routes, userLocation.lat, userLocation.lng, discoveryRange);
      set({ nearbyRoutes: nearby });
      
      if (nearby.length === 0) {
        set({ isLoadingNearbyRoutes: false });
        return;
      }
      
      // STEP 2: Find nearest stop for each route and calculate distances
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
      
      // STEP 3: Get all unique nearby stop IDs
      const uniqueStopIds = Array.from(new Set(
        Array.from(routeToNearestStop.values()).map(v => v.stop.id)
      ));
      
      // STEP 4: Fetch KMB ETAs for all stops (efficient batch) - iOS approach
      const kmbEtaCache = new Map<string, StopETA[]>();
      
      for (const stopId of uniqueStopIds) {
        try {
          const stopETAs = await fetchKMBETAForStop(stopId);
          kmbEtaCache.set(stopId, stopETAs);
        } catch (error) {
          console.error(`Error fetching KMB ETAs for stop ${stopId}:`, error);
        }
      }
      
      // STEP 5: Process routes in sorted order (favorites first, then by distance)
      // Access favorites store directly (Zustand stores can be accessed from anywhere)
      let favoritesStore: any = null;
      try {
        const favoritesModule = await import('./favorites-store');
        favoritesStore = favoritesModule.useFavoritesStore.getState();
      } catch (e) {
        // Favorites store not available, skip favorite sorting
      }
      
      const sortedRoutes = nearby
        .filter(r => routeToNearestStop.has(r.id))
        .sort((r1, r2) => {
          // First priority: favorites
          if (favoritesStore) {
            const r1IsFavorite = favoritesStore.isFavorite(r1);
            const r2IsFavorite = favoritesStore.isFavorite(r2);
            if (r1IsFavorite !== r2IsFavorite) {
              return r1IsFavorite ? -1 : 1;
            }
          }
          
          // Second priority: distance
          const d1 = routeDistances.get(r1.id) ?? Infinity;
          const d2 = routeDistances.get(r2.id) ?? Infinity;
          return d1 - d2;
        });
      
      const processedRoutes: ProcessedRoute[] = [];
      
      for (const route of sortedRoutes) {
        const nearestStopInfo = routeToNearestStop.get(route.id);
        if (!nearestStopInfo) continue;
        
        const { stop: nearestStop, distance } = nearestStopInfo;
        
        // Get KMB ETAs from cache and filter for this route
        let routeETAs: RouteETA[] = [];
        const kmbETAs = kmbEtaCache.get(nearestStop.id) || [];
        const filteredKMBETAs = filterETAsForRoute(route, kmbETAs);
        routeETAs.push(...filteredKMBETAs.map(eta => ({
          ...eta,
          seq: nearestStop.sequence,
        })));
        
        // For CTB and JOINT routes, fetch CTB ETAs for this specific route-stop combo
        if (route.company === 'CTB' || route.company === 'Both') {
          try {
            const ctbStopId = nearestStop.ctbStopId || nearestStop.id;
            // Use the route-specific endpoint for CTB
            const ctbETAs = await fetchETAsForStopOnRoute(route, {
              ...nearestStop,
              id: ctbStopId,
            });
            routeETAs.push(...ctbETAs);
          } catch (error) {
            console.error(`Error fetching CTB ETAs for route ${route.routeNumber}:`, error);
          }
        }
        
        // Sort ETAs by time
        routeETAs.sort((a, b) => {
          if (!a.eta) return 1;
          if (!b.eta) return -1;
          return new Date(a.eta).getTime() - new Date(b.eta).getTime();
        });
        
        // Only add route if it has valid ETAs (iOS logic: if !routeETAs.isEmpty)
        if (routeETAs.length > 0) {
          processedRoutes.push({
            route,
            nearestStop,
            etas: routeETAs,
            distance,
          });
        }
      }
      
      set({ 
        processedNearbyRoutes: processedRoutes,
        isLoadingNearbyRoutes: false 
      });
    } catch (error) {
      console.error('Error updating nearby routes:', error);
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
