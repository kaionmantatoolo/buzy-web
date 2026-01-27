'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Stack,
  ButtonBase,
  Chip,
  useTheme,
  alpha,
  Divider,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import BackspaceIcon from '@mui/icons-material/Backspace';
import StarIcon from '@mui/icons-material/Star';
import { PageHeader } from '@/components/layout';
import { CompanyBadge } from '@/components/ui';
import { useRouteStore, useFavoritesStore, useSettingsStore } from '@/lib/stores';
import { useTranslation } from '@/lib/i18n';
import { Route, getRouteDestination } from '@/lib/types';

const NUMBER_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['C', '0', '⌫'],
];

export default function SearchPage() {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const keypadRef = useRef<HTMLDivElement>(null);
  const { routes } = useRouteStore();
  const { isFavorite } = useFavoritesStore();
  const useCTBInfo = useSettingsStore((s) => s.useCTBInfoForJointRoutes);
  const [searchText, setSearchText] = useState('');
  const [keypadHeight, setKeypadHeight] = useState(280);

  useEffect(() => {
    const el = keypadRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setKeypadHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const availableAlphabets = useMemo(() => {
    if (searchText === '') {
      const first = new Set(
        routes.map((r) => r.routeNumber.charAt(0).toUpperCase()).filter((c) => /[A-Z]/.test(c))
      );
      const sorted = Array.from(first).sort();
      const h = new Date().getHours();
      if (h >= 23 || h < 6) return ['N', ...sorted.filter((l) => l !== 'N')];
      return sorted;
    }
    const next = new Set(
      routes
        .filter((r) => r.routeNumber.toLowerCase().startsWith(searchText.toLowerCase()))
        .map((r) => {
          if (r.routeNumber.length <= searchText.length) return null;
          const c = r.routeNumber.charAt(searchText.length).toUpperCase();
          return /[A-Z]/.test(c) ? c : null;
        })
        .filter((c): c is string => c != null)
    );
    return Array.from(next).sort();
  }, [routes, searchText]);

  const isNumberEnabled = useCallback(
    (num: string) => {
      if (searchText === '') return true;
      return routes.some((r) => {
        const rn = r.routeNumber.toLowerCase();
        const s = searchText.toLowerCase();
        if (!rn.startsWith(s) || rn.length <= s.length) return false;
        return rn.charAt(s.length) === num;
      });
    },
    [routes, searchText]
  );

  const filteredRoutes = useMemo(() => {
    if (!searchText.trim()) return [];
    return routes
      .filter((r) => r.routeNumber.toLowerCase().startsWith(searchText.toLowerCase()))
      .slice(0, 500);
  }, [routes, searchText]);

  const handleInput = useCallback((char: string) => {
    if (char === 'C') setSearchText('');
    else if (char === '⌫') setSearchText((s) => s.slice(0, -1));
    else setSearchText((s) => s + char);
  }, []);

  const handleClear = useCallback(() => setSearchText(''), []);

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <PageHeader title={t('search')} />

      {/* 1. Scrollable result list only — hkbus-style: this is the ONLY scrolling area */}
      <Box
        sx={{
          flex: '1 1 0',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          bgcolor: 'background.default',
          // Reserve space for fixed keypad (above 80px nav) so last items scroll into view
          paddingBottom: `${keypadHeight}px`,
        }}
      >
        {searchText ? (
          filteredRoutes.length > 0 ? (
            <Paper elevation={0} sx={{ mx: 2, mt: 1.5, mb: 2, overflow: 'hidden', borderRadius: 2 }}>
              {filteredRoutes.map((route, idx) => (
                <Box key={route.id}>
                  {idx > 0 && <Divider />}
                  <RouteListItem
                    route={route}
                    isFavorite={isFavorite(route)}
                    locale={locale}
                    useCTBInfo={useCTBInfo}
                  />
                </Box>
              ))}
            </Paper>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
              <Typography color="text.secondary">{t('noRoutesFor', searchText)}</Typography>
            </Box>
          )
        ) : (
          <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
            <Typography color="text.secondary">{t('searchRoute')}</Typography>
          </Box>
        )}
      </Box>

      {/* 2. Keypad fixed at bottom — never scrolls (hkbus.app style) */}
      <Box
        ref={keypadRef}
        sx={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          // Keep the keypad comfortably above the bottom navigation,
          // accounting for safe‑area insets when installed as a PWA.
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 12px)',
          zIndex: 1000,
          width: '100%',
          maxWidth: 600,
          boxSizing: 'border-box',
          px: 2,
          pt: 1.25,
          pb: 'max(12px, env(safe-area-inset-bottom, 0px))',
          // Make the keypad look like a single floating card with
          // clean rounded frame instead of a hard edge.
          borderRadius: 3,
          bgcolor: 'background.paper',
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? '0 8px 20px rgba(0,0,0,0.18)'
              : '0 8px 24px rgba(0,0,0,0.6)',
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Stack spacing={1.25}>
          {/* Search bar */}
          <Paper
            elevation={0}
            sx={{
              px: 1.25,
              py: 1.25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
              borderRadius: 2.5,
            }}
          >
            <Typography
              variant="headlineSmall"
              sx={{
                fontWeight: 600,
                color: searchText ? 'text.primary' : 'text.disabled',
                minHeight: 32,
              }}
            >
              {searchText || t('searchRoute')}
            </Typography>
            {searchText && (
              <IconButton onClick={handleClear} size="small" sx={{ color: 'text.secondary' }}>
                <ClearIcon />
              </IconButton>
            )}
          </Paper>

          {/* Number pad + alphabet column */}
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Paper
              elevation={1}
              sx={{
                flex: 1,
                p: 1.25,
                bgcolor: 'surfaceVariant.main',
                borderRadius: 4,
              }}
            >
              <Stack spacing={1.25}>
                {NUMBER_ROWS.map((row, ri) => (
                  <Stack key={ri} direction="row" spacing={1.25}>
                    {row.map((char) => {
                      const disabled =
                        (char === '⌫' && !searchText) ||
                        (char === 'C' && !searchText) ||
                        (/[0-9]/.test(char) && !isNumberEnabled(char));
                      const special = char === 'C' || char === '⌫';
                      return (
                        <ButtonBase
                          key={char}
                          onClick={() => handleInput(char)}
                          disabled={disabled}
                          sx={{
                            flex: 1,
                            height: 56,
                            borderRadius: 2,
                            bgcolor: special
                              ? alpha(theme.palette.error.main, 0.12)
                              : 'background.paper',
                            color: disabled
                              ? 'text.disabled'
                              : special
                                ? 'error.main'
                                : 'text.primary',
                            fontSize: char === '⌫' ? '1.25rem' : '1.375rem',
                            fontWeight: 600,
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            '&:hover:not(:disabled)': {
                              bgcolor: special
                                ? alpha(theme.palette.error.main, 0.16)
                                : alpha(theme.palette.primary.main, 0.08),
                              transform: 'translateY(-1px)',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            },
                            '&:active:not(:disabled)': { transform: 'scale(0.96)' },
                          }}
                        >
                          {char === '⌫' ? <BackspaceIcon /> : char}
                        </ButtonBase>
                      );
                    })}
                  </Stack>
                ))}
              </Stack>
            </Paper>

            <Paper
              elevation={1}
              sx={{
                width: 56,
                p: 1.25,
                bgcolor: 'surfaceVariant.main',
                borderRadius: 4,
                height: 4 * 56 + 3 * 5,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.25,
                }}
              >
                {availableAlphabets.length > 0 ? (
                  availableAlphabets.map((letter) => (
                    <ButtonBase
                      key={letter}
                      onClick={() => handleInput(letter)}
                      sx={{
                        height: 36,
                        minHeight: 36,
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                        color: 'primary.main',
                        fontSize: '1rem',
                        fontWeight: 700,
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.12),
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        },
                        '&:active': { transform: 'scale(0.96)' },
                      }}
                    >
                      {letter}
                    </ButtonBase>
                  ))
                ) : (
                  <Box
                    sx={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'text.disabled',
                    }}
                  >
                    –
                  </Box>
                )}
              </Box>
            </Paper>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

interface RouteListItemProps {
  route: Route;
  isFavorite: boolean;
  locale: string;
  useCTBInfo: boolean;
}

function RouteListItem({ route, isFavorite: isFav, locale, useCTBInfo }: RouteListItemProps) {
  const { t } = useTranslation();
  const destination = getRouteDestination(route, locale, useCTBInfo);

  return (
    <ButtonBase
      component={Link}
      href={`/route/${route.routeNumber}/${route.bound}/${route.serviceType}/${route.company}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        py: 1.5,
        px: 2,
        textAlign: 'left',
        color: 'inherit',
        '&:hover': { bgcolor: 'action.hover' },
        '&:active': { bgcolor: 'action.selected' },
      }}
    >
      <Typography variant="titleLarge" sx={{ fontWeight: 700, minWidth: 80, color: 'primary.main' }}>
        {route.routeNumber}
      </Typography>
      <Box sx={{ flex: 1 }} />
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography
          variant="bodyMedium"
          color="text.secondary"
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {t('to')} {destination}
        </Typography>
        <CompanyBadge company={route.company} size="small" />
        {route.serviceType !== '1' && (
          <Chip
            label={t('special')}
            size="small"
            color="warning"
            sx={{ height: 20, fontSize: '0.625rem' }}
          />
        )}
        {isFav && <StarIcon sx={{ color: 'warning.main', fontSize: 20 }} />}
      </Stack>
    </ButtonBase>
  );
}
