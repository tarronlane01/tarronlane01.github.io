import { usePackingMutation } from './usePackingMutation'
import type { PackingDocument } from '@packing/data/types'

export function useUserMutations() {
  const mutation = usePackingMutation()

  return {
    addUser: (userId: string, currentUserIds: string[]) => {
      if (currentUserIds.includes(userId)) return
      const newUserIds = [...currentUserIds, userId]
      mutation.mutate({
        updates: { userIds: newUserIds },
        description: `adding user "${userId}"`,
        optimisticUpdate: (prev) => ({ ...prev, userIds: newUserIds }),
      })
    },

    removeUser: (userId: string, currentUserIds: string[]) => {
      const newUserIds = currentUserIds.filter(id => id !== userId)
      mutation.mutate({
        updates: { userIds: newUserIds },
        description: `removing user "${userId}"`,
        optimisticUpdate: (prev: PackingDocument) => ({ ...prev, userIds: newUserIds }),
      })
    },

    isPending: mutation.isPending,
  }
}
