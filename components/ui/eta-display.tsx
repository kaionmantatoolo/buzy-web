'use client';

import { Box, Typography, Chip, Stack } from '@mui/material';
import { RouteETA, formatETA, getETARemark, isUpcomingETA } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';
import { CompanyBadge } from '@/components/ui/company-badge';
import type { BusCompany } from '@/lib/types';

interface ETADisplayProps {
  eta: RouteETA;
  showRemark?: boolean;
  compact?: boolean;
}

export function ETADisplay({ eta, showRemark = true, compact = false }: ETADisplayProps) {
  const { locale } = useTranslation();
  const formattedETA = formatETA(eta.eta, locale);
  const remark = getETARemark(eta, locale);

  // Determine styling based on ETA status
  const isArriving = formattedETA.includes('Arriving') || formattedETA.includes('就嚟到');
  const isDeparted = formattedETA.includes('Departed') || formattedETA.includes('已經走');
  const isNA = formattedETA === 'N/A' || formattedETA === '冇車';

  const getColor = () => {
    if (isArriving) return 'success.main';
    if (isDeparted || isNA) return 'text.disabled';
    return 'primary.main';
  };

  // Operator badge should reflect the ETA source operator (KMB/CTB), not the route company.
  const etaCompany: BusCompany | null =
    eta.co === 'KMB' ? 'KMB' : eta.co === 'CTB' ? 'CTB' : null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {etaCompany && (
        <CompanyBadge company={etaCompany} size={compact ? 'small' : 'small'} />
      )}
      <Typography
        variant={compact ? 'bodySmall' : 'bodyMedium'}
        sx={{
          fontWeight: 600,
          color: getColor(),
        }}
      >
        {formattedETA}
      </Typography>
      {showRemark && remark && (
        <Chip
          label={remark}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.625rem',
            bgcolor: 'action.hover',
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      )}
    </Box>
  );
}

interface ETAListProps {
  etas: RouteETA[];
  maxItems?: number;
}

// Filter out ETAs that shouldn't be displayed:
// - null/empty ETA
// - departed (past) ETA
function filterValidETAs(etas: RouteETA[]): RouteETA[] {
  return etas.filter((e): e is RouteETA & { eta: string } => {
    if (e.eta == null || e.eta === '') return false;
    return isUpcomingETA(e.eta);
  });
}

export function ETAList({ etas, maxItems = 3 }: ETAListProps) {
  const { t } = useTranslation();

  const validETAs = filterValidETAs(etas);

  if (validETAs.length === 0) {
    return (
      <Typography variant="bodySmall" color="text.secondary">
        {t('noBusesArrivingSoon')}
      </Typography>
    );
  }

  const displayETAs = validETAs.slice(0, maxItems);

  return (
    <Stack spacing={0.5}>
      {displayETAs.map((eta, index) => (
        <Box key={`${eta.eta_seq}-${eta.eta}`} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="labelSmall"
            sx={{ color: 'text.disabled', width: 16 }}
          >
            {index + 1}.
          </Typography>
          <ETADisplay eta={eta} />
        </Box>
      ))}
    </Stack>
  );
}

// Compact ETA badge for list views
interface ETABadgeProps {
  eta: RouteETA | null;
}

export function ETABadge({ eta }: ETABadgeProps) {
  const { locale } = useTranslation();

  if (!eta) {
    return (
      <Typography variant="bodySmall" color="text.disabled">
        --
      </Typography>
    );
  }

  const formattedETA = formatETA(eta.eta, locale);
  const isArriving = formattedETA.includes('Arriving') || formattedETA.includes('就嚟到');

  return (
    <Chip
      label={formattedETA}
      size="small"
      color={isArriving ? 'success' : 'primary'}
      sx={{
        fontWeight: 600,
        height: 24,
        '& .MuiChip-label': { px: 1 },
      }}
    />
  );
}
