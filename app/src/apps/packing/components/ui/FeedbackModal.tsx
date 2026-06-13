import { useState, useEffect, type FormEvent } from 'react'
import { Modal, TextAreaInput, Button, FormButtonGroup } from '@components/ui'
import { usePacking } from '@packing/contexts'
import { usePackingQuery } from '@packing/data/queries'
import { submitFeedback } from '@packing/data/mutations/feedback'

const CONFIRMATION_TIMEOUT_MS = 2000

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [feedbackText, setFeedbackText] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { currentUserId } = usePacking()
  const { data: packing } = usePackingQuery()

  useEffect(() => {
    if (showConfirmation) {
      const timer = setTimeout(() => setShowConfirmation(false), CONFIRMATION_TIMEOUT_MS)
      return () => clearTimeout(timer)
    }
  }, [showConfirmation])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!feedbackText.trim() || !currentUserId || isSubmitting) return

    setIsSubmitting(true)
    try {
      const userIds = packing?.userIds ?? []
      await submitFeedback(feedbackText, currentUserId, userIds)
      setFeedbackText('')
      onClose()
      setShowConfirmation(true)
    } catch {
      console.error('Failed to submit packing feedback')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {showConfirmation && (
        <div style={{
          position: 'fixed',
          bottom: '5rem',
          right: '1.5rem',
          background: 'var(--banner-success)',
          color: 'white',
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          fontSize: '0.9rem',
          fontWeight: 500,
          boxShadow: '0 4px 12px var(--shadow-overlay)',
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span>✓</span>
          <span>Feedback submitted!</span>
        </div>
      )}

      <Modal isOpen={isOpen} onClose={onClose} title="Send Feedback">
        <form onSubmit={handleSubmit}>
          <TextAreaInput
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Share your feedback, bug reports, or feature requests..."
            minHeight="8rem"
            autoFocus
            required
          />
          <FormButtonGroup>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!feedbackText.trim() || isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          </FormButtonGroup>
        </form>
      </Modal>
    </>
  )
}
