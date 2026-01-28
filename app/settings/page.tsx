'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Switch,
  Chip,
  Stack,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Divider,
} from '@mui/material';
import { PageHeader } from '@/components/layout';
import { useSettingsStore, useFavoritesStore, useRouteStore } from '@/lib/stores';
import { clearRoutesCache, getLastUpdateTime } from '@/lib/services';
import { useTranslation } from '@/lib/i18n';
import {
  NEARBY_ROUTES_CACHE_KEY,
  NEARBY_ROUTES_CACHE_TIMESTAMP_KEY,
  USER_LOCATION_CACHE_KEY,
  USER_LOCATION_CACHE_TIMESTAMP_KEY,
} from '@/lib/cache/cache-keys';

const DISCOVERY_RANGES = [300, 500, 800, 1000, 1500];

export default function SettingsPage() {
  const { t } = useTranslation();
  const {
    discoveryRange,
    useCTBInfoForJointRoutes,
    locale,
    debugUseMockLocation,
    debugMockLat,
    debugMockLng,
    setDiscoveryRange,
    setUseCTBInfo,
    setLocale,
    setDebugUseMockLocation,
    setDebugMockLocation,
  } = useSettingsStore();
  const { clearAllFavorites, favorites } = useFavoritesStore();
  const { loadRoutes, loadingState, lastRoutesUpdatedAt } = useRouteStore((state) => ({
    loadRoutes: state.loadRoutes,
    loadingState: state.loadingState,
    lastRoutesUpdatedAt: state.lastRoutesUpdatedAt,
  }));

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showRemoveFavConfirm, setShowRemoveFavConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [debugLatInput, setDebugLatInput] = useState(String(debugMockLat));
  const [debugLngInput, setDebugLngInput] = useState(String(debugMockLng));

  // Prefer the in-memory "last downloaded" timestamp (reliable for first launch),
  // then fall back to localStorage timestamp if available.
  const lastUpdate =
    lastRoutesUpdatedAt != null
      ? new Date(lastRoutesUpdatedAt)
      : getLastUpdateTime();
  const lastUpdateStr =
    loadingState === 'loading'
      ? t('fetchingRouteData')
      : lastUpdate
        ? lastUpdate.toLocaleDateString() + ' ' + lastUpdate.toLocaleTimeString()
        : t('never');

  const clearClientSideCaches = () => {
    // Keep these keys in sync with `app/page.tsx` caching.
    try {
      sessionStorage.removeItem(NEARBY_ROUTES_CACHE_KEY);
      sessionStorage.removeItem(NEARBY_ROUTES_CACHE_TIMESTAMP_KEY);
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem(USER_LOCATION_CACHE_KEY);
      localStorage.removeItem(USER_LOCATION_CACHE_TIMESTAMP_KEY);
    } catch {
      // ignore
    }
  };

  // Handle cache clear
  const handleClearCache = async () => {
    setIsUpdating(true);
    clearRoutesCache();
    clearClientSideCaches();
    setShowClearConfirm(false);
    await loadRoutes(true);
    setIsUpdating(false);
  };

  // Handle update database
  const handleUpdateDatabase = async () => {
    setIsUpdating(true);
    clearRoutesCache();
    clearClientSideCaches();
    await loadRoutes(true);
    setIsUpdating(false);
  };

  // Handle clear favorites
  const handleClearFavorites = () => {
    clearAllFavorites();
    setShowRemoveFavConfirm(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title={t('settings')} />

      <Box sx={{ p: 2 }}>
        {/* App Settings Section */}
        <Typography
          variant="labelLarge"
          color="text.secondary"
          sx={{ px: 1, mb: 1, textTransform: 'uppercase', letterSpacing: 1 }}
        >
          {t('appSettings')}
        </Typography>

        <Paper sx={{ mb: 3 }}>
          <List disablePadding>
            {/* Discovery Range */}
            <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2 }}>
              <ListItemText
                primary={t('discoveryRange')}
                sx={{ mb: 1 }}
              />
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {DISCOVERY_RANGES.map(range => (
                  <Chip
                    key={range}
                    label={`${range}m`}
                    onClick={() => setDiscoveryRange(range)}
                    color={discoveryRange === range ? 'primary' : 'default'}
                    variant={discoveryRange === range ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>
            </ListItem>

            <Divider />

            {/* Joint Route Display */}
            <ListItem>
              <ListItemText
                primary={t('jointRouteDisplay')}
                secondary={t('useCTBInfo')}
              />
              <Switch
                edge="end"
                checked={useCTBInfoForJointRoutes}
                onChange={(e) => setUseCTBInfo(e.target.checked)}
              />
            </ListItem>

            <Divider />

            {/* Language */}
            <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2 }}>
              <ListItemText
                primary={t('language')}
                sx={{ mb: 1 }}
              />
              <Stack direction="row" spacing={1}>
                <Chip
                  label="English"
                  onClick={() => setLocale('en')}
                  color={locale === 'en' ? 'primary' : 'default'}
                  variant={locale === 'en' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="繁體中文"
                  onClick={() => setLocale('zh-Hant')}
                  color={locale === 'zh-Hant' ? 'primary' : 'default'}
                  variant={locale === 'zh-Hant' ? 'filled' : 'outlined'}
                />
              </Stack>
            </ListItem>
          </List>
        </Paper>

        {/* Debug Section */}
        <Typography
          variant="labelLarge"
          color="text.secondary"
          sx={{ px: 1, mb: 1, textTransform: 'uppercase', letterSpacing: 1 }}
        >
          Debug
        </Typography>

        <Paper sx={{ mb: 3 }}>
          <List disablePadding>
            <ListItem>
              <ListItemText
                primary="Use mock location"
                secondary="For testing in Cursor/desktop browsers (bypasses geolocation permission)"
              />
              <Switch
                edge="end"
                checked={debugUseMockLocation}
                onChange={(e) => setDebugUseMockLocation(e.target.checked)}
              />
            </ListItem>

            <Divider />

            <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
              <ListItemText
                primary="Mock location (lat/lng)"
                secondary="Example: 22.279370, 114.178321"
                sx={{ mb: 1 }}
              />
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Lat"
                  value={debugLatInput}
                  onChange={(e) => setDebugLatInput(e.target.value)}
                  size="small"
                  fullWidth
                  inputProps={{ inputMode: 'decimal' }}
                />
                <TextField
                  label="Lng"
                  value={debugLngInput}
                  onChange={(e) => setDebugLngInput(e.target.value)}
                  size="small"
                  fullWidth
                  inputProps={{ inputMode: 'decimal' }}
                />
              </Stack>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setDebugLatInput('22.279370');
                    setDebugLngInput('114.178321');
                    setDebugUseMockLocation(true);
                    setDebugMockLocation(22.27937, 114.178321);
                  }}
                >
                  Use provided test location
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    const lat = Number(debugLatInput);
                    const lng = Number(debugLngInput);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                    setDebugMockLocation(lat, lng);
                  }}
                >
                  Apply
                </Button>
              </Box>
            </ListItem>
          </List>
        </Paper>

        {/* Data Management Section */}
        <Typography
          variant="labelLarge"
          color="text.secondary"
          sx={{ px: 1, mb: 1, textTransform: 'uppercase', letterSpacing: 1 }}
        >
          {t('dataManagement')}
        </Typography>

        <Paper sx={{ mb: 3 }}>
          <List disablePadding>
            {/* Last Updated */}
            <ListItem>
              <ListItemText
                primary={t('lastUpdated')}
                secondary={lastUpdateStr}
              />
            </ListItem>

            <Divider />

            {/* Update Database */}
            <ListItemButton onClick={handleUpdateDatabase} disabled={isUpdating}>
              <ListItemText
                primary={isUpdating ? t('fetchingRouteData') : t('updateBusRoutes')}
                primaryTypographyProps={{ color: 'primary' }}
              />
            </ListItemButton>

            <Divider />

            {/* Clear Cache */}
            <ListItemButton onClick={() => setShowClearConfirm(true)}>
              <ListItemText
                primary={t('clearAllCachedData')}
                primaryTypographyProps={{ color: 'error' }}
              />
            </ListItemButton>

            <Divider />

            {/* Remove Favorites */}
            <ListItemButton
              onClick={() => setShowRemoveFavConfirm(true)}
              disabled={favorites.length === 0}
            >
              <ListItemText
                primary={`${t('removeAllFavorites')} (${favorites.length})`}
                primaryTypographyProps={{
                  color: favorites.length === 0 ? 'text.disabled' : 'error',
                }}
              />
            </ListItemButton>
          </List>
        </Paper>

        {/* About Section */}
        <Typography
          variant="labelLarge"
          color="text.secondary"
          sx={{ px: 1, mb: 1, textTransform: 'uppercase', letterSpacing: 1 }}
        >
          {t('about')}
        </Typography>

        <Paper>
          <List disablePadding>
            <ListItem>
              <ListItemText
                primary={t('version')}
                secondary="1.0.0 (Web)"
              />
            </ListItem>
          </List>
        </Paper>
      </Box>

      {/* Confirmation Dialogs */}
      <Dialog open={showClearConfirm} onClose={() => setShowClearConfirm(false)}>
        <DialogTitle>{t('clearAllCachedData')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('clearCacheConfirm')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowClearConfirm(false)}>{t('cancel')}</Button>
          <Button onClick={handleClearCache} color="error">{t('clear')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showRemoveFavConfirm} onClose={() => setShowRemoveFavConfirm(false)}>
        <DialogTitle>{t('removeAllFavorites')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('removeAllFavoritesConfirm')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRemoveFavConfirm(false)}>{t('cancel')}</Button>
          <Button onClick={handleClearFavorites} color="error">{t('clear')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
