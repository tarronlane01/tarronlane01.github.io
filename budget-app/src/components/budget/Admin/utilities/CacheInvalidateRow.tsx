/**
 * Cache Invalidate Row
 *
 * Compact row for clearing all caches and reloading.
 */

import { useState } from 'react'
import { UtilityRow } from '../common'
import { Modal, Button } from '../../../ui'

interface CacheInvalidateRowProps {
  onClearCache: () => void
  disabled: boolean
}

export function CacheInvalidateRow({
  onClearCache,
  disabled,
}: CacheInvalidateRowProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const handleClick = () => {
    setShowConfirmModal(true)
  }

  const handleConfirm = () => {
    setShowConfirmModal(false)
    onClearCache()
  }

  return (
    <>
      <UtilityRow
        name="Clear All Caches"
        description="Clear cached data and reload to fetch fresh data from Firestore"
        onAction={handleClick}
        actionText="Clear & Reload"
        actionIcon="🔄"
        disabled={disabled}
        isDestructive
      />

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Clear Caches & Reload?"
      >
        <p style={{ margin: '0 0 1rem 0', opacity: 0.8 }}>
          This will clear all cached data from localStorage and reload the page.
          The app will fetch fresh data from Firestore for everything.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button
            variant="secondary"
            actionName="Cancel Clear Caches"
            onClick={() => setShowConfirmModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            actionName="Confirm Clear Caches & Reload"
            onClick={handleConfirm}
          >
            Clear & Reload
          </Button>
        </div>
      </Modal>
    </>
  )
}

