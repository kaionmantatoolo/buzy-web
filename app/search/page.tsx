'use client';

import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Grid,
  Stack,
  useTheme,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import BackspaceIcon from '@mui/icons-material/Backspace';
import { PageHeader } from '@/components/layout';
import { RouteCard, RouteCardSkeleton } from '@/components/route';
import { useRouteStore } from '@/lib/stores';
import { useTranslation } from '@/lib/i18n';

// Keypad buttons configuration
const keypadRows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['A', '0', 'X'],
  ['K', 'N', 'P'],
  ['M', 'R', 'S'],
];

export default function SearchPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { routes, loadingState } = useRouteStore();
  const [searchText, setSearchText] = useState('');

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

  // Handle keypad button press
  const handleKeyPress = (key: string) => {
    if (key === 'del') {
      setSearchText(prev => prev.slice(0, -1));
    } else {
      setSearchText(prev => prev + key);
    }
  };

  // Handle clear
  const handleClear = () => {
    setSearchText('');
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title={t('search')} />

      {/* Search display */}
      <Box sx={{ p: 2 }}>
        <Paper
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography
            variant="headlineMedium"
            sx={{
              fontWeight: 700,
              color: searchText ? 'text.primary' : 'text.disabled',
              minHeight: 40,
            }}
          >
            {searchText || t('searchRoute')}
          </Typography>
          {searchText && (
            <IconButton onClick={handleClear} size="small">
              <ClearIcon />
            </IconButton>
          )}
        </Paper>
      </Box>

      {/* Results or keypad */}
      {searchText ? (
        // Search results
        <Box sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2 }}>
          {loadingState === 'loading' ? (
            <Stack spacing={0}>
              {[...Array(5)].map((_, i) => (
                <RouteCardSkeleton key={i} />
              ))}
            </Stack>
          ) : filteredRoutes.length > 0 ? (
            <Stack spacing={0}>
              {filteredRoutes.map(route => (
                <RouteCard key={route.id} route={route} />
              ))}
            </Stack>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography color="text.secondary">
                No routes found for "{searchText}"
              </Typography>
            </Box>
          )}
        </Box>
      ) : (
        // Keypad
        <Box sx={{ flex: 1, p: 2 }}>
          <Stack spacing={1}>
            {keypadRows.map((row, rowIndex) => (
              <Grid container spacing={1} key={rowIndex}>
                {row.map(key => (
                  <Grid item xs={4} key={key}>
                    <Paper
                      component="button"
                      onClick={() => handleKeyPress(key)}
                      sx={{
                        width: '100%',
                        height: 56,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        border: 'none',
                        bgcolor: 'background.paper',
                        color: key.match(/[A-Z]/) ? 'primary.main' : 'text.primary',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                        '&:active': {
                          bgcolor: 'action.selected',
                        },
                      }}
                    >
                      {key}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            ))}

            {/* Bottom row - delete button */}
            <Grid container spacing={1}>
              <Grid item xs={4} />
              <Grid item xs={4} />
              <Grid item xs={4}>
                <Paper
                  component="button"
                  onClick={() => handleKeyPress('del')}
                  sx={{
                    width: '100%',
                    height: 56,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    border: 'none',
                    bgcolor: 'background.paper',
                    color: 'error.main',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'error.light',
                      color: 'error.contrastText',
                    },
                  }}
                >
                  <BackspaceIcon />
                </Paper>
              </Grid>
            </Grid>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
