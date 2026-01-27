'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from '@mui/material';
import NearMeIcon from '@mui/icons-material/NearMe';
import SearchIcon from '@mui/icons-material/Search';
import FavoriteIcon from '@mui/icons-material/Favorite';
import SettingsIcon from '@mui/icons-material/Settings';
import { useTranslation } from '@/lib/i18n';

const navItems = [
  { href: '/', labelKey: 'nearby' as const, icon: <NearMeIcon /> },
  { href: '/search', labelKey: 'search' as const, icon: <SearchIcon /> },
  { href: '/favorites', labelKey: 'favorites' as const, icon: <FavoriteIcon /> },
  { href: '/settings', labelKey: 'settings' as const, icon: <SettingsIcon /> },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();

  // Find current index
  const currentIndex = navItems.findIndex(item => item.href === pathname);

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        // Give the nav a little extra breathing room so that
        // when the site is installed as an app (standalone/PWA),
        // the bar clears the home‑indicator area nicely.
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
      }}
      elevation={3}
    >
      <BottomNavigation
        value={currentIndex >= 0 ? currentIndex : 0}
        onChange={(_, newValue) => {
          router.push(navItems[newValue].href);
        }}
        showLabels
        sx={{
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            padding: '6px 12px',
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.75rem',
            '&.Mui-selected': {
              fontSize: '0.75rem',
            },
          },
        }}
      >
        {navItems.map((item) => (
          <BottomNavigationAction
            key={item.href}
            label={t(item.labelKey)}
            icon={item.icon}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
