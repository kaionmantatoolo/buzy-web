'use client';

import { useState, useEffect, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { useMediaQuery } from '@mui/material';
import { lightTheme, darkTheme } from '@/lib/theme';
import { useRouteStore } from '@/lib/stores';

function RouteInitializer() {
  const loadRoutes = useRouteStore(state => state.loadRoutes);
  
  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);
  
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10 * 1000,
            refetchOnWindowFocus: true,
            retry: 2,
          },
        },
      })
  );

  // Detect system color scheme preference
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  
  // Memoize theme to prevent unnecessary re-renders
  const theme = useMemo(
    () => (prefersDarkMode ? darkTheme : lightTheme),
    [prefersDarkMode]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <RouteInitializer />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
