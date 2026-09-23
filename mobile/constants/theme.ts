import { Platform } from 'react-native';

export const Colors = {
  primary: '#7D3543',
  primaryHover: '#914454',
  primaryDark: '#642936',
  primarySoft: '#F3E7E9',
  background: '#FCFAF8',
  surface: '#FFFFFF',
  surfaceSoft: '#F3EBEC',
  border: '#E8DEDF',
  text: '#292324',
  textSecondary: '#6F6264',
  textMuted: '#988B8D',
  success: '#20945A',
  successSoft: '#EBFAF2',
  warning: '#D67A12',
  warningSoft: '#FFF7E6',
  error: '#D84955',
  errorSoft: '#FFF0F1',
  white: '#FFFFFF',
  black: '#171313',
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
  sm: 8,
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
  display: 'PlayfairDisplay_700Bold',
} as const;

export const Shadow = Platform.select({
  ios: {
    shadowColor: '#292324',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: { elevation: 3 },
  default: {},
});
