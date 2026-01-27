'use client';

import { useMemo } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { PageHeader } from '@/components/layout';
import { RouteCard } from '@/components/route';
import { useRouteStore, useFavoritesStore, getFavoriteRoutes } from '@/lib/stores';
import { useTranslation } from '@/lib/i18n';

export default function FavoritesPage() {
  const { t } = useTranslation();
  const routes = useRouteStore(state => state.routes);
  const { favorites } = useFavoritesStore();

  // Get full route objects for favorites
  const favoriteRoutes = useMemo(() => {
    return getFavoriteRoutes(routes, favorites);
  }, [routes, favorites]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title={t('favorites')} />

      <Box sx={{ p: 2, flex: 1 }}>
        {favoriteRoutes.length > 0 ? (
          <Stack spacing={0}>
            {favoriteRoutes.map(route => (
              <RouteCard
                key={route.id}
                route={route}
                showFavorite
              />
            ))}
          </Stack>
        ) : (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <FavoriteBorderIcon
              sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }}
            />
            <Typography variant="titleLarge" color="text.secondary" gutterBottom>
              {t('noFavoriteRoutes')}
            </Typography>
            <Typography variant="bodyMedium" color="text.disabled">
              Tap the heart icon on a route to add it here
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
