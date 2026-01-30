// Feedback type definitions and configuration
// Separated from components to satisfy react-refresh/only-export-components

export type FeedbackType = 'critical_bug' | 'bug' | 'new_feature' | 'core_feature' | 'qol'

export const feedbackTypeConfig: Record<FeedbackType, { label: string; color: string; bgColor: string }> = {
  critical_bug: { label: 'Critical Bug', color: 'var(--color-error)', bgColor: 'var(--color-error-bg)' },
  bug: { label: 'Bug', color: 'var(--color-warning)', bgColor: 'var(--color-warning-bg)' },
  new_feature: { label: 'New Feature', color: 'var(--color-success)', bgColor: 'var(--color-success-bg)' },
  core_feature: { label: 'Core Feature', color: 'var(--color-migration-blue)', bgColor: 'var(--color-migration-blue-bg)' },
  qol: { label: 'QOL', color: 'var(--color-migration-purple)', bgColor: 'var(--color-migration-purple-bg)' },
}

