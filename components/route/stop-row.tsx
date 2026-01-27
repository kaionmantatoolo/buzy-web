'use client';

import {
  Box,
  Typography,
  Collapse,
  ButtonBase,
  Stack,
  Skeleton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { StopDetail, RouteETA, getStopName, getStopUniqueId } from '@/lib/types';
import { CompanyBadge } from '@/components/ui/company-badge';
import { ETAList } from '@/components/ui/eta-display';
import { useTranslation } from '@/lib/i18n';
import { useSettingsStore } from '@/lib/stores';

interface StopRowProps {
  stop: StopDetail;
  etas: RouteETA[];
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export function StopRow({
  stop,
  etas,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  isFirst = false,
  isLast = false,
}: StopRowProps) {
  const { locale } = useTranslation();
  const useCTBInfo = useSettingsStore(state => state.useCTBInfoForJointRoutes);

  const stopName = getStopName(stop, locale, useCTBInfo);

  // Get the next ETA for preview
  const nextETA = etas.length > 0 ? etas[0] : null;
  const nextETAMinutes = nextETA?.eta
    ? Math.max(0, Math.floor((new Date(nextETA.eta).getTime() - Date.now()) / 60000))
    : null;

  return (
    <Box
      sx={{
        position: 'relative',
        borderLeft: 4,
        borderColor: isSelected ? 'primary.main' : 'divider',
        bgcolor: isSelected ? 'primary.main' : 'transparent',
        transition: 'all 0.2s',
        '&:hover': {
          bgcolor: isSelected ? 'primary.main' : 'action.hover',
        },
        // Fix: Make the selected background use a lighter tint
        ...(isSelected && {
          bgcolor: 'primary.light',
          '& .MuiTypography-root': {
            color: 'primary.contrastText',
          },
        }),
      }}
    >
      {/* Timeline connector */}
      <Box
        sx={{
          position: 'absolute',
          left: -2,
          top: 0,
          bottom: 0,
          width: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: 'translateX(-50%)',
        }}
      >
        {/* Top line */}
        {!isFirst && (
          <Box sx={{ flex: 1, width: 2, bgcolor: 'divider' }} />
        )}
        {/* Dot */}
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: 2,
            borderColor: isSelected ? 'primary.main' : 'divider',
            bgcolor: isSelected ? 'primary.main' : 'background.paper',
            flexShrink: 0,
          }}
        />
        {/* Bottom line */}
        {!isLast && (
          <Box sx={{ flex: 1, width: 2, bgcolor: 'divider' }} />
        )}
      </Box>

      {/* Stop content */}
      <ButtonBase
        onClick={onToggle}
        sx={{
          width: '100%',
          textAlign: 'left',
          pl: 3,
          pr: 2,
          py: 1.5,
          display: 'block',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          {/* Stop info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography
                variant="labelSmall"
                sx={{ 
                  color: isSelected ? 'primary.contrastText' : 'text.disabled',
                  opacity: isSelected ? 0.8 : 1,
                  width: 20,
                }}
              >
                {stop.sequence}
              </Typography>
              <Typography
                variant="bodyMedium"
                sx={{
                  fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? 'primary.contrastText' : 'text.primary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {stopName}
              </Typography>
            </Stack>
          </Box>

          {/* ETA preview (when collapsed) */}
          {!isExpanded && nextETAMinutes !== null && (
            <Typography
              variant="labelMedium"
              sx={{
                color: isSelected ? 'primary.contrastText' : 'primary.main',
                fontWeight: 600,
              }}
            >
              {nextETAMinutes} min
            </Typography>
          )}

          {/* Expand indicator */}
          <ExpandMoreIcon
            sx={{
              color: isSelected ? 'primary.contrastText' : 'action.active',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          />
        </Box>
      </ButtonBase>

      {/* Expanded ETA details */}
      <Collapse in={isExpanded}>
        <Box sx={{ pl: 7, pr: 2, pb: 2 }}>
          <ETAList etas={etas} maxItems={3} />

          {/* Company badges if multiple */}
          {etas.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
              {Array.from(new Set(etas.map(e => e.co))).map(co => (
                <CompanyBadge
                  key={co}
                  company={co as 'KMB' | 'CTB' | 'Both'}
                  size="small"
                />
              ))}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

// Skeleton for stop row
export function StopRowSkeleton() {
  return (
    <Box sx={{ borderLeft: 4, borderColor: 'divider', pl: 3, pr: 2, py: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={2} justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center">
          <Skeleton variant="text" width={20} />
          <Skeleton variant="text" width={120} />
        </Stack>
        <Skeleton variant="text" width={40} />
      </Stack>
    </Box>
  );
}
