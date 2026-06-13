import { readDocByPath } from '@firestore'

interface UserDoc {
  permission_flags?: { is_admin?: boolean }
}

export async function fetchAdminStatus(userId: string): Promise<boolean> {
  const { data } = await readDocByPath<UserDoc>(
    'users', userId, 'checking admin status for packing'
  )
  return data?.permission_flags?.is_admin === true
}
