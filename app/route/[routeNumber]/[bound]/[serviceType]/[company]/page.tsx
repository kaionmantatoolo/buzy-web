'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  IconButton,
  Stack,
  Collapse,
  Fab,
  Typography,
} from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import CloseIcon from '@mui/icons-material/Close';
import MyLocationIcon from '@mui/icons-material/MyLocation';
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
      fetchRouteETAs();

      refreshIntervalRef.current = setInterval(() => {
        fetchRouteETAs();
      }, 15000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      clearRouteETAs();
    };
  }, [currentRoute, fetchRouteETAs, clearRouteETAs]);

  // Auto-select nearest stop
  useEffect(() => {
    if (currentRoute && userLocation && currentRoute.stops.length > 0 && !expandedStopId) {
      let nearestStop = currentRoute.stops[0];
      let minDistance = Infinity;

      for (const stop of currentRoute.stops) {
        const stopLat = parseFloat(stop.lat);
        const stopLng = parseFloat(stop.long);
        const distance = Math.sqrt(
          Math.pow(stopLat - userLocation.lat, 2) +
            Math.pow(stopLng - userLocation.lng, 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          nearestStop = stop;
        }
      }

      setExpandedStopId(getStopUniqueId(nearestStop));
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
      } else {
        setExpandedStopId(stopId);
        fetchStopETAs(stopId);
      }
    },
    [expandedStopId, setExpandedStopId, fetchStopETAs]
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

      {/* Map section */}
      <Collapse in={showMap}>
        <Box sx={{ height: '40vh', minHeight: 250, position: 'relative' }}>
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

      {/* Loading indicator */}
      {isLoadingETAs && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 1, gap: 1 }}>
          <LoadingSpinner size="small" />
          <Typography variant="bodySmall" color="text.secondary">
            Updating ETAs...
          </Typography>
        </Box>
      )}

      {/* Stop list */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
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
                onToggle={() => handleStopToggle(uniqueId)}
                onSelect={() => handleMapStopSelect(uniqueId)}
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
