import { create } from 'zustand';
import { isUpcomingETA, Route, RouteETA, StopDetail, StopETA, LoadingState, getStopLocation, getStopUniqueId } from '@/lib/types';
import { fetchRoutes, searchRoutes, filterRoutesByCompany } from '@/lib/services/github-data';
import {
  fetchETAsForRoute,
  fetchETAsForStopOnRoute,
  fetchKMBETAForStop,
  fetchCTBETAForStop,
  filterETAsForRoute,
  resolveCTBStopIdForRouteStop,
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

      // iOS-style: process all nearby routes in distance order, but keep
      // web safe by batching ETA fetches and capping only when range is large.
      const isIOS =
        typeof navigator !== 'undefined' &&
        /iPhone|iPad|iPod/.test(navigator.userAgent || '');
      const rangeFactor = Math.min(4, Math.max(1, Math.ceil(discoveryRange / 400)));
      const shouldCap = isIOS || discoveryRange > 600;
      const MAX_PROCESS_ROUTES = shouldCap ? (isIOS ? 80 : 300) * rangeFactor : Infinity;
      const MAX_UNIQUE_STOPS = shouldCap ? (isIOS ? 25 : 80) * rangeFactor : Infinity;
      const ETA_BATCH_SIZE = 5;

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

      const routesToProcess = sortedRoutes.slice(0, Number.isFinite(MAX_PROCESS_ROUTES) ? MAX_PROCESS_ROUTES : sortedRoutes.length);
      const routeById = new Map(routesToProcess.map((route) => [route.id, route]));

      const stopEntries = new Map<
        string,
        { stop: StopDetail; distance: number; routeIds: string[] }
      >();
      for (const route of routesToProcess) {
        const info = routeToNearestStop.get(route.id);
        if (!info) continue;
        const { stop, distance } = info;
        const entry = stopEntries.get(stop.id);
        if (entry) {
          entry.routeIds.push(route.id);
          if (distance < entry.distance) entry.distance = distance;
        } else {
          stopEntries.set(stop.id, { stop, distance, routeIds: [route.id] });
        }
      }

      const sortedStops = Array.from(stopEntries.values()).sort((a, b) => a.distance - b.distance);
      const stopsToFetch = sortedStops.slice(
        0,
        Number.isFinite(MAX_UNIQUE_STOPS) ? MAX_UNIQUE_STOPS : sortedStops.length
      );

      log.debug(
        `[NearbyRoutes] Processing ${routesToProcess.length} routes, fetching ETAs for ${stopsToFetch.length} unique stops ` +
          `(total nearby=${nearby.length}, range=${discoveryRange}m)`
      );

      const kmbEtaCache = new Map<string, StopETA[]>();
      const ctbEtaCache = new Map<string, StopETA[]>();
      const ctbStopIdCache = new Map<string, string>();
      const processedByRouteId = new Map<string, ProcessedRoute>();

      const sortByEtaTime = (arr: RouteETA[]) => {
        arr.sort((a, b) => {
          if (!a.eta) return 1;
          if (!b.eta) return -1;
          return new Date(a.eta).getTime() - new Date(b.eta).getTime();
        });
      };

      const refreshProcessed = () => {
        const nextProcessed: ProcessedRoute[] = [];
        for (const route of routesToProcess) {
          const item = processedByRouteId.get(route.id);
          if (item) nextProcessed.push(item);
        }
        set({ processedNearbyRoutes: nextProcessed });
      };

      const updateRoutesForStop = (entry: { stop: StopDetail; distance: number; routeIds: string[] }) => {
        const stop = entry.stop;
        const kmbETAs = kmbEtaCache.get(stop.id) ?? [];
        const resolvedCTBStopId = ctbStopIdCache.get(stop.id) ?? stop.ctbStopId ?? stop.id;
        const ctbETAs = ctbEtaCache.get(resolvedCTBStopId) ?? [];
        const combinedStopETAs = [...kmbETAs, ...ctbETAs];

        for (const routeId of entry.routeIds) {
          const route = routeById.get(routeId);
          if (!route) continue;
          const info = routeToNearestStop.get(route.id);
          if (!info) continue;
          const filtered = filterETAsForRoute(route, combinedStopETAs).map((eta) => ({
            ...eta,
            seq: info.stop.sequence,
          }));
          if (filtered.length === 0) continue;
          sortByEtaTime(filtered);
          processedByRouteId.set(route.id, {
            route,
            nearestStop: info.stop,
            etas: filtered,
            distance: info.distance,
          });
        }
      };

      let batchCounter = 0;
      for (const entry of stopsToFetch) {
        if (abortController.signal.aborted) break;

        const stopId = entry.stop.id;
        try {
          const stopETAs = await fetchKMBETAForStop(stopId);
          kmbEtaCache.set(stopId, stopETAs);
        } catch (error) {
          if (abortController.signal.aborted) {
            log.debug(`[NearbyRoutes] Fetch cancelled for stop ${stopId}`);
          } else {
            console.warn(`[NearbyRoutes] Failed to fetch KMB ETAs for stop ${stopId}:`, error);
          }
          kmbEtaCache.set(stopId, []);
        }

        const needsCTB = entry.routeIds.some((routeId) => {
          const route = routeById.get(routeId);
          return route?.company === 'CTB' || route?.company === 'Both';
        });

        if (needsCTB) {
          let ctbStopId = entry.stop.ctbStopId;
          if (!ctbStopId) {
            const routeForCTB = entry.routeIds
              .map((routeId) => routeById.get(routeId))
              .find((route) => route && (route.company === 'CTB' || route.company === 'Both'));
            if (routeForCTB) {
              ctbStopId = await resolveCTBStopIdForRouteStop(
                routeForCTB.routeNumber,
                routeForCTB.bound,
                entry.stop.sequence,
                entry.stop.id
              );
            }
          }
          const resolved = ctbStopId ?? entry.stop.id;
          ctbStopIdCache.set(entry.stop.id, resolved);
          try {
            const stopETAs = await fetchCTBETAForStop(resolved);
            ctbEtaCache.set(resolved, stopETAs);
          } catch (error) {
            if (abortController.signal.aborted) {
              log.debug(`[NearbyRoutes] Fetch cancelled for CTB stop ${resolved}`);
            } else {
              console.warn(`[NearbyRoutes] Failed to fetch CTB ETAs for stop ${resolved}:`, error);
            }
            ctbEtaCache.set(resolved, []);
          }
        }

        updateRoutesForStop(entry);
        batchCounter += 1;

        if (batchCounter >= ETA_BATCH_SIZE) {
          batchCounter = 0;
          if (!abortController.signal.aborted) {
            refreshProcessed();
          }
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      if (!abortController.signal.aborted) {
        refreshProcessed();
        set({ isLoadingNearbyRoutes: false });
        log.debug(
          `[NearbyRoutes] Finished processing: ${processedByRouteId.size} routes with valid ETAs`
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
