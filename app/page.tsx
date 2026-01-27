'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Divider,
  alpha,
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import MapIcon from '@mui/icons-material/Map';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { PageHeader } from '@/components/layout';
import { NearbyRouteRow, NearbyRouteRowSkeleton } from '@/components/route';
import { FullPageLoader } from '@/components/ui';
import { useRouteStore, useSettingsStore } from '@/lib/stores';
import { useTranslation } from '@/lib/i18n';

export default function NearbyPage() {
  const { t } = useTranslation();
  const {
    processedNearbyRoutes,
    isLoadingNearbyRoutes,
    loadingState,
    routes,
    userLocation,
    setUserLocation,
    updateNearbyRoutes,
  } = useRouteStore();
  const discoveryRange = useSettingsStore((state) => state.discoveryRange);

  const [locationError, setLocationError] = useState<string | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking');

  // Check permission status without requesting (Safari-safe)
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setPermissionStatus('denied');
      return;
    }

    // Use Permissions API if available (Chrome, Firefox, but not Safari)
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        
        // If already granted, try to get location silently (Safari allows this)
        if (result.state === 'granted' && !userLocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setUserLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              });
            },
            (error) => {
              // Silent fail - user will need to click button
              console.log('Silent location fetch failed:', error);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
          );
        }
        
        // Listen for permission changes
        result.onchange = () => {
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        };
      }).catch(() => {
        // Permissions API not supported, default to prompt
        setPermissionStatus('prompt');
      });
    } else {
      // Permissions API not available (Safari), default to prompt
      setPermissionStatus('prompt');
    }
  }, [userLocation, setUserLocation]);

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setIsRequestingLocation(true);
    setLocationError(null);
    setPermissionDenied(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsRequestingLocation(false);
        setPermissionDenied(false);
        setPermissionStatus('granted');
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsRequestingLocation(false);

        if (error.code === error.PERMISSION_DENIED) {
          setPermissionDenied(true);
          setPermissionStatus('denied');
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

  useEffect(() => {
    // Only run when we have location AND routes are loaded
    if (!userLocation || loadingState !== 'success' || routes.length === 0) return;
    console.log('[NearbyPage] Effect triggered: updating nearby routes');
    updateNearbyRoutes();
  }, [userLocation, discoveryRange, loadingState, routes.length]); // Removed updateNearbyRoutes from deps - Zustand function is stable

  if (loadingState === 'loading') {
    return <FullPageLoader message={t('fetchingRouteData')} />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader title={t('nearbyRoutes')} />

      <Box sx={{ flex: 1, overflow: 'auto', px: 0 }}>
        {/* Location request in progress */}
        {isRequestingLocation && (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <CircularProgress size={32} />
            <Typography color="text.secondary">{t('findingNearbyRoutes')}</Typography>
          </Box>
        )}

        {/* Location error or permission denied */}
        {locationError && !isRequestingLocation && (
          <Box sx={{ p: 2 }}>
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

        {/* No location yet - show button for Safari compatibility */}
        {!userLocation && !isRequestingLocation && !locationError && permissionStatus !== 'checking' && (
          <Box
            sx={{
              textAlign: 'center',
              py: 10,
              px: 3,
              borderRadius: 3,
              mx: 2,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
            }}
          >
            <LocationOnIcon sx={{ fontSize: 56, color: 'primary.main', mb: 2 }} />
            <Typography variant="titleMedium" gutterBottom>
              {t('locationNeeded')}
            </Typography>
            <Typography variant="bodyMedium" color="text.secondary" sx={{ mb: 3 }}>
              {permissionStatus === 'denied' 
                ? 'Location permission was denied. Please click the button below to request access again, or enable it in your browser settings.'
                : 'Enable location to find nearby bus stops. Safari requires you to click the button below.'}
            </Typography>
            {permissionStatus === 'denied' && (
              <Typography variant="bodySmall" color="text.secondary" sx={{ mb: 2 }}>
                iOS Safari: Settings → Safari → Location Services → Allow
              </Typography>
            )}
            <Button
              variant="contained"
              onClick={requestLocation}
              startIcon={<LocationOnIcon />}
              sx={{ borderRadius: '20px' }}
            >
              {permissionStatus === 'denied' ? 'Request Location Access' : 'Enable Location'}
            </Button>
          </Box>
        )}

        {/* Discovery range banner */}
        {userLocation && !isRequestingLocation && (
          <Box
            sx={{
              mx: 2,
              mt: 1,
              mb: 0.5,
              py: 1,
              px: 2,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
            }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="bodySmall" color="text.secondary">
              {t('showingRoutesWithin', discoveryRange)}
            </Typography>
          </Box>
        )}

        {/* Route list - only routes with valid ETAs */}
        {userLocation && !isRequestingLocation && (
          <Box
            sx={{
              bgcolor: 'background.paper',
              borderRadius: { xs: 0, sm: 2 },
              overflow: 'hidden',
              mx: { xs: 0, sm: 2 },
              mb: 2,
              boxShadow: (theme) =>
                theme.palette.mode === 'light'
                  ? '0 1px 3px rgba(0,0,0,0.06)'
                  : '0 1px 3px rgba(0,0,0,0.2)',
            }}
          >
            {isLoadingNearbyRoutes ? (
              <>
                {[...Array(5)].map((_, i) => (
                  <Box key={i}>
                    {i > 0 && <Divider sx={{ mx: 2 }} />}
                    <NearbyRouteRowSkeleton />
                  </Box>
                ))}
              </>
            ) : processedNearbyRoutes.length > 0 ? (
              <>
                {processedNearbyRoutes.map((processedRoute, index) => (
                  <Box key={processedRoute.route.id}>
                    {index > 0 && <Divider sx={{ mx: 2 }} />}
                    <NearbyRouteRow
                      route={processedRoute.route}
                      nearestStop={processedRoute.nearestStop}
                      etas={processedRoute.etas}
                      distance={processedRoute.distance}
                    />
                  </Box>
                ))}
              </>
            ) : loadingState === 'success' ? (
              <Box sx={{ textAlign: 'center', py: 10, px: 2 }}>
                <MapIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
                <Typography color="text.secondary">{t('noNearbyRoutes')}</Typography>
              </Box>
            ) : null}
          </Box>
        )}
      </Box>
    </Box>
  );
}
