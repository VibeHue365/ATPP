/**
 * Frontend Feature Flags Configuration.
 * Aligns with backend CONTRACTS_V2_ENABLED and CONTRACTS_TIERED_ENABLED.
 * Defaults to false (OFF) for safe rollout (fail-closed principle).
 */
export const CONTRACTS_V2_ENABLED: boolean =
  import.meta.env.VITE_CONTRACTS_V2_ENABLED === 'true';

export const CONTRACTS_TIERED_ENABLED: boolean =
  import.meta.env.VITE_CONTRACTS_TIERED_ENABLED === 'true';
