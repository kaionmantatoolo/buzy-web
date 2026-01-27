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
  const { routes, loadingState } = useRouteStore();
  const { isFavorite } = useFavoritesStore();
  const useCTBInfo = useSettingsStore(state => state.useCTBInfoForJointRoutes);
  const [searchText, setSearchText] = useState('');

  // Get available alphabets based on current search
  const availableAlphabets = useMemo(() => {
    if (searchText === '') {
      // Get all unique first letters that are alphabetic
      const firstLetters = new Set(
        routes
          .map(r => r.routeNumber.charAt(0).toUpperCase())
          .filter(c => /[A-Z]/.test(c))
      );
      const sorted = Array.from(firstLetters).sort();
      
      // Check if it's night time (23:00 - 06:00), prioritize 'N' routes
      const hour = new Date().getHours();
      if (hour >= 23 || hour < 6) {
        const withN = sorted.filter(l => l !== 'N');
        return ['N', ...withN];
      }
      return sorted;
    } else {
      // Get next possible letters after current search text
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

  // Check if a number is valid for the next character
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

  // Filter routes based on search text
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

  // Handle keypad input
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
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title={t('search')} />

      {/* Results area - scrollable */}
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
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

      {/* Fixed bottom section - Search bar and keypad */}
      <Box sx={{ 
        flexShrink: 0,
        bgcolor: 'background.paper', 
        borderTop: 1, 
        borderColor: 'divider',
        pb: 'env(safe-area-inset-bottom)',
      }}>
        {/* Search bar */}
        <Box sx={{ px: 2, pt: 2, pb: 1 }}>
          <Paper
            sx={{
              px: 2,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: 'action.hover',
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
              <IconButton onClick={() => setSearchText('')} size="small">
                <ClearIcon />
              </IconButton>
            )}
          </Paper>
        </Box>

        {/* Keypad section */}
        <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 1 }}>
          {/* Number pad */}
          <Paper sx={{ flex: 1, p: 1, bgcolor: 'action.hover' }}>
            <Stack spacing={1}>
              {numberRows.map((row, rowIndex) => (
                <Stack key={rowIndex} direction="row" spacing={1}>
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
                          height: 52,
                          borderRadius: 2,
                          bgcolor: isSpecial ? 'action.selected' : 'background.paper',
                          color: isDisabled ? 'text.disabled' : 'text.primary',
                          fontSize: char === '⌫' ? '1.25rem' : '1.5rem',
                          fontWeight: 500,
                          transition: 'all 0.15s',
                          '&:hover:not(:disabled)': {
                            bgcolor: 'action.hover',
                          },
                          '&:active:not(:disabled)': {
                            transform: 'scale(0.95)',
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

          {/* Alphabet column */}
          <Paper 
            sx={{ 
              width: 56, 
              p: 1, 
              bgcolor: 'action.hover',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box 
              sx={{ 
                flex: 1, 
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                maxHeight: 4 * 52 + 3 * 8, // Match number pad height
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
                      borderRadius: 1.5,
                      bgcolor: 'background.paper',
                      color: 'primary.main',
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      transition: 'all 0.15s',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                      '&:active': {
                        transform: 'scale(0.95)',
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
        </Box>
      </Box>
    </Box>
  );
}

// Route list item component
interface RouteListItemProps {
  route: Route;
  isFavorite: boolean;
  locale: string;
  useCTBInfo: boolean;
}

function RouteListItem({ route, isFavorite: isFav, locale, useCTBInfo }: RouteListItemProps) {
  const destination = getRouteDestination(route, locale, useCTBInfo);

  return (
    <ListItem disablePadding divider>
      <ListItemButton
        component={Link}
        href={`/route/${route.routeNumber}/${route.bound}/${route.serviceType}/${route.company}`}
        sx={{ py: 1.5, px: 2 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
          {/* Route number */}
          <Typography
            variant="titleLarge"
            sx={{ 
              fontWeight: 700, 
              minWidth: 70,
              color: 'primary.main',
            }}
          >
            {route.routeNumber}
          </Typography>

          {/* Route info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography
                variant="bodyMedium"
                color="text.secondary"
                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                → {destination}
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
            </Stack>
          </Box>

          {/* Favorite star */}
          {isFav && (
            <StarIcon sx={{ color: 'warning.main', fontSize: 20 }} />
          )}
        </Box>
      </ListItemButton>
    </ListItem>
  );
}
