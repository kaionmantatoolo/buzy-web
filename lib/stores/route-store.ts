import { create } from 'zustand';
import { Route, RouteETA, StopDetail, StopETA, LoadingState, getStopLocation, getStopUniqueId } from '@/lib/types';
import { fetchRoutes, findNearbyRoutes, searchRoutes, filterRoutesByCompany, calculateDistance } from '@/lib/services/github-data';
import { fetchETAsForRoute, fetchETAsForStopOnRoute, fetchKMBETAForStop, filterETAsForRoute } from '@/lib/services/eta-service';
import { log } from '@/lib/logger';

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
  
  // Internal: prevent concurrent nearby route updates
  _nearbyUpdateAbortController: AbortController | null;
  
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
  _nearbyUpdateAbortController: null,
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
  // Note: Don't auto-trigger updateNearbyRoutes here - let the page component's effect handle it
  // This prevents race conditions when location is set before routes are loaded
  setUserLocation: (location: { lat: number; lng: number } | null) => {
    set({ userLocation: location });
    // Removed auto-trigger: let page component effect handle updateNearbyRoutes
    // This matches iOS behavior where the view explicitly calls fetchNearbyRoutes
  },
  
  // Set discovery range
  setDiscoveryRange: (range: number) => {
    set({ discoveryRange: range });
    get().updateNearbyRoutes();
  },
  
  // Update nearby routes based on current location - iOS-style processing
  updateNearbyRoutes: async () => {
    const { routes, userLocation, _nearbyUpdateAbortController } = get();
    if (!userLocation || routes.length === 0) {
      set({ nearbyRoutes: [], processedNearbyRoutes: [], isLoadingNearbyRoutes: false });
      return;
    }

    // Cancel any existing update (iOS: routeProcessingTask?.cancel())
    if (_nearbyUpdateAbortController) {
      _nearbyUpdateAbortController.abort();
    }

    // Create new abort controller for this update
    const abortController = new AbortController();
    set({ _nearbyUpdateAbortController: abortController });

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
      log.debug(`[NearbyRoutes] Starting updateNearbyRoutes: ${routes.length} routes, range ${discoveryRange}m`);
      
      // Check if cancelled before starting
      if (abortController.signal.aborted) {
        log.debug('[NearbyRoutes] Update cancelled before start');
        set({ isLoadingNearbyRoutes: false });
        return;
      }
      
      const nearby = findNearbyRoutes(routes, userLocation.lat, userLocation.lng, discoveryRange);
      log.debug(`[NearbyRoutes] Found ${nearby.length} nearby routes`);
      set({ nearbyRoutes: nearby });

      if (nearby.length === 0) {
        log.debug('[NearbyRoutes] No nearby routes found, clearing loading');
        set({ isLoadingNearbyRoutes: false, processedNearbyRoutes: [] });
        return;
      }
      
      // Check cancellation after finding routes
      if (abortController.signal.aborted) {
        log.debug('[NearbyRoutes] Update cancelled after finding routes');
        set({ isLoadingNearbyRoutes: false });
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

      log.debug(`[NearbyRoutes] Fetching KMB ETAs for ${uniqueStopIds.length} unique stops (parallel)`);
      
      // Fetch KMB ETAs in parallel for all unique stops (much faster than sequential)
      const kmbEtaCache = new Map<string, StopETA[]>();
      const etaPromises = uniqueStopIds.map(async (stopId) => {
        // Check cancellation before each fetch
        if (abortController.signal.aborted) {
          return { stopId, stopETAs: [] };
        }
        try {
          const stopETAs = await fetchKMBETAForStop(stopId);
          return { stopId, stopETAs };
        } catch (error) {
          if (abortController.signal.aborted) {
            log.debug(`[NearbyRoutes] Fetch cancelled for stop ${stopId}`);
          } else {
            console.warn(`[NearbyRoutes] Failed to fetch ETAs for stop ${stopId}:`, error);
          }
          return { stopId, stopETAs: [] };
        }
      });
      
      const etaResults = await Promise.all(etaPromises);
      
      // Check cancellation after batch fetch
      if (abortController.signal.aborted) {
        log.debug('[NearbyRoutes] Update cancelled after batch fetch');
        set({ isLoadingNearbyRoutes: false });
        return;
      }
      
      for (const { stopId, stopETAs } of etaResults) {
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
      
      log.debug(`[NearbyRoutes] KMB ETA fetch complete, processing ${sortedRoutes.length} routes incrementally`);

      // iOS-style incremental display: process routes one-by-one, append as each completes
      // Start with empty list - routes will appear incrementally
      set({ processedNearbyRoutes: [] });

      for (const route of sortedRoutes) {
        // Check cancellation before processing each route (iOS: if Task.isCancelled { break })
        if (abortController.signal.aborted) {
          log.debug(`[NearbyRoutes] Update cancelled, stopping at route ${route.routeNumber}`);
          break;
        }
        
        const info = routeToNearestStop.get(route.id);
        if (!info) continue;
        const { stop: nearestStop, distance } = info;

        let routeETAs: RouteETA[] = [];
        
        // STEP 1: Get KMB ETAs (if route uses KMB) and show immediately if available (iOS-style incremental display)
        if (route.company === 'KMB' || route.company === 'Both') {
          const kmbETAs = kmbEtaCache.get(nearestStop.id) ?? [];
          const filtered = filterETAsForRoute(route, kmbETAs);
          routeETAs.push(
            ...filtered.map((eta) => ({ ...eta, seq: nearestStop.sequence }))
          );
        }

        const sortByEtaTime = (arr: RouteETA[]) => {
          arr.sort((a, b) => {
            if (!a.eta) return 1;
            if (!b.eta) return -1;
            return new Date(a.eta).getTime() - new Date(b.eta).getTime();
          });
        };

        // If we already have valid KMB ETAs, show the route now (incremental like iOS)
        sortByEtaTime(routeETAs);
        const hadAnyETAsInitially = routeETAs.length > 0;
        let hasShownRoute = false;

        if (hadAnyETAsInitially) {
          const current = get().processedNearbyRoutes;
          set({
            processedNearbyRoutes: [
              ...current,
              { route, nearestStop, etas: routeETAs, distance },
            ],
          });
          hasShownRoute = true;
          log.debug(`[NearbyRoutes] Added route ${route.routeNumber} with ${routeETAs.length} ETAs (${current.length + 1} total)`);
          await new Promise((resolve) => setTimeout(resolve, 80));
        }

        // STEP 2: Fetch CTB ETAs
        // - If route already displayed (has KMB ETAs), fetch CTB in background and merge when done (fast UX)
        // - If route not displayed yet (CTB-only or no KMB ETAs), await CTB and only display if ETAs exist (strict iOS rule)
        if ((route.company === 'CTB' || route.company === 'Both') && !abortController.signal.aborted) {
          const stopForCTB: StopDetail = {
            ...nearestStop,
            id: nearestStop.ctbStopId ?? nearestStop.id,
          };

          const ctbPromise = fetchETAsForStopOnRoute(route, stopForCTB);

          if (hasShownRoute) {
            ctbPromise
              .then((ctbETAs) => {
                if (abortController.signal.aborted) return;
                if (ctbETAs.length === 0) return;

                const current = get().processedNearbyRoutes;
                const routeIndex = current.findIndex((r) => r.route.id === route.id);
                if (routeIndex === -1) return;

                const existingETAs = current[routeIndex].etas;
                const merged = [...existingETAs, ...ctbETAs];
                sortByEtaTime(merged);

                const updated = [...current];
                updated[routeIndex] = { ...updated[routeIndex], etas: merged };
                set({ processedNearbyRoutes: updated });
              })
              .catch((e) => {
                if (!abortController.signal.aborted) {
                  console.warn(`[NearbyRoutes] CTB ETAs for ${route.routeNumber}:`, e);
                }
              });
          } else {
            try {
              const ctbETAs = await ctbPromise;
              routeETAs.push(...ctbETAs);
              sortByEtaTime(routeETAs);

              if (routeETAs.length > 0) {
                const current = get().processedNearbyRoutes;
                set({
                  processedNearbyRoutes: [
                    ...current,
                    { route, nearestStop, etas: routeETAs, distance },
                  ],
                });
                log.debug(`[NearbyRoutes] Added route ${route.routeNumber} with ${routeETAs.length} ETAs (${current.length + 1} total)`);
                await new Promise((resolve) => setTimeout(resolve, 80));
              }
            } catch (e) {
              if (!abortController.signal.aborted) {
                console.warn(`[NearbyRoutes] CTB ETAs for ${route.routeNumber}:`, e);
              }
            }
          }
        }
      }
      
      // Only log if not cancelled
      if (!abortController.signal.aborted) {
        log.debug(`[NearbyRoutes] Finished processing: ${get().processedNearbyRoutes.length} routes with valid ETAs`);
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        log.debug('[NearbyRoutes] Update was cancelled');
      } else {
        console.error('[NearbyRoutes] Error updating nearby routes:', error);
        set({ processedNearbyRoutes: [] });
      }
    } finally {
      // Clear abort controller and loading state
      const currentController = get()._nearbyUpdateAbortController;
      if (currentController === abortController) {
        set({ _nearbyUpdateAbortController: null });
      }
      log.debug('[NearbyRoutes] Clearing loading state');
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
