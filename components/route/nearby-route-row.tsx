'use client';

import Link from 'next/link';
import { Box, Typography, Stack, Skeleton } from '@mui/material';
import { Route, StopDetail, RouteETA, getRouteDestination, getStopName, formatETA } from '@/lib/types';
import { CompanyBadge } from '@/components/ui';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { useTranslation } from '@/lib/i18n';
import { useSettingsStore } from '@/lib/stores';

interface NearbyRouteRowProps {
  route: Route;
  nearestStop: StopDetail;
  etas: RouteETA[];
  distance: number;
}

export function NearbyRouteRow({ route, nearestStop, etas, distance }: NearbyRouteRowProps) {
  const { t, locale } = useTranslation();
  const useCTBInfo = useSettingsStore(state => state.useCTBInfoForJointRoutes);
  const destination = getRouteDestination(route, locale, useCTBInfo);
  const stopName = getStopName(nearestStop, locale, useCTBInfo);

  // Get the first valid ETA
  const firstETA = etas.length > 0 ? etas[0] : null;
  const etaText = firstETA?.eta 
    ? formatETA(firstETA.eta, locale)
    : null;

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
        <Typography variant="bodySmall" color="text.secondary" sx={{ mb: 0.25 }}>
          {stopName}
        </Typography>
        <Typography variant="bodySmall" color="text.secondary">
          {distanceText}
        </Typography>
      </Box>

      {/* ETA display - matches iOS */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 70, flexShrink: 0 }}>
        {etaText ? (
          <>
            <Typography
              variant="titleLarge"
              sx={{
                fontWeight: 700,
                fontSize: '1.25rem',
                color: 'text.primary',
              }}
            >
              {etaText}
            </Typography>
            <Typography variant="bodySmall" color="text.secondary">
              {t('min')}
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
      <Skeleton variant="rounded" width={50} height={40} />
    </Box>
  );
}
