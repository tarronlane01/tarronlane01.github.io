import { useState, useContext, type DragEvent, type FormEvent } from 'react'
import UserContext from '../../contexts/user_context'
import useFirebaseAuth from '../../hooks/useFirebaseAuth'
import { useFeedbackQuery, type FlattenedFeedbackItem, type FeedbackItem } from '../../data'
import { useSubmitFeedback, useToggleFeedback, useUpdateSortOrder } from '../../data/mutations/feedback'
import {
  ErrorAlert,
  Button,
  DropZone,
  FormWrapper,
  TextAreaInput,
  FormButtonGroup,
  CollapsibleSection,
  Modal,
} from '../../components/ui'
import { pageSubtitle, listContainer } from '../../styles/shared'
import {
  FeedbackCard,
  CompletedFeedbackItem,
  feedbackTypeConfig,
  type FeedbackType,
} from '../../components/budget/Admin'
import { logUserAction } from '@utils'

function SettingsFeedback() {
  const [error, setError] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newFeedbackText, setNewFeedbackText] = useState('')
  const [newFeedbackType, setNewFeedbackType] = useState<FeedbackType>('bug')
  const [confirmingItem, setConfirmingItem] = useState<FlattenedFeedbackItem | null>(null)
  const [editingTypeItem, setEditingTypeItem] = useState<FlattenedFeedbackItem | null>(null)

  const userContext = useContext(UserContext)
  const firebaseAuth = useFirebaseAuth()
  const currentUser = firebaseAuth.get_current_firebase_user()

  // Use React Query for feedback data
  const feedbackQuery = useFeedbackQuery()
  const { submitFeedback } = useSubmitFeedback()
  const { toggleFeedback } = useToggleFeedback()
  const { updateSortOrder } = useUpdateSortOrder()

  const allFeedback = feedbackQuery.data?.items || []

  function handleAddFeedback(e: FormEvent) {
    e.preventDefault()
    if (!newFeedbackText.trim() || !userContext.username || !currentUser) return

    // Fire mutation and close optimistically - the item appears immediately via onMutate
    submitFeedback.mutate({
      userId: currentUser.uid,
      userEmail: userContext.username,
      text: newFeedbackText.trim(),
      feedbackType: newFeedbackType,
      currentPath: '/settings/feedback',
    })

    // Close immediately
    setNewFeedbackText('')
    setNewFeedbackType('bug')
    setShowAddForm(false)
  }

  function handleToggleDone(item: FlattenedFeedbackItem) {
    // If marking as complete, ask for confirmation first
    if (!item.is_done) {
      setConfirmingItem(item)
    } else {
      // If unchecking (marking as not complete), do it immediately
      performToggleDone(item)
    }
  }

  async function performToggleDone(item: FlattenedFeedbackItem) {
    try {
      await toggleFeedback.mutateAsync({ item })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feedback')
    }
  }

  function confirmComplete() {
    if (confirmingItem) {
      performToggleDone(confirmingItem)
      setConfirmingItem(null)
    }
  }

  async function handleTypeChange(newType: FeedbackType) {
    if (!editingTypeItem) return

    try {
      // Get all items for this document and update the specific one
      const docItems = allFeedback.filter(fi => fi.doc_id === editingTypeItem.doc_id)
      const updatedItems: FeedbackItem[] = docItems.map(fi => {
        if (fi.id === editingTypeItem.id) {
          return {
            id: fi.id,
            text: fi.text,
            created_at: fi.created_at,
            is_done: fi.is_done,
            completed_at: fi.completed_at,
            sort_order: fi.sort_order,
            feedback_type: newType,
          }
        }
        return {
          id: fi.id,
          text: fi.text,
          created_at: fi.created_at,
          is_done: fi.is_done,
          completed_at: fi.completed_at,
          sort_order: fi.sort_order,
          feedback_type: fi.feedback_type,
        }
      })

      await updateSortOrder.mutateAsync({
        docId: editingTypeItem.doc_id,
        items: updatedItems,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feedback type')
    }

    setEditingTypeItem(null)
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
    handleDragEnd()

    // Group by doc_id and update each document
    const byDocId = new Map<string, FeedbackItem[]>()
    for (const item of updatedPendingItems) {
      if (!byDocId.has(item.doc_id)) {
        byDocId.set(item.doc_id, [])
      }
      byDocId.get(item.doc_id)!.push({
        id: item.id,
        text: item.text,
        created_at: item.created_at,
        is_done: item.is_done,
        completed_at: item.completed_at,
        sort_order: item.sort_order,
        feedback_type: item.feedback_type,
      })
    }

    // Also include completed items from each doc
    for (const item of completedItems) {
      if (!byDocId.has(item.doc_id)) {
        byDocId.set(item.doc_id, [])
      }
      byDocId.get(item.doc_id)!.push({
        id: item.id,
        text: item.text,
        created_at: item.created_at,
        is_done: item.is_done,
        completed_at: item.completed_at,
        sort_order: item.sort_order,
        feedback_type: item.feedback_type,
      })
    }

    try {
      for (const [docId, items] of byDocId) {
        await updateSortOrder.mutateAsync({ docId, items })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save order')
    }
  }

  if (feedbackQuery.isLoading) return <p>Loading feedback...</p>

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
            onToggleDone={() => handleToggleDone(item)}
            onTypeClick={() => setEditingTypeItem(item)}
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
        <FormWrapper actionName="Add Feedback" onSubmit={handleAddFeedback}>
          <FeedbackTypeSelector
            selectedType={newFeedbackType}
            onSelect={setNewFeedbackType}
          />
          <TextAreaInput
            value={newFeedbackText}
            onChange={(e) => setNewFeedbackText(e.target.value)}
            placeholder="Enter your feedback, bug report, or feature request..."
            autoFocus
            required
          />
          <FormButtonGroup>
            <Button type="submit" actionName="Add Feedback" disabled={!newFeedbackText.trim()}>
              Add Feedback
            </Button>
            <Button type="button" variant="secondary" actionName="Cancel Add Feedback" onClick={() => { setShowAddForm(false); setNewFeedbackText(''); setNewFeedbackType('bug') }}>
              Cancel
            </Button>
          </FormButtonGroup>
        </FormWrapper>
      ) : (
        <Button variant="primary-large" actionName="Open Add Feedback Form" onClick={() => setShowAddForm(true)}>
          + Add Feedback
        </Button>
      )}

      {completedItems.length > 0 && (
        <CollapsibleSection title="Completed" count={completedItems.length}>
          <div style={{ ...listContainer, marginTop: '0.5rem' }}>
            {completedItems.map((item) => (
              <CompletedFeedbackItem
                key={item.id}
                item={item}
                onToggleDone={() => handleToggleDone(item)}
                onTypeClick={() => setEditingTypeItem(item)}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      <Modal
        isOpen={confirmingItem !== null}
        onClose={() => setConfirmingItem(null)}
        title="Mark as Complete"
      >
        <p style={{ margin: '0 0 1.5rem 0' }}>
          Are you sure you want to mark this feedback item as complete?
        </p>
        {confirmingItem && (
          <p style={{ margin: '0 0 1.5rem 0', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', fontSize: '0.9rem' }}>
            "{confirmingItem.text}"
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="secondary" actionName="Cancel Mark Complete" onClick={() => setConfirmingItem(null)}>
            Cancel
          </Button>
          <Button variant="primary" actionName="Confirm Mark Complete" onClick={confirmComplete}>
            Mark Complete
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={editingTypeItem !== null}
        onClose={() => setEditingTypeItem(null)}
        title="Change Feedback Type"
      >
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', opacity: 0.8 }}>
          Select a new type for this feedback:
        </p>
        <FeedbackTypeSelector
          selectedType={editingTypeItem?.feedback_type as FeedbackType || 'bug'}
          onSelect={handleTypeChange}
        />
        <Button variant="secondary" actionName="Cancel Change Feedback Type" onClick={() => setEditingTypeItem(null)} style={{ width: '100%' }}>
          Cancel
        </Button>
      </Modal>
    </div>
  )
}

// Feedback type selector component
function FeedbackTypeSelector({
  selectedType,
  onSelect,
}: {
  selectedType: FeedbackType
  onSelect: (type: FeedbackType) => void
}) {
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

export default SettingsFeedback

