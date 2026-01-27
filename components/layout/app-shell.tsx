'use client';

import { Box, Container } from '@mui/material';
import { usePathname } from 'next/navigation';
import { BottomNav } from './bottom-nav';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isRouteDetail = pathname.startsWith('/route/');
  const isSearchPage = pathname === '/search';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <Container
        maxWidth="sm"
        disableGutters
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          height: isSearchPage ? '100vh' : undefined, // Full height for search page
          overflow: isSearchPage ? 'hidden' : undefined,
          pb: isRouteDetail ? 0 : '80px', // Space for bottom nav
        }}
      >
        {children}
      </Container>
      {!isRouteDetail && <BottomNav />}
    </Box>
  );
}
