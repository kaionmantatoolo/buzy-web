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

const DISCOVERY_RANGES = [300, 500, 800, 1000, 1500];

export default function SettingsPage() {
  const { t } = useTranslation();
  const {
    discoveryRange,
    useCTBInfoForJointRoutes,
    locale,
    setDiscoveryRange,
    setUseCTBInfo,
    setLocale,
  } = useSettingsStore();
  const { clearAllFavorites, favorites } = useFavoritesStore();
  const loadRoutes = useRouteStore(state => state.loadRoutes);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showRemoveFavConfirm, setShowRemoveFavConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const lastUpdate = getLastUpdateTime();
  const lastUpdateStr = lastUpdate
    ? lastUpdate.toLocaleDateString() + ' ' + lastUpdate.toLocaleTimeString()
    : t('never');

  // Handle cache clear
  const handleClearCache = () => {
    clearRoutesCache();
    setShowClearConfirm(false);
    loadRoutes(true);
  };

  // Handle update database
  const handleUpdateDatabase = async () => {
    setIsUpdating(true);
    clearRoutesCache();
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
