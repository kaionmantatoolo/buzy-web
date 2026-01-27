'use client';

import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
}

export function LoadingSpinner({ size = 'medium' }: LoadingSpinnerProps) {
  const sizeMap = {
    small: 20,
    medium: 36,
    large: 48,
  };

  return (
    <CircularProgress size={sizeMap[size]} />
  );
}

interface FullPageLoaderProps {
  message?: string;
}

export function FullPageLoader({ message }: FullPageLoaderProps) {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        zIndex: 9999,
        gap: 2,
      }}
    >
      <CircularProgress size={48} />
      {message && (
        <Typography variant="bodyMedium" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );
}
