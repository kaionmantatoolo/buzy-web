'use client';

import { createTheme, ThemeOptions } from '@mui/material/styles';

// Material 3 + iOS Buzy color tokens
// iOS: route # blue, KMB red, CTB yellow, Joint green; system backgrounds
const m3Tokens = {
  light: {
    primary: '#007AFF',           // iOS blue
    onPrimary: '#FFFFFF',
    primaryContainer: '#D1E4FF',
    onPrimaryContainer: '#001D36',
    
    secondary: '#535F70',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#E5E5EA',
    onSecondaryContainer: '#101C2B',
    
    tertiary: '#6B5778',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#F2DAFF',
    onTertiaryContainer: '#251432',
    
    error: '#BA1A1A',
    onError: '#FFFFFF',
    errorContainer: '#FFDAD6',
    onErrorContainer: '#410002',
    
    background: '#F2F2F7',        // iOS secondarySystemBackground
    onBackground: '#000000',
    surface: '#FFFFFF',           // iOS systemBackground
    onSurface: '#000000',
    
    surfaceVariant: '#E5E5EA',    // iOS systemGray5
    onSurfaceVariant: '#8E8E93',
    outline: '#C7C7CC',
    outlineVariant: '#E5E5EA',
    
    // iOS app brand colors (RouteBadge)
    kmb: '#E60012',
    ctb: '#F7941D',
    joint: '#34C759',             // iOS green
  },
  dark: {
    primary: '#0A84FF',           // iOS blue dark
    onPrimary: '#000000',
    primaryContainer: '#00497D',
    onPrimaryContainer: '#D1E4FF',
    
    secondary: '#BBC7DB',
    onSecondary: '#253140',
    secondaryContainer: '#2C2C2E',
    onSecondaryContainer: '#D7E3F7',
    
    tertiary: '#D6BEE4',
    onTertiary: '#3B2948',
    tertiaryContainer: '#523F5F',
    onTertiaryContainer: '#F2DAFF',
    
    error: '#FF453A',
    onError: '#000000',
    errorContainer: '#93000A',
    onErrorContainer: '#FFDAD6',
    
    background: '#000000',        // iOS dark background
    onBackground: '#FFFFFF',
    surface: '#1C1C1E',           // iOS secondarySystemBackground dark
    onSurface: '#FFFFFF',
    
    surfaceVariant: '#2C2C2E',
    onSurfaceVariant: '#8E8E93',
    outline: '#48484A',
    outlineVariant: '#38383A',
    
    kmb: '#FF6B6B',
    ctb: '#FFB347',
    joint: '#30D158',             // iOS green dark
  },
};

// Create light theme
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: m3Tokens.light.primary,
      contrastText: m3Tokens.light.onPrimary,
    },
    secondary: {
      main: m3Tokens.light.secondary,
      contrastText: m3Tokens.light.onSecondary,
    },
    error: {
      main: m3Tokens.light.error,
      contrastText: m3Tokens.light.onError,
    },
    background: {
      default: m3Tokens.light.background,
      paper: m3Tokens.light.surface,
    },
    text: {
      primary: m3Tokens.light.onBackground,
      secondary: m3Tokens.light.onSurfaceVariant,
      disabled: m3Tokens.light.onSurfaceVariant,
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    // Material 3 type scale
    displayLarge: { fontSize: '57px', lineHeight: '64px', letterSpacing: '-0.25px', fontWeight: 400 },
    displayMedium: { fontSize: '45px', lineHeight: '52px', letterSpacing: '0px', fontWeight: 400 },
    displaySmall: { fontSize: '36px', lineHeight: '44px', letterSpacing: '0px', fontWeight: 400 },
    headlineLarge: { fontSize: '32px', lineHeight: '40px', letterSpacing: '0px', fontWeight: 400 },
    headlineMedium: { fontSize: '28px', lineHeight: '36px', letterSpacing: '0px', fontWeight: 400 },
    headlineSmall: { fontSize: '24px', lineHeight: '32px', letterSpacing: '0px', fontWeight: 400 },
    titleLarge: { fontSize: '22px', lineHeight: '28px', letterSpacing: '0px', fontWeight: 400 },
    titleMedium: { fontSize: '16px', lineHeight: '24px', letterSpacing: '0.15px', fontWeight: 500 },
    titleSmall: { fontSize: '14px', lineHeight: '20px', letterSpacing: '0.1px', fontWeight: 500 },
    bodyLarge: { fontSize: '16px', lineHeight: '24px', letterSpacing: '0.5px', fontWeight: 400 },
    bodyMedium: { fontSize: '14px', lineHeight: '20px', letterSpacing: '0.25px', fontWeight: 400 },
    bodySmall: { fontSize: '12px', lineHeight: '16px', letterSpacing: '0.4px', fontWeight: 400 },
    labelLarge: { fontSize: '14px', lineHeight: '20px', letterSpacing: '0.1px', fontWeight: 500 },
    labelMedium: { fontSize: '12px', lineHeight: '16px', letterSpacing: '0.5px', fontWeight: 500 },
    labelSmall: { fontSize: '11px', lineHeight: '16px', letterSpacing: '0.5px', fontWeight: 500 },
  },
  shape: {
    borderRadius: 12, // Material 3 uses more rounded corners
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '20px', // Pill-shaped buttons in M3
          textTransform: 'none',
          fontWeight: 500,
          padding: '10px 24px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          border: `1px solid ${m3Tokens.light.outlineVariant}`,
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          borderRadius: '16px',
          boxShadow: '0 3px 5px -1px rgba(0,0,0,0.1), 0 6px 10px 0 rgba(0,0,0,0.07)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: m3Tokens.light.surface,
          borderTop: `1px solid ${m3Tokens.light.outlineVariant}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: m3Tokens.light.surface,
          color: m3Tokens.light.onSurface,
          boxShadow: 'none',
          borderBottom: `1px solid ${m3Tokens.light.outlineVariant}`,
        },
      },
    },
  },
});

// Create dark theme
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: m3Tokens.dark.primary,
      contrastText: m3Tokens.dark.onPrimary,
    },
    secondary: {
      main: m3Tokens.dark.secondary,
      contrastText: m3Tokens.dark.onSecondary,
    },
    error: {
      main: m3Tokens.dark.error,
      contrastText: m3Tokens.dark.onError,
    },
    background: {
      default: m3Tokens.dark.background,
      paper: m3Tokens.dark.surface,
    },
    text: {
      primary: m3Tokens.dark.onBackground,
      secondary: m3Tokens.dark.onSurfaceVariant,
      disabled: m3Tokens.dark.onSurfaceVariant,
    },
  },
  typography: lightTheme.typography,
  shape: lightTheme.shape,
  components: {
    ...lightTheme.components,
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          border: `1px solid ${m3Tokens.dark.outlineVariant}`,
          backgroundColor: m3Tokens.dark.surface,
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: m3Tokens.dark.surface,
          borderTop: `1px solid ${m3Tokens.dark.outlineVariant}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: m3Tokens.dark.surface,
          color: m3Tokens.dark.onSurface,
          boxShadow: 'none',
          borderBottom: `1px solid ${m3Tokens.dark.outlineVariant}`,
        },
      },
    },
  },
});

// Export tokens for custom components
export { m3Tokens };
