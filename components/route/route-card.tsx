'use client';

import Link from 'next/link';
import {
  Card,
  CardActionArea,
  CardContent,
  Box,
  Typography,
  Skeleton,
  Stack,
  Chip,
} from '@mui/material';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import { Route, getRouteDestination, RouteETA } from '@/lib/types';
import { CompanyBadge } from '@/components/ui/company-badge';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { ETABadge } from '@/components/ui/eta-display';
import { useTranslation } from '@/lib/i18n';
import { useSettingsStore } from '@/lib/stores';

interface RouteCardProps {
  route: Route;
  eta?: RouteETA | null;
  showDistance?: boolean;
  showFavorite?: boolean;
}

export function RouteCard({
  route,
  eta = null,
  showDistance = false,
  showFavorite = true,
}: RouteCardProps) {
  const { t, locale } = useTranslation();
  const useCTBInfo = useSettingsStore(state => state.useCTBInfoForJointRoutes);

  const destination = getRouteDestination(route, locale, useCTBInfo);

  // Format distance
  const distanceText = route.distance
    ? route.distance < 1000
      ? `${Math.round(route.distance)}m`
      : `${(route.distance / 1000).toFixed(1)}km`
    : null;

  return (
    <Card
      sx={{
        mb: 1.5,
        transition: 'all 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 2,
        },
      }}
    >
      <CardActionArea
        component={Link}
        href={`/route/${route.routeNumber}/${route.bound}/${route.serviceType}/${route.company}`}
      >
        <CardContent sx={{ py: 2, px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            {/* Route info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Typography
                  variant="headlineSmall"
                  component="span"
                  sx={{ fontWeight: 700, color: 'text.primary' }}
                >
                  {route.routeNumber}
                </Typography>
                <CompanyBadge company={route.company} />
                {route.serviceType !== '1' && (
                  <Chip
                    label={t('special')}
                    size="small"
                    color="warning"
                    sx={{ height: 20, fontSize: '0.625rem' }}
                  />
                )}
              </Stack>

              <Typography
                variant="bodyMedium"
                color="text.secondary"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('to')} {destination}
              </Typography>

              {showDistance && distanceText && (
                <Typography variant="bodySmall" color="text.disabled" sx={{ mt: 0.5 }}>
                  {distanceText}
                </Typography>
              )}
            </Box>

            {/* Right side - ETA and favorite */}
            <Stack alignItems="flex-end" spacing={1}>
              {eta && <ETABadge eta={eta} />}
              {showFavorite && (
                <FavoriteButton route={route} size="small" />
              )}
            </Stack>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

// Skeleton loader for route cards
export function RouteCardSkeleton() {
  return (
    <Card sx={{ mb: 1.5 }}>
      <CardContent sx={{ py: 2, px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Skeleton variant="text" width={60} height={32} />
              <Skeleton variant="rounded" width={40} height={20} />
            </Stack>
            <Skeleton variant="text" width="70%" height={20} />
          </Box>
          <Stack alignItems="flex-end" spacing={1}>
            <Skeleton variant="rounded" width={50} height={24} />
            <Skeleton variant="circular" width={28} height={28} />
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
