'use client';

import { useTheme, alpha } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import { BusCompany } from '@/lib/types';
import { m3Tokens } from '@/lib/theme';

interface CompanyBadgeProps {
  company: BusCompany;
  size?: 'small' | 'medium';
}

export function CompanyBadge({ company, size = 'small' }: CompanyBadgeProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const tokens = isDark ? m3Tokens.dark : m3Tokens.light;

  const getColors = () => {
    switch (company) {
      case 'KMB':
        return { color: tokens.kmb };
      case 'CTB':
        return { color: tokens.ctb };
      case 'Both':
        return { color: tokens.joint };
    }
  };

  const { color } = getColors();
  const label = company === 'Both' ? 'Joint' : company;
  const fontSize = size === 'small' ? '0.75rem' : '0.8125rem';

  // iOS RouteBadgeLabel: background color.opacity(0.2), foreground color
  return (
    <Box
      sx={{
        px: 0.5,
        py: 0.25,
        borderRadius: 1,
        bgcolor: alpha(color, 0.2),
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <Typography
        component="span"
        sx={{
          fontSize,
          fontWeight: 500,
          color,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}
