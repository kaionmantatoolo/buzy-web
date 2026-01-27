'use client';

import { useRouter } from 'next/navigation';
import { AppBar, Toolbar, IconButton, Typography, Box } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  rightContent?: React.ReactNode;
  transparent?: boolean;
}

export function PageHeader({ 
  title, 
  showBack = false, 
  rightContent,
  transparent = false,
}: PageHeaderProps) {
  const router = useRouter();

  return (
    <AppBar 
      position="sticky" 
      elevation={0}
      sx={{
        bgcolor: transparent ? 'transparent' : 'background.paper',
        backdropFilter: transparent ? 'none' : 'blur(8px)',
      }}
    >
      <Toolbar sx={{ minHeight: 56 }}>
        {/* Left - Back button */}
        <Box sx={{ width: 48 }}>
          {showBack && (
            <IconButton
              edge="start"
              onClick={() => router.back()}
              aria-label="Go back"
              sx={{ color: 'text.primary' }}
            >
              <ArrowBackIcon />
            </IconButton>
          )}
        </Box>

        {/* Center - Title */}
        <Typography
          variant="titleMedium"
          component="h1"
          sx={{
            flex: 1,
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'text.primary',
          }}
        >
          {title}
        </Typography>

        {/* Right - Custom content */}
        <Box sx={{ width: 48, display: 'flex', justifyContent: 'flex-end' }}>
          {rightContent}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
