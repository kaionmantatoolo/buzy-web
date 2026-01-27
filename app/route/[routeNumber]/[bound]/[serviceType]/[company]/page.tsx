'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Collapse,
  Fab,
  Typography,
  Snackbar,
} from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import CloseIcon from '@mui/icons-material/Close';
import { PageHeader } from '@/components/layout';
import { FavoriteButton, LoadingSpinner } from '@/components/ui';
import { StopRow, StopRowSkeleton } from '@/components/route';
import { RouteMap } from '@/components/map';
import { useRouteStore, useSettingsStore } from '@/lib/stores';
import {
  Route,
  BusCompany,
  getRouteDestination,
  getStopUniqueId,
  RouteETA,
} from '@/lib/types';
import { calculateDistance } from '@/lib/services/github-data';
import { useTranslation } from '@/lib/i18n';

export default function RouteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const useCTBInfo = useSettingsStore(state => state.useCTBInfoForJointRoutes);

  const {
    routes,
    currentRoute,
    routeETAs,
    expandedStopId,
    isLoadingETAs,
    setCurrentRoute,
    fetchRouteETAs,
    fetchStopETAs,
    setExpandedStopId,
    clearRouteETAs,
    userLocation,
  } = useRouteStore();

  const [showMap, setShowMap] = useState(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const isRefreshingRef = useRef(false);

  // Parse route params
  const routeNumber = params.routeNumber as string;
  const bound = params.bound as string;
  const serviceType = params.serviceType as string;
  const company = params.company as BusCompany;

  // Find the route from our routes list
  useEffect(() => {
    if (routes.length > 0) {
      const foundRoute = routes.find(
        r =>
          r.routeNumber === routeNumber &&
          r.bound === bound &&
          r.serviceType === serviceType &&
          r.company === company
      );

      if (foundRoute) {
        setCurrentRoute(foundRoute);
      } else {
        router.back();
      }
    }
  }, [routes, routeNumber, bound, serviceType, company, setCurrentRoute, router]);

  // Fetch ETAs on mount and set up refresh interval
  useEffect(() => {
    if (currentRoute) {
      // Initial fetch: no toast
      fetchRouteETAs();

      refreshIntervalRef.current = setInterval(() => {
        // Background refresh: toast instead of in-list indicator
        isRefreshingRef.current = true;
        if (hasLoadedOnceRef.current) setToastMessage(t('updatingEtas'));
        fetchRouteETAs().finally(() => {
          isRefreshingRef.current = false;
        });
      }, 15000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      clearRouteETAs();
    };
  }, [currentRoute, fetchRouteETAs, clearRouteETAs]);

  // Mark "loaded once" so future refreshes can show toast
  useEffect(() => {
    if (!hasLoadedOnceRef.current && routeETAs.length > 0) {
      hasLoadedOnceRef.current = true;
    }
  }, [routeETAs.length]);

  // Auto-select nearest stop and scroll to it
  useEffect(() => {
    if (currentRoute && userLocation && currentRoute.stops.length > 0 && !expandedStopId) {
      let nearestStop = currentRoute.stops[0];
      let minDistance = Infinity;

      for (const stop of currentRoute.stops) {
        const stopLat = parseFloat(stop.lat);
        const stopLng = parseFloat(stop.long);
        const distance = calculateDistance(userLocation.lat, userLocation.lng, stopLat, stopLng);

        if (distance < minDistance) {
          minDistance = distance;
          nearestStop = stop;
        }
      }

      const nearestStopId = getStopUniqueId(nearestStop);
      setExpandedStopId(nearestStopId);

      // Auto-scroll to the nearest stop after a short delay to ensure DOM is updated
      setTimeout(() => {
        const element = document.getElementById(`stop-${nearestStopId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [currentRoute, userLocation, expandedStopId, setExpandedStopId]);

  // Group ETAs by stop sequence
  const etasByStop = useMemo(() => {
    const grouped = new Map<number, RouteETA[]>();

    for (const eta of routeETAs) {
      const existing = grouped.get(eta.seq) || [];
      existing.push(eta);
      grouped.set(eta.seq, existing);
    }

    for (const [seq, etas] of grouped) {
      etas.sort((a, b) => {
        if (!a.eta) return 1;
        if (!b.eta) return -1;
        return new Date(a.eta).getTime() - new Date(b.eta).getTime();
      });
    }

    return grouped;
  }, [routeETAs]);

  // Handle stop toggle
  const handleStopToggle = useCallback(
    (stopId: string) => {
      if (expandedStopId === stopId) {
        setExpandedStopId(null);
        // iOS behavior: when collapsing, go back to route-level ETAs
        fetchRouteETAs();
      } else {
        setExpandedStopId(stopId);
        fetchStopETAs(stopId);
      }
    },
    [expandedStopId, setExpandedStopId, fetchStopETAs, fetchRouteETAs]
  );

  // Handle map stop selection
  const handleMapStopSelect = useCallback(
    (stopId: string) => {
      setExpandedStopId(stopId);
      fetchStopETAs(stopId);
    },
    [setExpandedStopId, fetchStopETAs]
  );

  if (!currentRoute) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LoadingSpinner size="large" />
      </Box>
    );
  }

  const destination = getRouteDestination(currentRoute, locale, useCTBInfo);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <PageHeader
        title={`${currentRoute.routeNumber} ${t('to')} ${destination}`}
        showBack
        rightContent={<FavoriteButton route={currentRoute} size="small" />}
      />

      {/* Map section - takes 35% of screen when visible */}
      <Collapse in={showMap}>
        <Box sx={{ height: '35vh', position: 'relative' }}>
          <RouteMap
            stops={currentRoute.stops}
            selectedStopId={expandedStopId}
            userLocation={userLocation}
            onStopSelect={handleMapStopSelect}
          />

          {/* Map toggle button */}
          <Fab
            size="small"
            onClick={() => setShowMap(false)}
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              bgcolor: 'background.paper',
              color: 'text.primary',
              '&:hover': { bgcolor: 'background.paper' },
            }}
          >
            <CloseIcon fontSize="small" />
          </Fab>
        </Box>
      </Collapse>

      {/* Show map button when hidden */}
      {!showMap && (
        <Box sx={{ px: 2, pt: 2 }}>
          <Box
            onClick={() => setShowMap(true)}
            sx={{
              py: 1.5,
              px: 2,
              bgcolor: 'action.hover',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.selected' },
            }}
          >
            <MapIcon fontSize="small" color="action" />
            <Typography variant="bodySmall" color="text.secondary">
              Show map
            </Typography>
          </Box>
        </Box>
      )}

      {/* Toast-style refresh indicator (avoid top-of-list banner) */}
      <Snackbar
        open={!!toastMessage && hasLoadedOnceRef.current}
        message={toastMessage ?? ''}
        autoHideDuration={1200}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          '& .MuiSnackbarContent-root': {
            borderRadius: 999,
          },
          // Keep above bottom nav + safe area
          mb: 'calc(64px + env(safe-area-inset-bottom, 0px) + 10px)',
        }}
      />

      {/* Stop list - takes remaining space and is scrollable */}
      <Box sx={{ flex: 1, overflow: 'auto', height: showMap ? '65vh' : 'auto' }}>
        <Box sx={{ px: 2, py: 1 }}>
          {currentRoute.stops.map((stop, index) => {
            const uniqueId = getStopUniqueId(stop);
            const stopETAs = etasByStop.get(stop.sequence) || [];

            return (
              <StopRow
                key={uniqueId}
                stop={stop}
                etas={stopETAs}
                isExpanded={expandedStopId === uniqueId}
                isSelected={expandedStopId === uniqueId}
                isLoading={isLoadingETAs && expandedStopId === uniqueId}
                onToggle={() => handleStopToggle(uniqueId)}
                isFirst={index === 0}
                isLast={index === currentRoute.stops.length - 1}
              />
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
