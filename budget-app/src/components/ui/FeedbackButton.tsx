import { useState, useContext, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { getFirestore, doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore'
import app from '../../firebase'
import UserContext from '../../contexts/user_context'
import { colors } from '../../styles/shared'
import { Button } from './Button'
import { Modal } from './Modal'
import { TextAreaInput } from './FormElements'
import { FormButtonGroup } from './FormElements'

interface FeedbackItem {
  id: string
  text: string
  created_at: string
  is_done: boolean
  completed_at: string | null
  sort_order: number
}

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userContext = useContext(UserContext)
  const location = useLocation()
  const db = getFirestore(app)

  // Hide on feedback admin page since it has its own form
  const isOnFeedbackPage = location.pathname.includes('/admin/feedback')
  if (isOnFeedbackPage) return null
  if (!userContext.is_logged_in) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!feedbackText.trim() || !userContext.username) return

    setIsSubmitting(true)
    setError(null)

    try {
      const docId = userContext.username.replace(/[.@]/g, '_')
      const feedbackDocRef = doc(db, 'feedback', docId)

      const newFeedbackItem: FeedbackItem = {
        id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: feedbackText.trim(),
        created_at: new Date().toISOString(),
        is_done: false,
        completed_at: null,
        sort_order: Date.now(),
      }

      const docSnap = await getDoc(feedbackDocRef)

      if (docSnap.exists()) {
        await setDoc(feedbackDocRef, { items: arrayUnion(newFeedbackItem) }, { merge: true })
      } else {
        await setDoc(feedbackDocRef, { user_email: userContext.username, items: [newFeedbackItem] })
      }

      setFeedbackText('')
      setSubmitSuccess(true)
      setTimeout(() => {
        setSubmitSuccess(false)
        setIsOpen(false)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
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

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Send Feedback">
        {submitSuccess ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: colors.success }}>
            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>✓</span>
            Feedback submitted!
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <TextAreaInput
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Share your feedback, bug reports, or feature requests..."
              minHeight="8rem"
              autoFocus
              required
            />

            {error && (
              <p style={{ color: colors.error, fontSize: '0.85rem', margin: '0.5rem 0' }}>
                {error}
              </p>
            )}

            <FormButtonGroup>
              <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting} disabled={!feedbackText.trim()}>
                Submit
              </Button>
            </FormButtonGroup>
          </form>
        )}
      </Modal>
    </>
  )
}
