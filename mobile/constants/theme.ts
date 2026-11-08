import { Platform } from 'react-native';

export const Colors = {
  primary: '#BA0049',
  primaryHover: '#D61C62',
  primaryDark: '#8A0035',
  primarySoft: '#FFF0F3',
  background: '#FBF9F9',
  surface: '#FFFFFF',
  surfaceSoft: '#F5F3F3',
  border: '#EFECEB',
  text: '#1B1C1C',
  textSecondary: '#5F5E5E',
  textMuted: '#8F8E8E',
  success: '#059669',
  successSoft: '#ECFDF5',
  warning: '#D97706',
  warningSoft: '#FFFBEB',
  error: '#DC2626',
  errorSoft: '#FEF2F2',
  white: '#FFFFFF',
  black: '#1B1C1C',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const FontFamily = {
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  display: 'Inter_700Bold',
  displayBold: 'Inter_700Bold',
} as const;

export const Shadow = Platform.select({
  ios: {
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  android: { elevation: 2 },
  default: {},
});
