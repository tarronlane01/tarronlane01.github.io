import { colors } from '@styles/shared'

interface ThreeStateCheckboxProps {
  label: string
  value: boolean | undefined
  onChange: (value: boolean | undefined) => void
  trueLabel: string
  falseLabel: string
  undefinedLabel: string
}

export function ThreeStateCheckbox({ label, value, onChange, trueLabel, falseLabel, undefinedLabel }: ThreeStateCheckboxProps) {
  function cycle() {
    if (value === undefined) onChange(true)
    else if (value === true) onChange(false)
    else onChange(undefined)
  }

  const displayLabel = value === true ? trueLabel : value === false ? falseLabel : undefinedLabel
  const displayColor = value === true ? colors.success : value === false ? colors.warning : 'inherit'
  const displayIcon = value === true ? '✓' : value === false ? '✗' : '○'

  return (
    <button
      type="button"
      onClick={cycle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        background: value !== undefined
          ? `color-mix(in srgb, ${displayColor} 15%, transparent)`
          : 'color-mix(in srgb, currentColor 8%, transparent)',
        border: value !== undefined
          ? `1px solid color-mix(in srgb, ${displayColor} 40%, transparent)`
          : '1px solid color-mix(in srgb, currentColor 20%, transparent)',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.85rem',
        color: 'inherit',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <span style={{
        width: '1.25rem',
        height: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '4px',
        background: value !== undefined ? displayColor : 'color-mix(in srgb, currentColor 20%, transparent)',
        color: value !== undefined ? 'white' : 'inherit',
        fontWeight: 600,
        fontSize: '0.75rem',
      }}>
        {displayIcon}
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ opacity: 0.7 }}>{label}:</span>{' '}
        <span style={{ fontWeight: 500, color: displayColor }}>{displayLabel}</span>
      </span>
      <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>click to cycle</span>
    </button>
  )
}

