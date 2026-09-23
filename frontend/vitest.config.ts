import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const originalDirectory = resolve(import.meta.dirname, 'src/pages/providerdashboard');
const baseline = resolve(import.meta.dirname, '../docs/refactor-baselines/provider-dashboard-2026-09-21/ProviderDashboard.tsx');
const referenceId = resolve(originalDirectory, 'ProviderDashboard.reference.tsx').replaceAll('\\', '/');

export default defineConfig({
  plugins: [{
    name: 'provider-original-reference',
    resolveId(id) {
      if (id === 'provider-original-reference') return referenceId;
    },
    load(id) {
      if (id !== referenceId) return;
      // Virtual location preserves all imports without editing the immutable copy.
      return readFileSync(baseline, 'utf8');
    },
  }],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    testTimeout: 15000,
  },
});
