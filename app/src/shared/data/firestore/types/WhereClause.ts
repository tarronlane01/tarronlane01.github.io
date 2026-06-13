import type { WhereFilterOp } from 'firebase/firestore'

export interface WhereClause {
  field: string
  op: WhereFilterOp
  value: unknown
}

