import { create } from 'zustand';
import { isUpcomingETA, Route, RouteETA, StopDetail, StopETA, LoadingState, getStopLocation, getStopUniqueId } from '@/lib/types';
import { fetchRoutes, searchRoutes, filterRoutesByCompany } from '@/lib/services/github-data';
import {
  fetchETAsForRoute,
  fetchETAsForStopOnRoute,
  fetchKMBETAForStop,
  fetchCTBETAForStop,
  filterETAsForRoute,
} from '@/lib/services/eta-service';
import { log } from '@/lib/logger';
import { queryNearbyRoutesFromGridIndex, rebuildNearbyGridIndex } from '@/lib/spatial/nearby-grid-index';

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

  // Last time route data was successfully loaded (ms since epoch).
  // This is used as a reliable "last downloaded" indicator even if localStorage is unavailable.
  lastRoutesUpdatedAt: number | null;
  
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
  lastRoutesUpdatedAt: null,
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
      // Build spatial index once so nearby queries are fast.
      rebuildNearbyGridIndex(routes);
      set({ 
        routes, 
        filteredRoutes: routes,
        lastRoutesUpdatedAt: Date.now(),
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

    // Safety timeout: prevent infinite hanging (60 seconds max)
    const safetyTimeout = setTimeout(() => {
      if (!abortController.signal.aborted) {
        console.error('[NearbyRoutes] Safety timeout - updateNearbyRoutes taking too long, aborting');
        abortController.abort();
        set({ isLoadingNearbyRoutes: false, processedNearbyRoutes: [] });
      }
    }, 60_000);

    try {
      log.debug(`[NearbyRoutes] Starting updateNearbyRoutes: ${routes.length} routes, range ${discoveryRange}m`);
      
      // Check if cancelled before starting
      if (abortController.signal.aborted) {
        clearTimeout(safetyTimeout);
        log.debug('[NearbyRoutes] Update cancelled before start');
        set({ isLoadingNearbyRoutes: false });
        return;
      }
      
      const { nearbyRoutes: nearby, routeToNearestStop, routeDistances } =
        queryNearbyRoutesFromGridIndex(userLocation.lat, userLocation.lng, discoveryRange);

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

      // iOS-style: prefer a *small* lazy list of nearest routes/stops.
      // We cap how many routes and unique stops we fetch ETAs for to avoid
      // hammering the KMB API and freezing mobile browsers.
      // On iOS Safari we are extra conservative.
      const isIOS =
        typeof navigator !== 'undefined' &&
        /iPhone|iPad|iPod/.test(navigator.userAgent || '');
      const MAX_VISIBLE_ROUTES = isIOS ? 8 : 15;
      const MAX_UNIQUE_STOPS_FOR_KMB = isIOS ? 8 : 20;

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

      // Only use the closest + favorite-weighted routes when deciding which
      // stops to fetch ETAs for (lazy list behaviour like iOS).
      const routesForETAs = sortedRoutes.slice(0, MAX_VISIBLE_ROUTES);

      const limitedStopIds = Array.from(
        new Set(
          routesForETAs
            .map((r) => routeToNearestStop.get(r.id)?.stop.id)
            .filter((id): id is string => Boolean(id))
        )
      ).slice(0, MAX_UNIQUE_STOPS_FOR_KMB);
      const limitedCTBStopIds = Array.from(
        new Set(
          routesForETAs
            .map((r) => {
              const stop = routeToNearestStop.get(r.id)?.stop;
              return stop?.ctbStopId ?? stop?.id;
            })
            .filter((id): id is string => Boolean(id))
        )
      ).slice(0, MAX_UNIQUE_STOPS_FOR_KMB);

      log.debug(
        `[NearbyRoutes] Fetching KMB ETAs for ${limitedStopIds.length} unique stops ` +
          `(from ${routesForETAs.length} nearest routes, total nearby=${nearby.length})`
      );
      log.debug(
        `[NearbyRoutes] Fetching CTB ETAs for ${limitedCTBStopIds.length} unique stops`
      );

      // Fetch KMB ETAs **sequentially in distance order** (no concurrency),
      // matching the iOS lazy list behavior more closely and reducing the
      // chance of main-thread contention on mobile Safari.
      const kmbEtaCache = new Map<string, StopETA[]>();
      const ctbEtaCache = new Map<string, StopETA[]>();
      const etaResults: Array<{ stopId: string; stopETAs: StopETA[] }> = [];

      for (const stopId of limitedStopIds) {
        if (abortController.signal.aborted) break;

        try {
          const stopETAs = await fetchKMBETAForStop(stopId);
          etaResults.push({ stopId, stopETAs });
        } catch (error) {
          if (abortController.signal.aborted) {
            log.debug(`[NearbyRoutes] Fetch cancelled for stop ${stopId}`);
          } else {
            console.warn(
              `[NearbyRoutes] Failed to fetch ETAs for stop ${stopId}:`,
              error
            );
          }
          etaResults.push({ stopId, stopETAs: [] });
        }

        // Yield briefly between stops to keep UI responsive.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      for (const stopId of limitedCTBStopIds) {
        if (abortController.signal.aborted) break;

        try {
          const stopETAs = await fetchCTBETAForStop(stopId);
          ctbEtaCache.set(stopId, stopETAs);
        } catch (error) {
          if (abortController.signal.aborted) {
            log.debug(`[NearbyRoutes] Fetch cancelled for CTB stop ${stopId}`);
          } else {
            console.warn(
              `[NearbyRoutes] Failed to fetch CTB ETAs for stop ${stopId}:`,
              error
            );
          }
          ctbEtaCache.set(stopId, []);
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // Check cancellation after batch fetch
      if (abortController.signal.aborted) {
        log.debug('[NearbyRoutes] Update cancelled after batch fetch');
        set({ isLoadingNearbyRoutes: false });
        return;
      }

      for (const { stopId, stopETAs } of etaResults) {
        kmbEtaCache.set(stopId, stopETAs);
      }
      
      // Only process a limited number of routes for the lazy nearby list.
      const routesToProcess = routesForETAs;

      log.debug(
        `[NearbyRoutes] KMB ETA fetch complete, processing ${routesToProcess.length} routes incrementally`
      );

      // Build the list in-memory first to avoid frequent state updates
      // (helps prevent UI hangs on mobile Safari/Chrome).
      const nextProcessed: ProcessedRoute[] = [];

      for (const route of routesToProcess) {
        // Check cancellation before processing each route (iOS: if Task.isCancelled { break })
        if (abortController.signal.aborted) {
          log.debug(`[NearbyRoutes] Update cancelled, stopping at route ${route.routeNumber}`);
          break;
        }
        
        const info = routeToNearestStop.get(route.id);
        if (!info) continue;
        const { stop: nearestStop, distance } = info;

        let routeETAs: RouteETA[] = [];

        const kmbETAs = kmbEtaCache.get(nearestStop.id) ?? [];
        const ctbStopId = nearestStop.ctbStopId ?? nearestStop.id;
        const ctbETAs = ctbEtaCache.get(ctbStopId) ?? [];
        const combinedStopETAs = [...kmbETAs, ...ctbETAs];

        const filtered = filterETAsForRoute(route, combinedStopETAs);
        routeETAs.push(...filtered.map((eta) => ({ ...eta, seq: nearestStop.sequence })));

        const sortByEtaTime = (arr: RouteETA[]) => {
          arr.sort((a, b) => {
            if (!a.eta) return 1;
            if (!b.eta) return -1;
            return new Date(a.eta).getTime() - new Date(b.eta).getTime();
          });
        };

        const filterDisplayableETAs = (arr: RouteETA[]) => arr.filter((e) => isUpcomingETA(e.eta));

        // If we already have valid KMB ETAs, show the route now (incremental like iOS)
        sortByEtaTime(routeETAs);
        routeETAs = filterDisplayableETAs(routeETAs);
        const hadAnyETAsInitially = routeETAs.length > 0;
        if (hadAnyETAsInitially) {
          nextProcessed.push({ route, nearestStop, etas: routeETAs, distance });
          log.debug(
            `[NearbyRoutes] Added route ${route.routeNumber} with ${routeETAs.length} ETAs (${nextProcessed.length} total)`
          );
        }
      }
      
      // Commit results once to reduce render churn
      if (!abortController.signal.aborted) {
        set({
          processedNearbyRoutes: nextProcessed,
          isLoadingNearbyRoutes: false,
        });
        log.debug(
          `[NearbyRoutes] Finished processing: ${nextProcessed.length} routes with valid ETAs`
        );
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        log.debug('[NearbyRoutes] Update was cancelled');
      } else {
        console.error('[NearbyRoutes] Error updating nearby routes:', error);
        set({ processedNearbyRoutes: [] });
      }
    } finally {
      clearTimeout(safetyTimeout);
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
