'use client';

import { Chip } from '@mui/material';
import { BusCompany } from '@/lib/types';
import { m3Tokens } from '@/lib/theme';

interface CompanyBadgeProps {
  company: BusCompany;
  size?: 'small' | 'medium';
}

export function CompanyBadge({ company, size = 'small' }: CompanyBadgeProps) {
  const getColors = () => {
    switch (company) {
      case 'KMB':
        return { bg: m3Tokens.light.kmb, text: '#FFFFFF' };
      case 'CTB':
        return { bg: m3Tokens.light.ctb, text: '#FFFFFF' };
      case 'Both':
        return { bg: m3Tokens.light.joint, text: '#FFFFFF' };
    }
  };

  const colors = getColors();
  const label = company === 'Both' ? 'Joint' : company;

  return (
    <Chip
      label={label}
      size={size}
      sx={{
        bgcolor: colors.bg,
        color: colors.text,
        fontWeight: 600,
        fontSize: size === 'small' ? '0.6875rem' : '0.75rem',
        height: size === 'small' ? 20 : 24,
        '& .MuiChip-label': {
          px: 1,
        },
      }}
    />
  );
}
