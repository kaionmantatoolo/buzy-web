'use client';

import Link from 'next/link';
import { Box, Typography, Stack, Skeleton } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { Route, getRouteDestination } from '@/lib/types';
import { CompanyBadge } from '@/components/ui';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { useTranslation } from '@/lib/i18n';
import { useSettingsStore } from '@/lib/stores';

interface NearbyRouteRowProps {
  route: Route;
}

export function NearbyRouteRow({ route }: NearbyRouteRowProps) {
  const { t, locale } = useTranslation();
  const useCTBInfo = useSettingsStore(state => state.useCTBInfoForJointRoutes);
  const destination = getRouteDestination(route, locale, useCTBInfo);

  const distanceText = route.distance
    ? route.distance < 1000
      ? `${Math.round(route.distance)}m`
      : `${(route.distance / 1000).toFixed(1)}km`
    : null;

  return (
    <Box
      component={Link}
      href={`/route/${route.routeNumber}/${route.bound}/${route.serviceType}/${route.company}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        py: 1.5,
        px: 2,
        textDecoration: 'none',
        color: 'inherit',
        bgcolor: 'background.paper',
        transition: 'background-color 0.2s',
        '&:hover': { bgcolor: 'action.hover' },
        '&:active': { bgcolor: 'action.selected' },
      }}
    >
      {/* Route number - iOS blue */}
      <Typography
        variant="titleLarge"
        sx={{
          fontWeight: 700,
          fontSize: '1.25rem',
          color: 'primary.main',
          lineHeight: 1.2,
          width: 72,
          flexShrink: 0,
        }}
      >
        {route.routeNumber}
      </Typography>

      {/* Destination + distance + badges */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 0.25 }}>
          <Typography
            variant="bodyMedium"
            sx={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'text.primary',
            }}
          >
            {t('to')} {destination}
          </Typography>
          <CompanyBadge company={route.company} size="small" />
          {route.serviceType !== '1' && (
            <Typography
              component="span"
              variant="labelSmall"
              sx={{
                px: 0.5,
                py: 0.25,
                borderRadius: 1,
                bgcolor: 'warning.main',
                color: 'warning.contrastText',
                fontWeight: 500,
              }}
            >
              {t('special')}
            </Typography>
          )}
        </Stack>
        {distanceText && (
          <Typography variant="bodySmall" color="text.secondary">
            {distanceText}
          </Typography>
        )}
      </Box>

      <FavoriteButton route={route} size="small" />
    </Box>
  );
}

export function NearbyRouteRowSkeleton() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, px: 2 }}>
      <Skeleton variant="rounded" width={72} height={36} sx={{ flexShrink: 0 }} />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="60%" height={20} sx={{ mb: 0.5 }} />
        <Skeleton variant="text" width={48} height={16} />
      </Box>
    </Box>
  );
}
