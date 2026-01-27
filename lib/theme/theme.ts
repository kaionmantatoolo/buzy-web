'use client';

import { createTheme, ThemeOptions } from '@mui/material/styles';

// Pure Material 3 expressive color tokens
// Using Material 3 dynamic color system with expressive palette
const m3Tokens = {
  light: {
    primary: '#6750A4',           // M3 expressive purple
    onPrimary: '#FFFFFF',
    primaryContainer: '#EADDFF',
    onPrimaryContainer: '#21005D',
    
    secondary: '#625B71',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#E8DEF8',
    onSecondaryContainer: '#1D192B',
    
    tertiary: '#7D5260',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#FFD8E4',
    onTertiaryContainer: '#31111D',
    
    error: '#BA1A1A',
    onError: '#FFFFFF',
    errorContainer: '#FFDAD6',
    onErrorContainer: '#410002',
    
    background: '#FFFBFE',
    onBackground: '#1C1B1F',
    surface: '#FFFBFE',
    onSurface: '#1C1B1F',
    surfaceDim: '#DDD8E1',
    surfaceBright: '#FFFBFE',
    
    surfaceVariant: '#E7E0EC',
    onSurfaceVariant: '#49454F',
    outline: '#79747E',
    outlineVariant: '#CAC4D0',
    
    // Brand colors with M3 expressive tones
    kmb: '#B3261E',              // M3 expressive red
    ctb: '#F57C00',              // M3 expressive orange
    joint: '#006C4C',            // M3 expressive green
  },
  dark: {
    primary: '#D0BCFF',          // M3 expressive purple light
    onPrimary: '#381E72',
    primaryContainer: '#4F378B',
    onPrimaryContainer: '#EADDFF',
    
    secondary: '#CCC2DC',
    onSecondary: '#332D41',
    secondaryContainer: '#4A4458',
    onSecondaryContainer: '#E8DEF8',
    
    tertiary: '#EFB8C8',
    onTertiary: '#492532',
    tertiaryContainer: '#633B48',
    onTertiaryContainer: '#FFD8E4',
    
    error: '#FFB4AB',
    onError: '#690005',
    errorContainer: '#93000A',
    onErrorContainer: '#FFDAD6',
    
    background: '#1C1B1F',
    onBackground: '#E6E1E5',
    surface: '#1C1B1F',
    onSurface: '#E6E1E5',
    surfaceDim: '#141218',
    surfaceBright: '#36333B',
    
    surfaceVariant: '#49454F',
    onSurfaceVariant: '#CAC4D0',
    outline: '#938F99',
    outlineVariant: '#49454F',
    
    kmb: '#F2B8B5',
    ctb: '#FFB74D',
    joint: '#4CAF50',
  },
};

// Create light theme with M3 expressive design
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: m3Tokens.light.primary,
      light: m3Tokens.light.primaryContainer,
      dark: '#4F378B',
      contrastText: m3Tokens.light.onPrimary,
    },
    secondary: {
      main: m3Tokens.light.secondary,
      light: m3Tokens.light.secondaryContainer,
      dark: '#4A4458',
      contrastText: m3Tokens.light.onSecondary,
    },
    error: {
      main: m3Tokens.light.error,
      light: m3Tokens.light.errorContainer,
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
    borderRadius: 16, // M3 expressive uses larger radius
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '28px', // M3 expressive pill shape
          textTransform: 'none',
          fontWeight: 500,
          padding: '10px 24px',
          boxShadow: 'none',
        },
        contained: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
          '&:hover': {
            boxShadow: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '28px', // M3 expressive large radius
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
          border: 'none',
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          borderRadius: '16px',
          boxShadow: '0 3px 5px -1px rgba(0,0,0,0.2), 0 6px 10px 0 rgba(0,0,0,0.14)',
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
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: '16px',
        },
        rounded: {
          borderRadius: '16px',
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
      light: m3Tokens.dark.primaryContainer,
      dark: '#4F378B',
      contrastText: m3Tokens.dark.onPrimary,
    },
    secondary: {
      main: m3Tokens.dark.secondary,
      light: m3Tokens.dark.secondaryContainer,
      dark: '#4A4458',
      contrastText: m3Tokens.dark.onSecondary,
    },
    error: {
      main: m3Tokens.dark.error,
      light: m3Tokens.dark.errorContainer,
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
          borderRadius: '28px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.4)',
          border: 'none',
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
