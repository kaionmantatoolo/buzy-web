'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Collapse,
  Fab,
  Typography,
} from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import CloseIcon from '@mui/icons-material/Close';
import { PageHeader } from '@/components/layout';
import { FavoriteButton, LoadingSpinner } from '@/components/ui';
import { StopRow } from '@/components/route';
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
    fetchStopETAs,
    setExpandedStopId,
    clearRouteETAs,
    userLocation,
  } = useRouteStore();

  const [showMap, setShowMap] = useState(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const hasAutoExpandedNearestStopRef = useRef(false);
  const stopListRef = useRef<HTMLDivElement | null>(null);

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

  // Set up refresh interval for expanded stop ETAs only
  useEffect(() => {
    if (currentRoute && expandedStopId) {
      refreshIntervalRef.current = setInterval(() => {
        // Background refresh for expanded stop only
        isRefreshingRef.current = true;
        fetchStopETAs(expandedStopId).finally(() => {
          isRefreshingRef.current = false;
        });
      }, 15000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [currentRoute, expandedStopId, fetchStopETAs]);


  // Auto-scroll to nearest stop and expand it with ETA fetch
  useEffect(() => {
    // Only auto-expand once per page entry.
    // Otherwise, collapsing a stop would immediately trigger auto-expand again (feels "not collapsable").
    if (
      hasAutoExpandedNearestStopRef.current ||
      !currentRoute ||
      !userLocation ||
      currentRoute.stops.length === 0 ||
      expandedStopId
    ) {
      return;
    }

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

      // Auto-expand the nearest stop and fetch its ETAs
      hasAutoExpandedNearestStopRef.current = true;
      setExpandedStopId(nearestStopId);
      fetchStopETAs(nearestStopId);

      // Auto-scroll to the nearest stop after a short delay to ensure DOM is updated
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      setTimeout(() => {
        const element = document.getElementById(`stop-${nearestStopId}`);
        const container = stopListRef.current;
        if (!element || !container) return;

        // Scroll the stop list container (not the window) so the sticky header/back button stays visible.
        const behavior = isMobile ? 'auto' : 'smooth';
        const elRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const topWithinContainer = elRect.top - containerRect.top + container.scrollTop;
        const padding = 8;

        container.scrollTo({
          top: Math.max(0, topWithinContainer - padding),
          behavior,
        });
      }, isMobile ? 50 : 100); // Faster delay on mobile
  }, [currentRoute, userLocation, expandedStopId, setExpandedStopId, fetchStopETAs]);

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
        // Clear ETAs when collapsing stop
        clearRouteETAs();
      } else {
        setExpandedStopId(stopId);
        fetchStopETAs(stopId);
      }
    },
    [expandedStopId, setExpandedStopId, fetchStopETAs, clearRouteETAs]
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
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Fixed header with shadow */}
      <Box sx={{ flex: '0 0 auto', boxShadow: 1 }}>
        <PageHeader
          title={`${currentRoute.routeNumber} ${t('to')} ${destination}`}
          showBack
          rightContent={<FavoriteButton route={currentRoute} size="small" />}
        />
      </Box>

      {/* Fixed map section - takes 35% of screen when visible */}
      <Collapse in={showMap}>
        <Box sx={{ height: '35vh', flex: '0 0 auto', position: 'relative' }}>
          <RouteMap
            stops={currentRoute.stops}
            selectedStopId={expandedStopId}
            userLocation={userLocation}
            onStopSelect={handleMapStopSelect}
          />

          {/* Map toggle button with better styling */}
          <Fab
            size="small"
            onClick={() => setShowMap(false)}
            sx={{
              position: 'absolute',
              top: 12,
              left: 12,
              bgcolor: 'background.paper',
              color: 'text.primary',
              '&:hover': {
                bgcolor: 'background.paper',
                transform: 'scale(1.05)',
              },
              transition: 'transform 0.2s',
              boxShadow: 3,
            }}
          >
            <CloseIcon fontSize="small" />
          </Fab>
        </Box>
      </Collapse>

      {/* Show map button when hidden - enhanced styling */}
      {!showMap && (
        <Box sx={{ px: 2, pt: 2, flex: '0 0 auto' }}>
          <Box
            onClick={() => setShowMap(true)}
            sx={{
              py: 1.5,
              px: 2,
              bgcolor: 'action.hover',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              cursor: 'pointer',
              '&:hover': {
                bgcolor: 'action.selected',
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s',
              boxShadow: 1,
            }}
          >
            <MapIcon fontSize="small" color="action" />
            <Typography variant="bodySmall" color="text.secondary" sx={{ fontWeight: 500 }}>
              Show Map
            </Typography>
          </Box>
        </Box>
      )}

      {/* Scrollable stop list - takes remaining space */}
      <Box
        ref={stopListRef}
        sx={{ flex: 1, overflow: 'auto', minHeight: 0, pt: showMap ? '35vh' : 0 }}
      >
        <Box sx={{ px: 2, py: 1, mt: showMap ? '-35vh' : 0 }}>
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
