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
  CurrencyInput,
  PayeeAutocomplete,
} from './FormElements'
export { DraggableCard } from './DraggableCard'
export { DropZone } from './DropZone'
export { StatCard, StatItem } from './StatCard'
export { formatCurrency, getBalanceColor } from './statHelpers'
export { FeedbackButton } from './FeedbackButton'
export { Modal } from './Modal'
export { Checkbox } from './Checkbox'
export { CollapsibleSection } from './CollapsibleSection'
export { TabNavigation, type Tab, type TabNavigationProps } from './TabNavigation'
export { Breadcrumb, type BreadcrumbItem } from './Breadcrumb'
export { DropdownMenu, type MenuItem } from './DropdownMenu'
export { BudgetNavBar } from './BudgetNavBar'
export { ContentContainer } from './ContentContainer'

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

