/**
 * Feature Flags
 *
 * Toggle various development and debugging features here.
 * These flags are checked at runtime to enable/disable functionality.
 */

export const featureFlags = {
  /**
   * Log Firebase read/write operations to the console.
   * Useful for debugging data flow, but can be noisy.
   */
  logFirebaseOperations: true,
} as const

// Type for feature flag keys
export type FeatureFlagKey = keyof typeof featureFlags

