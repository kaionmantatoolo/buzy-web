'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Divider,
  alpha,
  IconButton,
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import MapIcon from '@mui/icons-material/Map';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { PageHeader } from '@/components/layout';
import { NearbyRouteRow, NearbyRouteRowSkeleton } from '@/components/route';
import { FullPageLoader } from '@/components/ui';
import { useRouteStore, useSettingsStore } from '@/lib/stores';
import { useTranslation } from '@/lib/i18n';
import { log } from '@/lib/logger';

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
  const [cachedRoutes, setCachedRoutes] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<string>('');

  const isBrowser = typeof window !== 'undefined';
  const CACHE_KEY = 'nearby_routes_cache';
  const CACHE_TIMESTAMP_KEY = 'nearby_routes_cache_timestamp';
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const LOCATION_CACHE_KEY = 'user_location_cache';
  const LOCATION_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  // Check permission status and load cached data, then auto-request location if permission already granted
  useEffect(() => {
    if (!isBrowser) return;

    // Load cached data on mount
    try {
      const cachedData = sessionStorage.getItem(CACHE_KEY);
      const cachedTimestamp = sessionStorage.getItem(CACHE_TIMESTAMP_KEY);

      if (cachedData && cachedTimestamp) {
        const timestamp = parseInt(cachedTimestamp, 10);
        const now = Date.now();

        // Check if cache is still valid (within 5 minutes)
        if (now - timestamp < CACHE_DURATION) {
          const routes = JSON.parse(cachedData);
          setCachedRoutes(routes);
          setLastRefreshTime(new Date(timestamp).toLocaleTimeString());
        } else {
          // Clear expired cache
          sessionStorage.removeItem(CACHE_KEY);
          sessionStorage.removeItem(CACHE_TIMESTAMP_KEY);
        }
      }
    } catch (error) {
      console.error('Error loading cached data:', error);
    }

    const hasGeolocation = 'geolocation' in navigator;

    if (!hasGeolocation) {
      setPermissionStatus('denied');
      return;
    }

    // Check for cached location
    try {
      const cachedLocation = localStorage.getItem(LOCATION_CACHE_KEY);
      const cachedLocationTimestamp = localStorage.getItem(`${LOCATION_CACHE_KEY}_timestamp`);

      if (cachedLocation && cachedLocationTimestamp) {
        const timestamp = parseInt(cachedLocationTimestamp, 10);
        const now = Date.now();

        // Check if location cache is still valid (within 30 minutes)
        if (now - timestamp < LOCATION_CACHE_DURATION) {
          const location = JSON.parse(cachedLocation);
          // Set location without requesting permission if we have recent cached location
          setUserLocation(location);
        }
      }
    } catch (error) {
      console.error('Error loading cached location:', error);
    }

    // Check permission status
    const geo = navigator.geolocation;

    // Detect if this is a mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Use Permissions API if available (Chrome, Firefox, but not Safari)
    if ('permissions' in navigator && !isMobile) {
      // Only use Permissions API on desktop for better mobile performance
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');

        // If permission is already granted, try to get location automatically
        if (result.state === 'granted' && !userLocation) {
          // Try to get location silently first
          geo.getCurrentPosition(
            (position) => {
              const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              setUserLocation(location);

              // Cache the location
              try {
                localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(location));
                localStorage.setItem(`${LOCATION_CACHE_KEY}_timestamp`, Date.now().toString());
              } catch (error) {
                console.error('Error caching location:', error);
              }
            },
            (error) => {
              log.debug('Silent location fetch failed:', error);
            },
            { enableHighAccuracy: false, timeout: 3000, maximumAge: 300000 } // Lower timeout and accuracy for mobile
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
      // Simplified approach for mobile devices and Safari
      if (userLocation) {
        setPermissionStatus('granted');
      } else {
        // Check if we have cached location
        try {
          const cachedLocation = localStorage.getItem(LOCATION_CACHE_KEY);
          if (cachedLocation) {
            const location = JSON.parse(cachedLocation);
            setUserLocation(location);
            setPermissionStatus('granted');
          } else {
            setPermissionStatus('prompt');
          }
        } catch (error) {
          console.error('Error loading cached location:', error);
          setPermissionStatus('prompt');
        }
      }
    }
  }, [userLocation, setUserLocation]);


  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    log.debug('[Location] Requesting location with user gesture');
    setIsRequestingLocation(true);
    setLocationError(null);
    setPermissionDenied(false);

    // Check if we're on HTTPS (required for Safari)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.warn('[Location] Not on HTTPS - Safari may block location requests');
    }

    // Use lower accuracy for mobile devices to improve performance
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const enableHighAccuracy = !isMobile; // Disable high accuracy on mobile for better performance

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setUserLocation(location);
        setIsRequestingLocation(false);
        setPermissionDenied(false);
        setPermissionStatus('granted');

        // Cache the location
        if (isBrowser) {
          try {
            localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(location));
            localStorage.setItem(`${LOCATION_CACHE_KEY}_timestamp`, Date.now().toString());
          } catch (error) {
            console.error('Error caching location:', error);
          }
        }
      },
      (error) => {
        console.error('[Location] Geolocation error:', error);
        console.error('[Location] Error code:', error.code);
        console.error('[Location] Error message:', error.message);
        setIsRequestingLocation(false);

        if (error.code === error.PERMISSION_DENIED) {
          setPermissionDenied(true);
          setPermissionStatus('denied');
          const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
          const instructions = isSafari
            ? 'In Safari: Tap the address bar → tap the location icon → set to "Allow". Or go to Settings → Safari → Location Services → Allow.'
            : 'Please enable location permission in your browser settings.';
          setLocationError(`Location permission denied. ${instructions}`);
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError('Location unavailable. Please ensure location services are enabled on your device.');
        } else if (error.code === error.TIMEOUT) {
          setLocationError('Location request timed out. Please try again.');
        } else {
          setLocationError(`Location error: ${error.message || 'Unknown error'}`);
        }
      },
      {
        enableHighAccuracy: enableHighAccuracy,
        timeout: 10000, // Reduced timeout for better responsiveness
        maximumAge: 300000, // 5 minutes
      }
    );
  }, [setUserLocation, isBrowser]);

  const handleRefresh = useCallback(() => {
    if (userLocation) {
      setIsRefreshing(true);

      // Clear cache timestamp to force fresh data
      try {
        sessionStorage.removeItem(CACHE_TIMESTAMP_KEY);
      } catch (error) {
        console.error('Error clearing cache timestamp:', error);
      }

      updateNearbyRoutes().then(() => {
        // Save to cache after successful update
        if (isBrowser) {
          try {
            // Get fresh data from store after update
            const freshProcessedRoutes = useRouteStore.getState().processedNearbyRoutes;
            if (freshProcessedRoutes.length > 0) {
              sessionStorage.setItem(CACHE_KEY, JSON.stringify(freshProcessedRoutes));
              sessionStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
              setLastRefreshTime(new Date().toLocaleTimeString());
            }
          } catch (error) {
            console.error('Error saving to cache:', error);
          }
        }
        setIsRefreshing(false);
      }).catch((error) => {
        console.error('[NearbyPage] Error during refresh:', error);
        setIsRefreshing(false);

        // Show error to user
        setLocationError('Failed to refresh nearby routes. Please try again.');
        setTimeout(() => {
          setLocationError(null);
        }, 3000);
      });
    }
  }, [userLocation, updateNearbyRoutes, isBrowser]);

  useEffect(() => {
    // Only run when we have location AND routes are loaded AND we haven't already processed routes
    if (!userLocation || loadingState !== 'success' || routes.length === 0) return;

    // Check if we already have processed nearby routes to avoid infinite loop
    if (processedNearbyRoutes.length > 0 && !isRefreshing) return;

    log.debug('[NearbyPage] Effect triggered: updating nearby routes');

    // If we're not refreshing and have cached data, use it temporarily
    if (!isRefreshing && cachedRoutes.length > 0) {
      // Use cached data temporarily while fetching fresh data
    }

    // Add a small delay to prevent blocking the UI on mobile
    const timer = setTimeout(() => {
      updateNearbyRoutes().then(() => {
        // Save to cache after successful update
        if (isBrowser) {
          try {
            // Get fresh data from store after update
            const freshProcessedRoutes = useRouteStore.getState().processedNearbyRoutes;
            if (freshProcessedRoutes.length > 0) {
              sessionStorage.setItem(CACHE_KEY, JSON.stringify(freshProcessedRoutes));
              sessionStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
              setLastRefreshTime(new Date().toLocaleTimeString());
            }
          } catch (error) {
            console.error('Error saving to cache:', error);
          }
        }
        setIsRefreshing(false);
      }).catch((error) => {
        console.error('[NearbyPage] Error updating nearby routes:', error);
        setIsRefreshing(false);
      });
    }, 100); // Small delay to allow UI to update

    return () => clearTimeout(timer);
  }, [userLocation, loadingState, routes.length, processedNearbyRoutes.length, isRefreshing, isBrowser]); // Removed updateNearbyRoutes from deps - Zustand function is stable

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
                <>
                  <Typography variant="bodySmall" color="text.secondary" sx={{ mb: 1 }}>
                    On iOS Safari: Settings → Safari → Location Services → Allow
                  </Typography>
                  <Typography variant="bodySmall" color="text.secondary">
                    After enabling in settings, return here and click the button below to request location access.
                  </Typography>
                </>
              )}
            </Alert>
            <Button
              variant="contained"
              fullWidth
              onClick={(e) => {
                // Ensure this is a direct user gesture (Safari requirement)
                e.preventDefault();
                e.stopPropagation();
                requestLocation();
              }}
              startIcon={<LocationOnIcon />}
              sx={{ mt: 1 }}
            >
              {permissionDenied ? 'Request Location Access' : t('tryAgain')}
            </Button>
            {permissionDenied && (
              <Button
                variant="outlined"
                fullWidth
                onClick={() => window.location.reload()}
                sx={{ mt: 1 }}
              >
                Refresh Page (After Enabling in Settings)
              </Button>
            )}
          </Box>
        )}

        {/* No location yet - show button for Safari compatibility */}
        {!userLocation && !isRequestingLocation && !locationError && permissionStatus !== 'checking' && (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              px: 3,
              mx: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '60vh',
            }}
          >
            <Box
              sx={{
                p: 3,
                borderRadius: 3,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                mb: 3,
              }}
            >
              <LocationOnIcon sx={{ fontSize: 56, color: 'primary.main' }} />
            </Box>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              {t('locationNeeded')}
            </Typography>
            <Typography variant="bodyMedium" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
              {permissionStatus === 'denied'
                ? 'Location permission was denied. Please enable it in your browser settings.'
                : 'Enable location to find nearby bus stops.'}
            </Typography>
            {permissionStatus === 'denied' && (
              <Typography variant="bodySmall" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                iOS Safari: Settings → Safari → Location Services → Allow
              </Typography>
            )}
            <Button
              variant="contained"
              onClick={requestLocation}
              startIcon={<LocationOnIcon />}
              size="large"
              sx={{
                borderRadius: '28px',
                px: 4,
                py: 1.5,
                boxShadow: 2,
                '&:hover': {
                  boxShadow: 4,
                }
              }}
            >
              {permissionStatus === 'denied' ? 'Request Location Access' : 'Enable Location'}
            </Button>
          </Box>
        )}

        {/* Discovery range banner with refresh info */}
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
              justifyContent: 'space-between',
              gap: 1,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="bodySmall" color="text.secondary">
                {t('showingRoutesWithin', discoveryRange)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {lastRefreshTime && (
                <Typography variant="caption" color="text.secondary">
                  Updated: {lastRefreshTime}
                </Typography>
              )}
              <IconButton
                size="small"
                onClick={handleRefresh}
                disabled={isRefreshing}
                sx={{
                  p: 0.5,
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                  }
                }}
              >
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
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
            {(isLoadingNearbyRoutes && !isRefreshing) || (isRefreshing && cachedRoutes.length === 0) ? (
              <>
                {[...Array(5)].map((_, i) => (
                  <Box key={i}>
                    {i > 0 && <Divider sx={{ mx: 2 }} />}
                    <NearbyRouteRowSkeleton />
                  </Box>
                ))}
              </>
            ) : (isRefreshing && cachedRoutes.length > 0) || processedNearbyRoutes.length > 0 ? (
              <>
                {(isRefreshing ? cachedRoutes : processedNearbyRoutes).map((processedRoute: any, index: number) => (
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
                <Box
                  sx={{
                    p: 2,
                    borderRadius: '50%',
                    bgcolor: (theme) => alpha(theme.palette.text.disabled, 0.08),
                    display: 'inline-flex',
                    mb: 2,
                  }}
                >
                  <MapIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                </Box>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  No Nearby Routes
                </Typography>
                <Typography variant="bodyMedium" color="text.secondary">
                  {t('noNearbyRoutes')}
                </Typography>
              </Box>
            ) : null}
          </Box>
        )}
      </Box>
    </Box>
  );
}
