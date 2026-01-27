'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Stack,
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import MapIcon from '@mui/icons-material/Map';
import { PageHeader } from '@/components/layout';
import { RouteCard, RouteCardSkeleton } from '@/components/route';
import { FullPageLoader } from '@/components/ui';
import { useRouteStore, useSettingsStore } from '@/lib/stores';
import { useTranslation } from '@/lib/i18n';

export default function NearbyPage() {
  const { t } = useTranslation();
  const {
    nearbyRoutes,
    loadingState,
    userLocation,
    setUserLocation,
    updateNearbyRoutes,
  } = useRouteStore();
  const discoveryRange = useSettingsStore(state => state.discoveryRange);

  const [locationError, setLocationError] = useState<string | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // Request location on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      setIsRequestingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setIsRequestingLocation(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLocationError(error.message);
          setIsRequestingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    } else {
      setLocationError('Geolocation is not supported by your browser');
    }
  }, [setUserLocation]);

  // Update nearby routes when location or range changes
  useEffect(() => {
    if (userLocation) {
      updateNearbyRoutes();
    }
  }, [userLocation, discoveryRange, updateNearbyRoutes]);

  // Show loading while fetching initial data
  if (loadingState === 'loading') {
    return <FullPageLoader message={t('fetchingRouteData')} />;
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title={t('nearbyRoutes')} />

      <Box sx={{ p: 2, flex: 1 }}>
        {/* Location status */}
        {isRequestingLocation && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography color="text.secondary" className="animate-pulse">
              {t('findingNearbyRoutes')}
            </Typography>
          </Box>
        )}

        {/* Location error */}
        {locationError && !isRequestingLocation && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  setLocationError(null);
                  setIsRequestingLocation(true);
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                      });
                      setIsRequestingLocation(false);
                    },
                    (error) => {
                      setLocationError(error.message);
                      setIsRequestingLocation(false);
                    }
                  );
                }}
              >
                {t('tryAgain')}
              </Button>
            }
          >
            {t('locationNeeded')}
          </Alert>
        )}

        {/* Discovery range indicator */}
        {userLocation && !isRequestingLocation && (
          <Typography
            variant="bodySmall"
            color="text.secondary"
            sx={{ textAlign: 'center', mb: 2 }}
          >
            {t('showingRoutesWithin', discoveryRange)}
          </Typography>
        )}

        {/* Route list */}
        {userLocation && !isRequestingLocation && (
          <>
            {nearbyRoutes.length > 0 ? (
              <Stack spacing={0}>
                {nearbyRoutes.map(route => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    showDistance
                  />
                ))}
              </Stack>
            ) : loadingState === 'success' ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <MapIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography color="text.secondary">
                  {t('noNearbyRoutes')}
                </Typography>
              </Box>
            ) : (
              // Loading skeletons
              <Stack spacing={0}>
                {[...Array(5)].map((_, i) => (
                  <RouteCardSkeleton key={i} />
                ))}
              </Stack>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
