import { useState, useContext, useEffect, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import UserContext from '../../contexts/user_context'
import useFirebaseAuth from '../../hooks/useFirebaseAuth'
import { useFeedbackMutations } from '../../data'
import { colors } from '../../styles/shared'
import { Button } from './Button'
import { Modal } from './Modal'
import { TextAreaInput, FormButtonGroup } from './FormElements'

type FeedbackType = 'critical_bug' | 'bug' | 'new_feature' | 'core_feature' | 'qol'

const CONFIRMATION_TIMEOUT_MS = 2000

const feedbackTypeConfig: Record<FeedbackType, { label: string; color: string; bgColor: string }> = {
  critical_bug: { label: 'Critical Bug', color: '#ff4757', bgColor: 'rgba(255, 71, 87, 0.15)' },
  bug: { label: 'Bug', color: '#ffa502', bgColor: 'rgba(255, 165, 2, 0.15)' },
  new_feature: { label: 'New Feature', color: '#2ed573', bgColor: 'rgba(46, 213, 115, 0.15)' },
  core_feature: { label: 'Core Feature', color: '#1e90ff', bgColor: 'rgba(30, 144, 255, 0.15)' },
  qol: { label: 'QOL', color: '#a55eea', bgColor: 'rgba(165, 94, 234, 0.15)' },
}

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug')
  const [showConfirmation, setShowConfirmation] = useState(false)

  const userContext = useContext(UserContext)
  const firebase_auth_hook = useFirebaseAuth()
  const currentUser = firebase_auth_hook.get_current_firebase_user()
  const location = useLocation()
  const feedbackMutations = useFeedbackMutations()

  // Auto-hide confirmation after timeout
  useEffect(() => {
    if (showConfirmation) {
      const timer = setTimeout(() => setShowConfirmation(false), CONFIRMATION_TIMEOUT_MS)
      return () => clearTimeout(timer)
    }
  }, [showConfirmation])

  // Hide on feedback admin page since it has its own form
  const isOnFeedbackPage = location.pathname.includes('/admin/feedback')
  if (isOnFeedbackPage) return null
  if (!userContext.is_logged_in) return null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!feedbackText.trim() || !userContext.username || !currentUser) return

    // Fire mutation and close optimistically - the item appears immediately via onMutate
    feedbackMutations.submitFeedback.mutate({
      userId: currentUser.uid,
      userEmail: userContext.username,
      text: feedbackText.trim(),
      feedbackType,
      currentPath: location.pathname,
    })

    // Close and show confirmation
    setFeedbackText('')
    setFeedbackType('bug')
    setIsOpen(false)
    setShowConfirmation(true)
  }

  return (
    <>
      {/* Confirmation toast */}
      {showConfirmation && (
        <div
          style={{
            position: 'fixed',
            bottom: '5rem',
            right: '1.5rem',
            background: 'rgba(46, 213, 115, 0.95)',
            color: 'white',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.9rem',
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'fadeInUp 0.2s ease-out',
          }}
        >
          <span>✓</span>
          <span>Feedback submitted!</span>
        </div>
      )}

      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          width: '3rem',
          height: '3rem',
          borderRadius: '50%',
          background: colors.primary,
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.25rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          transition: 'transform 0.15s, box-shadow 0.15s',
          zIndex: 1000,
        }}
        title="Send Feedback"
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)'
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}
      >
        💬
      </button>

      <Modal isOpen={isOpen} onClose={() => { setIsOpen(false); setFeedbackType('bug') }} title="Send Feedback">
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', paddingBottom: '1rem', flexWrap: 'wrap' }}>
            {(['critical_bug', 'bug', 'new_feature', 'core_feature', 'qol'] as FeedbackType[]).map((type) => {
              const config = feedbackTypeConfig[type]
              const isSelected = feedbackType === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFeedbackType(type)}
                  style={{
                    flex: 1,
                    padding: '0.6rem 0.5rem',
                    border: `2px solid ${config.color}`,
                    borderRadius: '0.5rem',
                    background: isSelected ? config.bgColor : 'transparent',
                    color: isSelected ? config.color : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 600 : 400,
                    fontSize: '0.8rem',
                    transition: 'all 0.15s ease',
                    opacity: isSelected ? 1 : 0.5,
                    boxShadow: isSelected ? `0 0 12px ${config.bgColor}` : 'none',
                    position: 'relative',
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
          <TextAreaInput
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Share your feedback, bug reports, or feature requests..."
            minHeight="8rem"
            autoFocus
            required
          />

          <FormButtonGroup>
            <Button type="button" variant="secondary" onClick={() => { setIsOpen(false); setFeedbackType('bug') }}>
              Cancel
            </Button>
            <Button type="submit" disabled={!feedbackText.trim()}>
              Submit
            </Button>
          </FormButtonGroup>
        </form>
      </Modal>
    </>
  )
}
