// Re-export all UI components
export { PageContainer } from './PageContainer'
export { ErrorAlert } from './ErrorAlert'
export { Button } from './Button'
export {
  FormWrapper,
  FormField,
  TextInput,
  NumberInput,
  SelectInput,
  TextAreaInput,
  FormButtonGroup,
} from './FormElements'
export { DraggableCard } from './DraggableCard'
export { DropZone } from './DropZone'
export { StatCard, StatItem, formatCurrency, getBalanceColor } from './StatCard'
export { FeedbackButton } from './FeedbackButton'
export { Modal } from './Modal'
export { Checkbox } from './Checkbox'
export { CollapsibleSection } from './CollapsibleSection'

// Utility functions
export function formatDate(isoString: string) {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

