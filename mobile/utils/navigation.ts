import type { Href } from 'expo-router';

export function safeReturnTo(value?: string, fallback: Href = '/') : Href {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.startsWith('/(auth)') || value.startsWith('/auth')) return fallback;
  return value as Href;
}
