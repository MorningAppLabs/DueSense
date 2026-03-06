// DueSense Design System
// ─────────────────────────────────────────────────────────────────────────────

export const COLORS = {
  // Brand
  primary: '#4361EE',
  primaryLight: '#EEF1FD',
  primaryDark: '#2C47D8',

  // Semantic
  success: '#22C55E',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF233C',
  dangerLight: '#FFE4E8',
  info: '#06B6D4',
  infoLight: '#CFFAFE',

  // Surfaces
  background: '#F4F6FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1FD',
  border: '#E4E7F0',
  borderLight: '#F1F3FA',

  // Typography
  text: '#1A1D2E',
  textSecondary: '#5A627A',
  textMuted: '#9AA3BA',
  textInverse: '#FFFFFF',

  // Card accent palette (index matches card assignment)
  cardPalette: [
    '#4361EE', // indigo
    '#E63946', // coral
    '#2A9D8F', // teal
    '#E76F51', // orange
    '#9B5DE5', // purple
    '#F77F00', // amber
    '#06B6D4', // cyan
    '#22C55E', // green
  ],
};

export const TYPOGRAPHY = {
  displayLarge: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    lineHeight: 40,
    color: COLORS.text,
  },
  h1: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    lineHeight: 34,
    color: COLORS.text,
  },
  h2: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    lineHeight: 28,
    color: COLORS.text,
  },
  h3: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    lineHeight: 24,
    color: COLORS.text,
  },
  h4: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.text,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
  },
  bodyBold: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
  },
  bodySemiBold: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
  },
  caption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textSecondary,
  },
  captionBold: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textSecondary,
  },
  micro: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    lineHeight: 14,
    color: COLORS.textMuted,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
};

export const SHADOWS = {
  xs: {
    shadowColor: '#1A1D2E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#1A1D2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#1A1D2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1A1D2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};

// Helper: get card accent color by index (cyclic)
export const getCardColor = (index: number, customColor?: string): string =>
  customColor ?? COLORS.cardPalette[index % COLORS.cardPalette.length];
