/**
 * Centralized feature flags system driven by environment variables.
 * Defaults all target flags to false (disabled).
 */

export const FEATURE_REVENUE_DASHBOARD =
  import.meta.env.VITE_FEATURE_REVENUE_DASHBOARD === 'true'

export const FEATURE_SPONSOR_TREE =
  import.meta.env.VITE_FEATURE_SPONSOR_TREE === 'true'

export const FEATURE_MARKET_YOURSELF =
  import.meta.env.VITE_FEATURE_MARKET_YOURSELF === 'true'
