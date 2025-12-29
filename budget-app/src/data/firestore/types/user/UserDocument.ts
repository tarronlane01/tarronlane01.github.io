import type { PermissionFlags } from './PermissionFlags'

// User document type for storing budget access
export interface UserDocument {
  uid: string
  email: string | null
  budget_ids: string[]
  permission_flags?: PermissionFlags
  created_at?: string
  updated_at?: string
}

