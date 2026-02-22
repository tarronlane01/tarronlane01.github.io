/**
 * Shared keyboard, scroll, and ref logic for dropdown autocompletes
 * (Category, Account, Payee). Handles ArrowDown/Up, Enter, Escape, Tab,
 * scroll-into-view, and "only select on Tab if user typed or used arrows".
 */

import { useRef, useEffect, useCallback } from 'react'
import { focusNextFocusable } from './autocompleteHelpers'

export interface UseAutocompleteDropdownOptions<T> {
  /** Items in display order (same order as rendered rows). Used for selection by index. */
  suggestionsInDisplayOrder: T[]
  highlightedIndex: number
  setHighlightedIndex: (index: number) => void
  showSuggestions: boolean
  setShowSuggestions: (show: boolean) => void
  onSelect: (item: T) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  /** When Escape or Tab (without selecting), call this to restore display value. */
  onClose?: () => void
  /** If true, index -1 is the "No X" option. Tab/Enter at -1 call onSelectNoOption. */
  showNoOption?: boolean
  onSelectNoOption?: () => void
  /** Min index for ArrowUp (0 when there's a "No" option so we don't go below 0, -1 for Payee). */
  minIndex?: number
}

export function useAutocompleteDropdown<T>({
  suggestionsInDisplayOrder,
  highlightedIndex,
  setHighlightedIndex,
  showSuggestions,
  setShowSuggestions,
  onSelect,
  inputRef,
  onClose,
  showNoOption = false,
  onSelectNoOption,
  minIndex = 0,
}: UseAutocompleteDropdownOptions<T>) {
  const hasNavigatedOrTypedRef = useRef(false)
  const highlightedIndexRef = useRef(-1)
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({})

  useEffect(() => {
    highlightedIndexRef.current = highlightedIndex
  }, [highlightedIndex])

  // Scroll highlighted item into view when navigating with keyboard
  useEffect(() => {
    if (!showSuggestions) return
    const el = itemRefs.current[highlightedIndex]
    el?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  }, [showSuggestions, highlightedIndex])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const length = suggestionsInDisplayOrder.length

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        hasNavigatedOrTypedRef.current = true
        if (!showSuggestions) {
          if (length > 0) {
            setShowSuggestions(true)
            setHighlightedIndex(0)
            highlightedIndexRef.current = 0
          }
        } else {
          const next = Math.min(highlightedIndexRef.current + 1, length - 1)
          setHighlightedIndex(next)
          highlightedIndexRef.current = next
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        hasNavigatedOrTypedRef.current = true
        const next = Math.max(highlightedIndexRef.current - 1, minIndex)
        setHighlightedIndex(next)
        highlightedIndexRef.current = next
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const idx = highlightedIndexRef.current
        if (showSuggestions && idx >= 0) {
          const item = suggestionsInDisplayOrder[idx]
          if (item != null) {
            onSelect(item)
            return
          }
        }
        if (showSuggestions && idx === -1 && showNoOption && onSelectNoOption) {
          onSelectNoOption()
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false)
        setHighlightedIndex(-1)
        highlightedIndexRef.current = -1
        onClose?.()
      } else if (e.key === 'Tab') {
        const shouldSelectOnTab = hasNavigatedOrTypedRef.current
        const idx = highlightedIndexRef.current

        if (shouldSelectOnTab && showSuggestions && length > 0) {
          if (idx === -1 && showNoOption && onSelectNoOption) {
            e.preventDefault()
            onSelectNoOption()
            requestAnimationFrame(() => focusNextFocusable(inputRef.current, e.shiftKey))
          } else {
            const effectiveIdx = idx >= 0 ? idx : 0
            const item = suggestionsInDisplayOrder[effectiveIdx]
            if (item != null) {
              e.preventDefault()
              onSelect(item)
              requestAnimationFrame(() => focusNextFocusable(inputRef.current, e.shiftKey))
            } else {
              setShowSuggestions(false)
              setHighlightedIndex(-1)
              highlightedIndexRef.current = -1
              onClose?.()
            }
          }
        } else if (showSuggestions) {
          setShowSuggestions(false)
          setHighlightedIndex(-1)
          highlightedIndexRef.current = -1
          onClose?.()
        }
      }
    },
    [
      suggestionsInDisplayOrder,
      showSuggestions,
      setShowSuggestions,
      setHighlightedIndex,
      onSelect,
      onSelectNoOption,
      onClose,
      showNoOption,
      minIndex,
      inputRef,
    ]
  )

  return {
    handleKeyDown,
    hasNavigatedOrTypedRef,
    highlightedIndexRef,
    itemRefs,
  }
}
