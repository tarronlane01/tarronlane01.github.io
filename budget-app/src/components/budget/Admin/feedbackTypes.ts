// Feedback type definitions and configuration
// Separated from components to satisfy react-refresh/only-export-components

export type FeedbackType = 'critical_bug' | 'bug' | 'new_feature' | 'core_feature' | 'qol'

export const feedbackTypeConfig: Record<FeedbackType, { label: string; color: string; bgColor: string }> = {
  critical_bug: { label: 'Critical Bug', color: '#ff4757', bgColor: 'rgba(255, 71, 87, 0.15)' },
  bug: { label: 'Bug', color: '#ffa502', bgColor: 'rgba(255, 165, 2, 0.15)' },
  new_feature: { label: 'New Feature', color: '#2ed573', bgColor: 'rgba(46, 213, 115, 0.15)' },
  core_feature: { label: 'Core Feature', color: '#1e90ff', bgColor: 'rgba(30, 144, 255, 0.15)' },
  qol: { label: 'QOL', color: '#a55eea', bgColor: 'rgba(165, 94, 234, 0.15)' },
}

