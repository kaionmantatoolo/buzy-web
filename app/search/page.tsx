'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Stack,
  ButtonBase,
  List,
  ListItem,
  ListItemButton,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import BackspaceIcon from '@mui/icons-material/Backspace';
import StarIcon from '@mui/icons-material/Star';
import { PageHeader } from '@/components/layout';
import { CompanyBadge } from '@/components/ui';
import { useRouteStore, useFavoritesStore, useSettingsStore } from '@/lib/stores';
import { useTranslation } from '@/lib/i18n';
import { Route, getRouteDestination } from '@/lib/types';

// Number keypad configuration
const numberRows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['C', '0', '⌫'],
];

export default function SearchPage() {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const { routes, loadingState } = useRouteStore();
  const { isFavorite } = useFavoritesStore();
  const useCTBInfo = useSettingsStore(state => state.useCTBInfoForJointRoutes);
  const [searchText, setSearchText] = useState('');

  // Get available alphabets based on current search
  const availableAlphabets = useMemo(() => {
    if (searchText === '') {
      const firstLetters = new Set(
        routes
          .map(r => r.routeNumber.charAt(0).toUpperCase())
          .filter(c => /[A-Z]/.test(c))
      );
      const sorted = Array.from(firstLetters).sort();
      
      const hour = new Date().getHours();
      if (hour >= 23 || hour < 6) {
        const withN = sorted.filter(l => l !== 'N');
        return ['N', ...withN];
      }
      return sorted;
    } else {
      const nextLetters = new Set(
        routes
          .filter(r => r.routeNumber.toLowerCase().startsWith(searchText.toLowerCase()))
          .map(r => {
            if (r.routeNumber.length > searchText.length) {
              const nextChar = r.routeNumber.charAt(searchText.length).toUpperCase();
              return /[A-Z]/.test(nextChar) ? nextChar : null;
            }
            return null;
          })
          .filter((c): c is string => c !== null)
      );
      return Array.from(nextLetters).sort();
    }
  }, [routes, searchText]);

  const isNumberEnabled = useCallback((num: string) => {
    if (searchText === '') return true;
    
    return routes.some(r => {
      const routeNum = r.routeNumber.toLowerCase();
      const search = searchText.toLowerCase();
      if (!routeNum.startsWith(search)) return false;
      if (routeNum.length <= search.length) return false;
      return routeNum.charAt(search.length) === num;
    });
  }, [routes, searchText]);

  const filteredRoutes = useMemo(() => {
    if (!searchText.trim()) {
      return [];
    }

    return routes
      .filter(route =>
        route.routeNumber.toLowerCase().startsWith(searchText.toLowerCase())
      )
      .slice(0, 50);
  }, [routes, searchText]);

  const handleInput = useCallback((char: string) => {
    if (char === 'C') {
      setSearchText('');
    } else if (char === '⌫') {
      setSearchText(prev => prev.slice(0, -1));
    } else {
      setSearchText(prev => prev + char);
    }
  }, []);

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <PageHeader title={t('search')} />

      {/* Results ScrollView - matches iOS ScrollView */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          bgcolor: 'background.default',
          pb: 2.5, // iOS: .padding(.bottom, 20)
        }}
      >
        {searchText ? (
          filteredRoutes.length > 0 ? (
            <List disablePadding>
              {filteredRoutes.map(route => (
                <RouteListItem 
                  key={route.id} 
                  route={route} 
                  isFavorite={isFavorite(route)}
                  locale={locale}
                  useCTBInfo={useCTBInfo}
                />
              ))}
            </List>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography color="text.secondary">
                No routes found for "{searchText}"
              </Typography>
            </Box>
          )
        ) : (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography color="text.secondary">
              {t('searchRoute')}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Search bar + Keypad VStack - matches iOS VStack below ScrollView */}
      <Box
        sx={{
          flexShrink: 0,
          bgcolor: 'background.paper',
          px: 2, // iOS: .padding(.horizontal)
          pb: 1.25, // iOS: .padding(.bottom, 10)
          pt: 1.25,
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
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
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
              <IconButton 
                onClick={() => setSearchText('')} 
                size="small"
                sx={{
                  color: 'text.secondary',
                }}
              >
                <ClearIcon />
              </IconButton>
            )}
          </Paper>

          {/* Keypad HStack - matches iOS HStack */}
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            {/* Number pad */}
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
                {numberRows.map((row, rowIndex) => (
                  <Stack key={rowIndex} direction="row" spacing={1.25}>
                    {row.map(char => {
                      const isDisabled = 
                        (char === '⌫' && searchText === '') ||
                        (char === 'C' && searchText === '') ||
                        (/[0-9]/.test(char) && !isNumberEnabled(char));
                      
                      const isSpecial = char === 'C' || char === '⌫';
                      
                      return (
                        <ButtonBase
                          key={char}
                          onClick={() => handleInput(char)}
                          disabled={isDisabled}
                          sx={{
                            flex: 1,
                            height: 60, // iOS: minHeight: 60
                            borderRadius: 2,
                            bgcolor: isSpecial 
                              ? alpha(theme.palette.error.main, 0.12)
                              : 'background.paper',
                            color: isDisabled 
                              ? 'text.disabled' 
                              : isSpecial 
                                ? 'error.main'
                                : 'text.primary',
                            fontSize: char === '⌫' ? '1.25rem' : '1.5rem',
                            fontWeight: 600,
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            '&:hover:not(:disabled)': {
                              bgcolor: isSpecial
                                ? alpha(theme.palette.error.main, 0.16)
                                : alpha(theme.palette.primary.main, 0.08),
                              transform: 'translateY(-1px)',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            },
                            '&:active:not(:disabled)': {
                              transform: 'scale(0.96)',
                            },
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

            {/* Alphabet column - matches iOS VStack with ScrollView */}
            <Paper 
              elevation={1}
              sx={{ 
                width: 60, 
                p: 1.25, 
                bgcolor: 'surfaceVariant.main',
                borderRadius: 4,
                display: 'flex',
                flexDirection: 'column',
                height: 4 * 60 + 3 * 5, // Match number pad height (4 rows * 60px + 3 gaps * 5px)
              }}
            >
              <Box 
                sx={{ 
                  flex: 1,
                  overflow: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.25,
                }}
              >
                {availableAlphabets.length > 0 ? (
                  availableAlphabets.map(letter => (
                    <ButtonBase
                      key={letter}
                      onClick={() => handleInput(letter)}
                      sx={{
                        height: 40,
                        minHeight: 40,
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                        color: 'primary.main',
                        fontSize: '1.125rem',
                        fontWeight: 700,
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.12),
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        },
                        '&:active': {
                          transform: 'scale(0.96)',
                        },
                      }}
                    >
                      {letter}
                    </ButtonBase>
                  ))
                ) : (
                  <Box sx={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'text.disabled',
                  }}>
                    -
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

// Route list item component - matches iOS HStack layout
interface RouteListItemProps {
  route: Route;
  isFavorite: boolean;
  locale: string;
  useCTBInfo: boolean;
}

function RouteListItem({ route, isFavorite: isFav, locale, useCTBInfo }: RouteListItemProps) {
  const destination = getRouteDestination(route, locale, useCTBInfo);

  return (
    <ListItem disablePadding>
      <ListItemButton
        component={Link}
        href={`/route/${route.routeNumber}/${route.bound}/${route.serviceType}/${route.company}`}
        sx={{ 
          py: 1.5, // iOS: .padding(.vertical, 12)
          px: 2, // iOS: .padding(.leading/trailing, 16)
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          {/* Route number - left side */}
          <Typography
            variant="titleLarge"
            sx={{ 
              fontWeight: 700, 
              minWidth: 80,
              color: 'text.primary', // iOS: .foregroundColor(.primary)
            }}
          >
            {route.routeNumber}
          </Typography>

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* Route info - right side */}
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography
              variant="bodyMedium"
              color="text.secondary" // iOS: .foregroundColor(.secondary)
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {destination}
            </Typography>
            <CompanyBadge company={route.company} size="small" />
            {route.serviceType !== '1' && (
              <Chip
                label="Special"
                size="small"
                color="warning"
                sx={{ height: 20, fontSize: '0.625rem' }}
              />
            )}
            {isFav && (
              <StarIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            )}
          </Stack>
        </Box>
      </ListItemButton>
    </ListItem>
  );
}
