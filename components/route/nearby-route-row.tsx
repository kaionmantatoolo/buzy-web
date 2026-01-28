'use client';

import Link from 'next/link';
import { Box, Typography, Stack, Skeleton } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { Route, StopDetail, RouteETA, getRouteDestination, getStopName, minutesUntilETA, isUpcomingETA } from '@/lib/types';
import { CompanyBadge } from '@/components/ui';
import { useTranslation } from '@/lib/i18n';
import { useFavoritesStore, useSettingsStore } from '@/lib/stores';

interface NearbyRouteRowProps {
  route: Route;
  nearestStop: StopDetail;
  etas: RouteETA[];
  distance: number;
}

export function NearbyRouteRow({ route, nearestStop, etas, distance }: NearbyRouteRowProps) {
  const { t, locale } = useTranslation();
  const useCTBInfo = useSettingsStore(state => state.useCTBInfoForJointRoutes);
  const isFavorite = useFavoritesStore((s) => s.isFavorite(route));
  const destination = getRouteDestination(route, locale, useCTBInfo);
  const stopName = getStopName(nearestStop, locale, useCTBInfo);

  // iOS-style: show minutes only (Arriving -> 0, never show Departed)
  const firstETA = etas.find((e) => isUpcomingETA(e.eta)) ?? null;
  const etaMinutes = minutesUntilETA(firstETA?.eta ?? null);

  const distanceText = distance < 1000
    ? `${Math.round(distance)}m`
    : `${(distance / 1000).toFixed(1)}km`;

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
      {/* Route number */}
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

      {/* Destination + stop name + badges */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 0.25, minWidth: 0 }}>
          <Typography
            variant="bodyMedium"
            sx={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'text.primary',
              minWidth: 0,
            }}
          >
            {t('to')} {destination}
          </Typography>
          <CompanyBadge company={route.company} size="small" />
          {isFavorite && (
            <StarIcon sx={{ fontSize: 16, color: 'warning.main', ml: 0.25 }} />
          )}
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
        <Typography variant="bodySmall" color="text.secondary" sx={{ mb: 0.25 }} noWrap>
          {stopName}
        </Typography>
        <Typography variant="bodySmall" color="text.secondary" noWrap>
          {distanceText}
        </Typography>
      </Box>

      {/* ETA display - iOS-style minutes only */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: 72, flexShrink: 0 }}>
        {etaMinutes != null ? (
          <>
            <Typography
              variant="titleLarge"
              sx={{
                fontWeight: 700,
                fontSize: '1.25rem',
                color: 'text.primary',
                lineHeight: 1.1,
              }}
            >
              {etaMinutes}
            </Typography>
            <Typography variant="bodySmall" color="text.secondary">
              {locale.startsWith('zh') ? '分鐘' : 'min'}
            </Typography>
          </>
        ) : (
          <Typography
            variant="titleLarge"
            sx={{
              fontWeight: 700,
              fontSize: '1.25rem',
              color: 'text.secondary',
            }}
          >
            {t('na')}
          </Typography>
        )}
      </Box>
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
      <Skeleton variant="rounded" width={50} height={40} />
    </Box>
  );
}
