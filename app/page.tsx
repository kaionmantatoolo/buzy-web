'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Stack,
  CircularProgress,
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
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Request location permission
  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setIsRequestingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsRequestingLocation(false);
        setPermissionDenied(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsRequestingLocation(false);
        
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionDenied(true);
          setLocationError('Location permission denied. Please enable it in your browser settings.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError('Location unavailable. Please try again.');
        } else if (error.code === error.TIMEOUT) {
          setLocationError('Location request timed out. Please try again.');
        } else {
          setLocationError(error.message);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  }, [setUserLocation]);

  // Request location on mount - with a small delay to ensure page is loaded
  useEffect(() => {
    const timer = setTimeout(() => {
      requestLocation();
    }, 500);

    return () => clearTimeout(timer);
  }, [requestLocation]);

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
        {/* Location request in progress */}
        {isRequestingLocation && (
          <Box sx={{ textAlign: 'center', py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={32} />
            <Typography color="text.secondary">
              {t('findingNearbyRoutes')}
            </Typography>
          </Box>
        )}

        {/* Location error or permission denied */}
        {locationError && !isRequestingLocation && (
          <Box sx={{ py: 4 }}>
            <Alert
              severity={permissionDenied ? 'info' : 'warning'}
              sx={{ mb: 2 }}
              icon={<LocationOnIcon />}
            >
              <Typography variant="bodyMedium" sx={{ mb: 1 }}>
                {locationError}
              </Typography>
              {permissionDenied && (
                <Typography variant="bodySmall" color="text.secondary">
                  On iOS Safari: Settings → Safari → Location → Allow
                </Typography>
              )}
            </Alert>
            <Button
              variant="contained"
              fullWidth
              onClick={requestLocation}
              startIcon={<LocationOnIcon />}
            >
              {t('tryAgain')}
            </Button>
          </Box>
        )}

        {/* No location yet and not requesting */}
        {!userLocation && !isRequestingLocation && !locationError && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <LocationOnIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="titleMedium" gutterBottom>
              {t('locationNeeded')}
            </Typography>
            <Typography variant="bodyMedium" color="text.secondary" sx={{ mb: 3 }}>
              Enable location to find nearby bus stops
            </Typography>
            <Button
              variant="contained"
              onClick={requestLocation}
              startIcon={<LocationOnIcon />}
            >
              Enable Location
            </Button>
          </Box>
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
