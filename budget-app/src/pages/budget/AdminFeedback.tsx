import { useState, useEffect, useContext, type DragEvent, type FormEvent } from 'react'
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore'
import app from '../../firebase'
import UserContext from '../../contexts/user_context'
import {
  ErrorAlert,
  Button,
  DropZone,
  FormWrapper,
  TextAreaInput,
  FormButtonGroup,
  Checkbox,
  CollapsibleSection,
  formatDate,
} from '../../components/ui'
import { pageSubtitle, listContainer, card, dragHandle, dropIndicator, colors } from '../../styles/shared'

interface FeedbackItem {
  id: string
  text: string
  created_at: string
  is_done: boolean
  completed_at: string | null
  sort_order: number
}

interface FeedbackDoc {
  user_email: string
  items: FeedbackItem[]
}

interface FlattenedFeedbackItem extends FeedbackItem {
  user_email: string
  doc_id: string
}

function AdminFeedback() {
  const [allFeedback, setAllFeedback] = useState<FlattenedFeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newFeedbackText, setNewFeedbackText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const userContext = useContext(UserContext)
  const db = getFirestore(app)

  useEffect(() => {
    loadFeedback()
  }, [])

  async function loadFeedback() {
    try {
      const feedbackCollection = collection(db, 'feedback')
      const snapshot = await getDocs(feedbackCollection)
      const flattened: FlattenedFeedbackItem[] = []

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as FeedbackDoc
        if (data.items) {
          data.items.forEach((item) => {
            flattened.push({ ...item, user_email: data.user_email, doc_id: docSnap.id })
          })
        }
      })

      setAllFeedback(flattened)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddFeedback(e: FormEvent) {
    e.preventDefault()
    if (!newFeedbackText.trim() || !userContext.username) return

    setIsSubmitting(true)
    setError(null)

    try {
      const docId = userContext.username.replace(/[.@]/g, '_')
      const feedbackDocRef = doc(db, 'feedback', docId)

      const newFeedbackItem: FeedbackItem = {
        id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: newFeedbackText.trim(),
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

      setAllFeedback((prev) => [...prev, { ...newFeedbackItem, user_email: userContext.username, doc_id: docId }])
      setNewFeedbackText('')
      setShowAddForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add feedback')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function saveItemUpdate(item: FlattenedFeedbackItem) {
    try {
      const docRef = doc(db, 'feedback', item.doc_id)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const docData = docSnap.data() as FeedbackDoc
        const updatedItems = docData.items.map((fi: FeedbackItem) =>
          fi.id === item.id
            ? { id: item.id, text: item.text, created_at: item.created_at, is_done: item.is_done, completed_at: item.completed_at, sort_order: item.sort_order }
            : fi
        )
        await setDoc(docRef, { ...docData, items: updatedItems })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feedback')
    }
  }

  async function toggleDone(item: FlattenedFeedbackItem) {
    const updatedItem = {
      ...item,
      is_done: !item.is_done,
      completed_at: !item.is_done ? new Date().toISOString() : null,
    }
    setAllFeedback((prev) => prev.map((fi) => (fi.id === item.id ? updatedItem : fi)))
    await saveItemUpdate(updatedItem)
  }

  const pendingItems = allFeedback.filter((item) => !item.is_done).sort((a, b) => a.sort_order - b.sort_order)
  const completedItems = allFeedback.filter((item) => item.is_done).sort((a, b) => {
    const dateA = a.completed_at ? new Date(a.completed_at).getTime() : 0
    const dateB = b.completed_at ? new Date(b.completed_at).getTime() : 0
    return dateB - dateA
  })

  // Drag and drop handlers
  function handleDragStart(e: DragEvent, itemId: string) {
    setDraggedId(itemId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: DragEvent, itemId: string) {
    e.preventDefault()
    if (itemId !== draggedId) setDragOverId(itemId)
  }

  function handleDragLeave() { setDragOverId(null) }
  function handleDragEnd() { setDraggedId(null); setDragOverId(null) }

  async function handleDrop(e: DragEvent, targetId: string) {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) {
      handleDragEnd()
      return
    }

    const draggedIndex = pendingItems.findIndex((item) => item.id === draggedId)
    const newPendingItems = [...pendingItems]
    const [draggedItem] = newPendingItems.splice(draggedIndex, 1)

    if (targetId === '__end__') {
      newPendingItems.push(draggedItem)
    } else {
      const targetIndex = newPendingItems.findIndex((item) => item.id === targetId)
      newPendingItems.splice(targetIndex, 0, draggedItem)
    }

    const updatedPendingItems = newPendingItems.map((item, index) => ({ ...item, sort_order: index }))
    setAllFeedback((prev) => [...prev.filter((item) => item.is_done), ...updatedPendingItems])
    handleDragEnd()

    for (const item of updatedPendingItems) {
      await saveItemUpdate(item)
    }
  }

  if (loading) return <p>Loading feedback...</p>

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Feedback</h2>
      <p style={{ ...pageSubtitle, fontSize: '0.9rem' }}>
        View and manage user feedback. Drag to reorder pending items.
      </p>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <div style={listContainer}>
        {pendingItems.length === 0 && !showAddForm && (
          <p style={{ opacity: 0.7 }}>No pending feedback.</p>
        )}

        {pendingItems.map((item) => (
          <FeedbackCard
            key={item.id}
            item={item}
            isDragging={draggedId === item.id}
            isDragOver={dragOverId === item.id}
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragOver={(e) => handleDragOver(e, item.id)}
            onDragLeave={handleDragLeave}
            onDragEnd={handleDragEnd}
            onDrop={(e) => handleDrop(e, item.id)}
            onToggleDone={() => toggleDone(item)}
          />
        ))}

        {draggedId && pendingItems.length > 0 && (
          <DropZone
            isActive={dragOverId === '__end__'}
            onDragOver={(e) => handleDragOver(e, '__end__')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, '__end__')}
          />
        )}
      </div>

      {showAddForm ? (
        <FormWrapper onSubmit={handleAddFeedback}>
          <TextAreaInput
            value={newFeedbackText}
            onChange={(e) => setNewFeedbackText(e.target.value)}
            placeholder="Enter your feedback, bug report, or feature request..."
            autoFocus
            required
          />
          <FormButtonGroup>
            <Button type="submit" isLoading={isSubmitting} disabled={!newFeedbackText.trim()}>
              Add Feedback
            </Button>
            <Button type="button" variant="secondary" onClick={() => { setShowAddForm(false); setNewFeedbackText('') }}>
              Cancel
            </Button>
          </FormButtonGroup>
        </FormWrapper>
      ) : (
        <Button variant="primary-large" onClick={() => setShowAddForm(true)}>
          + Add Feedback
        </Button>
      )}

      {completedItems.length > 0 && (
        <CollapsibleSection title="Completed" count={completedItems.length}>
          <div style={{ ...listContainer, marginTop: '0.5rem' }}>
            {completedItems.map((item) => (
              <div key={item.id} style={{ ...card, opacity: 0.6, flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                <Checkbox checked={item.is_done} onChange={() => toggleDone(item)}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, lineHeight: 1.5, textDecoration: 'line-through' }}>{item.text}</p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
                      {item.user_email} • Created: {formatDate(item.created_at)}
                    </p>
                    {item.completed_at && (
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: colors.success }}>
                        ✓ Completed: {formatDate(item.completed_at)}
                      </p>
                    )}
                  </div>
                </Checkbox>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

// Extracted feedback card component
interface FeedbackCardProps {
  item: FlattenedFeedbackItem
  isDragging: boolean
  isDragOver: boolean
  onDragStart: (e: DragEvent) => void
  onDragOver: (e: DragEvent) => void
  onDragLeave: () => void
  onDragEnd: () => void
  onDrop: (e: DragEvent) => void
  onToggleDone: () => void
}

function FeedbackCard({ item, isDragging, isDragOver, onDragStart, onDragOver, onDragLeave, onDragEnd, onDrop, onToggleDone }: FeedbackCardProps) {
  return (
    <div
      onDragOver={(e) => { e.stopPropagation(); onDragOver(e) }}
      onDragLeave={(e) => { e.stopPropagation(); onDragLeave() }}
      onDrop={(e) => { e.stopPropagation(); onDrop(e) }}
      style={{ position: 'relative' }}
    >
      <div style={{ ...dropIndicator, opacity: isDragOver ? 1 : 0, boxShadow: isDragOver ? '0 0 8px rgba(100, 108, 255, 0.6)' : 'none' }} />
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={{ ...card, cursor: 'grab', opacity: isDragging ? 0.5 : 1, flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <span style={{ ...dragHandle, marginTop: '0.25rem' }}>⋮⋮</span>
          <Checkbox checked={item.is_done} onChange={onToggleDone}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, lineHeight: 1.5 }}>{item.text}</p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', opacity: 0.6 }}>
                {item.user_email} • {formatDate(item.created_at)}
              </p>
            </div>
          </Checkbox>
        </div>
      </div>
    </div>
  )
}

export default AdminFeedback
