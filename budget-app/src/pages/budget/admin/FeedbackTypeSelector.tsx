/**
 * Feedback Type Selector Component
 */

import { feedbackTypeConfig, type FeedbackType } from '../../../components/budget/Admin'
import { logUserAction } from '@utils'

interface FeedbackTypeSelectorProps {
  selectedType: FeedbackType
  onSelect: (type: FeedbackType) => void
}

export function FeedbackTypeSelector({ selectedType, onSelect }: FeedbackTypeSelectorProps) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', paddingBottom: '1rem', flexWrap: 'wrap' }}>
      {(['critical_bug', 'bug', 'new_feature', 'core_feature', 'qol'] as FeedbackType[]).map((type) => {
        const config = feedbackTypeConfig[type]
        // Handle legacy 'feature' type
        const normalizedSelected = (selectedType as string) === 'feature' ? 'new_feature' : selectedType
        const isSelected = normalizedSelected === type || (!normalizedSelected && type === 'bug')
        return (
          <button
            key={type}
            type="button"
            onClick={() => { logUserAction('SELECT', 'Feedback Type', { value: config.label }); onSelect(type) }}
            style={{
              flex: 1,
              padding: '0.6rem 0.75rem',
              border: `2px solid ${config.color}`,
              borderRadius: '0.5rem',
              background: isSelected ? config.bgColor : 'transparent',
              color: isSelected ? config.color : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontWeight: isSelected ? 600 : 400,
              fontSize: '0.85rem',
              transition: 'all 0.15s ease',
              opacity: isSelected ? 1 : 0.5,
              boxShadow: isSelected ? `0 0 12px ${config.bgColor}` : 'none',
              position: 'relative' as const,
            }}
          >
            {config.label}
            {isSelected && (
              <span style={{
                position: 'absolute',
                bottom: '-14px',
                left: '10%',
                right: '10%',
                height: '3px',
                background: 'white',
                borderRadius: '2px',
              }} />
            )}
          </button>
        )
      })}
    </div>
  )
}

